---
layout: ../../layouts/BlogPost.astro
title: 'Adding Native Retry Logic to gofalcon'
date: '2026-05-16 12:30 MDT'
description: 'How I added built-in exponential backoff retry support to the CrowdStrike Falcon Go SDK, so callers no longer have to roll their own.'
tags: ['go', 'open-source', 'crowdstrike', 'http']
showToc: true
---

Recently opened a PR to [gofalcon](https://github.com/CrowdStrike/gofalcon), the community-maintained Go SDK for CrowdStrike's Falcon APIs. The change adds native retry logic with exponential backoff so that callers don't have to implement it themselves.

## The Problem

The Falcon API returns `429 Too Many Requests` when rate limits are hit and `5xx` errors during transient service issues. Before this change, the SDK offered no help with either. Users who wanted retries had to reach for `TransportDecorator`, the SDK's escape hatch for wrapping the underlying `http.RoundTripper`. That's exactly what the Terraform provider for CrowdStrike did -- a [WIP branch](https://github.com/CrowdStrike/terraform-provider-crowdstrike/compare/main...ffalor:terraform-provider-crowdstrike:retry) added a custom `RetryTransport` and then used `TransportDecorator` to wire it in.

That approach works, but it means every consumer of gofalcon has to solve the same problem independently.

## The Design

The fix is a `RetryConfig` struct on `ApiConfig`:

```go
client, err := falcon.NewClient(&falcon.ApiConfig{
    ClientId:     os.Getenv("FALCON_CLIENT_ID"),
    ClientSecret: os.Getenv("FALCON_CLIENT_SECRET"),
    Cloud:        falcon.Cloud("us-1"),
    Context:      context.Background(),
    RetryConfig: &falcon.RetryConfig{
        MaxTries:        10,
        InitialInterval: 2 * time.Second,
        MaxInterval:     time.Minute,
    },
})
```

The default for `RetryConfig` is `nil`, meaning retries are disabled by default. This preserves backward compatibility for existing SDK users who might have already implemented their own retry logic.

Internally, a `retryTransport` is inserted into the existing `http.RoundTripper` chain:

```
TransportDecorator (user-provided, optional)
    retryTransport        <- new
        roundTripper      <- adds User-Agent, rate-limit sleep
            workaround    <- patches missing Content-Type
                oauth2.Transport
                    http.DefaultTransport
```

The implementation uses `github.com/cenkalti/backoff/v5`. The operation closure checks the response status and returns a retryable error for `429` and `5xx`. The backoff library handles the wait and the retry loop, and the context on the request controls cancellation.

```go
operation := func() (*http.Response, error) {
    cloned, err := cloneRequest(req)
    if err != nil {
        return nil, backoff.Permanent(err)
    }

    resp, err := rt.T.RoundTrip(cloned)
    if err != nil {
        return resp, err
    }

    if resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode >= 500 {
        drainBody(resp)
        return nil, fmt.Errorf("retryable HTTP status: %d", resp.StatusCode)
    }

    return resp, nil
}
```

## Body Replay

Retrying a POST means the request body has to be sent again on every attempt. In Go, `http.Request.Body` is an `io.ReadCloser` -- a one-way stream. Once read, it's exhausted.

The right way to handle this is `req.GetBody`, a function field on `http.Request` that returns a fresh copy of the body. The standard library sets it automatically when the body is a `*bytes.Buffer`, `*bytes.Reader`, or `*strings.Reader`. Since go-openapi (the library behind gofalcon's generated clients) uses `bytes.Buffer` for all request bodies, `GetBody` is always set in practice.

For the rare case where it isn't, `cloneRequest` falls back to `io.ReadAll`:

```go
func cloneRequest(req *http.Request) (*http.Request, error) {
    cloned := req.Clone(req.Context())

    if req.Body != nil && req.Body != http.NoBody {
        if req.GetBody != nil {
            body, err := req.GetBody()
            if err != nil {
                return nil, fmt.Errorf("failed to get request body: %w", err)
            }
            cloned.Body = body
        } else {
            bodyBytes, err := io.ReadAll(req.Body)
            if err != nil {
                return nil, fmt.Errorf("failed to read request body: %w", err)
            }
            req.Body = io.NopCloser(bytes.NewReader(bodyBytes))
            cloned.Body = io.NopCloser(bytes.NewReader(bodyBytes))
        }
    }

    return cloned, nil
}
```

The `io.NopCloser` call is necessary because `bytes.NewReader` only implements `io.Reader`, while `req.Body` requires `io.ReadCloser`. `NopCloser` wraps it and provides a Close that does nothing, since there is no underlying connection to release.

## Socket Hygiene

One detail often overlooked in Go retries is **connection reuse**. In the code above, notice the call to `drainBody(resp)` before returning a retryable error. 

If you close an HTTP response body without reading it to the end, the underlying TCP connection cannot be reused for the next request. This forces the client to open a new socket for every attempt, which is expensive and can lead to socket exhaustion under heavy load. `drainBody` ensures the remaining bytes of a `429` or `5xx` response are consumed before the next retry attempt starts.

## A Note on Context and Timeouts

A retry loop that doesn't respect context is a bug. By using `backoff.Retry(req.Context(), ...)` internally, the SDK ensures that if a caller sets a timeout or cancels their request, the retry loop terminates immediately. This prevents "zombie" retries from wasting resources on a request that no one is listening to anymore.


## Something to Watch Out For

`backoff.NewExponentialBackOff()` in older versions of the library defaulted `MaxElapsedTime` to 15 minutes. Setting `MaxTries: 0` (unlimited) would silently stop retrying after that window instead of running until context cancellation. In v5, `MaxElapsedTime` was removed entirely -- the context is now the sole mechanism for time-based stopping. Worth knowing if you're on an older version of the library.

## Testing

The SDK had almost no unit tests. I added table-driven tests for all the retry cases using a `fakeTransport` that returns pre-configured responses:

```go
tests := map[string]struct {
    responses  []*http.Response
    errors     []error
    wantStatus int
    wantErr    bool
    wantCalls  int
}{
    "no retry on 2xx": { ... },
    "retries on 429": { ... },
    "stops after MaxTries": { ... },
    // ...
}
```

There's a test with `MaxTries: 0` and a context that gets cancelled after N calls. It confirms that unlimited retries are driven by context cancellation and nothing else.

## Takeaway

This was my first *significant* open-source contribution, and it was a great lesson in how a small, focused change can have a massive impact when placed correctly in a library's architecture. The change itself is not that large (especially considering that it was based on an existing WIP PR from the terraform provider for Falcon), but I imagine the impact should be quite substantial for those using the SDK.

### `RoundTripper`
The `http.RoundTripper` interface is the "middleware" engine of Go’s `http` package. By implementing the retry logic at this layer, we solved the problem for **every** Falcon service simultaneously. Whether a caller is querying <span class="def" data-def="Security events where the Falcon sensor has identified suspicious or malicious behavior.">Detections</span> (<span class="def" data-def="Endpoint Detection and Response: A module providing visibility into endpoint activity to detect and respond to threats.">EDR</span>), listing <span class="def" data-def="Devices with the Falcon sensor installed and communicating with the CrowdStrike cloud.">Enrolled Hosts</span>, streaming <span class="def" data-def="Telemetry and alerts generated by the Falcon sensor about endpoint activity.">Security Events</span> into a <span class="def" data-def="Security Information and Event Management: A system that aggregates and analyzes log data from across an organization.">SIEM</span>, or initiating a <span class="def" data-def="A module allowing responders to remotely access and remediate compromised systems via a secure shell.">Real-Time Response</span> (<span class="def" data-def="Short for Real-Time Response.">RTR</span>) shell, they all benefit from the same native retry logic without needing a single line of service-specific code.

### Lessons in Production Go
Beyond just "adding a loop," this experience taught me several patterns:

- **Socket Hygiene**: Learning that failing to drain a response body can lead to connection pool exhaustion was a "lightbulb moment" for me regarding Go's network stack.
- **Body Replaying**: Dealing with the one-way nature of `io.Reader` and using `req.GetBody` is a mandatory skill for anyone building HTTP middleware.
- **Context as a Control Plane**: In Go, the `context` should always be the ultimate authority for when a process stops.

The existing `TransportDecorator` pattern in `gofalcon` made it straightforward to inject this logic without touching any generated code. It’s a testament to the value of "pluggable" architecture in SDK design.
