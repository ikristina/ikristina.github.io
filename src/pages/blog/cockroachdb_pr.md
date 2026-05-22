---
title: "Another PR to OSS merged 🥹 - CockroachDB"
description: "My second contribution to open source - a fix for a bug in CockroachDB's PL/pgSQL UDF support."
date: "2026-05-22 11:00 MDT"
image: "/images/cockroachdb_pr.png"
tags: ['open-source', 'cockroachdb', 'go', 'sql']
layout: ../../layouts/BlogPost.astro
---

If you read anything else in this blog, you can see that I like the internals and making sense of how things work under the hood. Otherwise, using the tech on top of it makes less sense. And less fun. 
I first heard about CockroachDB at GopherCon 2023 in San Diego, where they had a booth. I got a free book 😀

CockroachDB is a distributed SQL database written in Go. So when I was looking for something to contribute to, this felt like a natural fit. Their repo uses a nice mix of Go and SQL files to define and run their tests. The DB is Postgres-compatible, and while they implement their own storage engine (and more), they try to be as compliant as possible. 

## Glossary before we begin

- **REGCLASS** is a PostgreSQL data type that represents a "relation" (table, sequence, view, etc.) by its internal object ID. When you write `'sc.myseq'::REGCLASS`, you're casting the string name `'sc.myseq'` into this special type. PostgreSQL/CockroachDB looks up the object by name and converts it to a numeric ID under the hood. It's commonly used with functions like `nextval()` that need to reference a sequence.
- **UDF** stands for User-Defined Function - a custom function you write yourself with `CREATE FUNCTION`, as opposed to built-in functions. In this case the UDF was written in PL/pgSQL (a procedural SQL language), which is why it's sometimes called a "PL/pgSQL UDF."
- **DOid** is a Go struct in CockroachDB's source code that represents a datum (a value) of PostgreSQL's OID type. "D" is the convention for "datum" in that codebase, and "Oid" is the type. An OID (Object Identifier) is just a numeric ID that PostgreSQL uses internally to uniquely identify database objects like tables, sequences, functions, etc.
- **Schema-qualified** just means a name that includes its schema prefix, like `sc.myseq` (schema `sc`, object `myseq`), as opposed to just `myseq` on its own.
- **search_path** is a PostgreSQL setting that tells the database which schemas to search for objects when a schema name is not explicitly provided. For example, if search_path is `("public", "sc")`, an unqualified `myseq` lookup will first look in `public.myseq` and then in `sc.myseq`. 

## The Bug
As recommended in their contributing guidelines, I went through the [good first issue list](https://github.com/cockroachdb/cockroach/issues?q=sort%3Aupdated-desc+is%3Aopen+is%3Aissue+label%3A%22good+first+issue%22+) and found myself an E-starter (their label for issues suited to first-time contributors): https://github.com/cockroachdb/cockroach/issues/167057.

The bug was that when CockroachDB saw `'sc.myseq'::REGCLASS` inside a UDF, it correctly used the full name `sc.myseq` to look up the object's numeric ID. However, it then threw away the `sc.` part when storing the name. Later, when it tried to re-look up the object using only `myseq`, it couldn't find it if `sc` wasn't in the default search path.

## Navigating the codebase
The repo is insanely large with millions of lines of Go. The usual strategy for me is to look up the error message. The bug report said
something was failing at `CREATE FUNCTION` time with `relation does not exist`, so I searched for that string. 
That gave me a manageable list of files. From there I could see which one was on the path for `CREATE FUNCTION`. One led to another, and within 20 minutes I was reading `maybeTrackRegclassDependenciesForViews` in `pkg/sql/opt/optbuilder/builder.go`. When CockroachDB compiles a UDF or view, it needs to record which database objects (tables, sequences, etc.) that function/view depends on. This is important so that, for example, you can't drop a sequence that a UDF relies on without also dropping the UDF first. This function is responsible for detecting and recording those dependencies specifically for REGCLASS expressions. (It's worth noting that `maybeTrackRegclassDependenciesForViews` applies to UDFs too, despite the name.)

**Step by step what `maybeTrackRegclassDependenciesForViews` does:**
1. Checks if schema dependency tracking is even enabled. If not, it exits early.
2. Checks if the expression is of type `REGCLASS`. If it's something else, it's irrelevant and it exits.
3. Skips expressions that contain variables (like function arguments), since those can't be resolved at compile time. Only constant values can be tracked.
4. Evaluates the constant `REGCLASS` expression (e.g. `'sc.myseq'::REGCLASS`) to get the actual OID (numeric object ID).
5. Uses that OID to look up the actual data source (table/sequence) in the catalog.
6. Appends it to `b.schemaDeps` - the list of schema dependencies being collected.


## The fix

Here's the [PR](https://github.com/cockroachdb/cockroach/pull/167679) that I opened.
The crash was in step 5 - the data source lookup. The old code had two paths: it first called `strconv.Atoi(regclass.String())` to check whether the value was stored as a pure numeric OID. If so, it called `ResolveDataSourceByID` directly, and that path worked fine. The bug was in the `else` branch, taken when the value was stored as a name.

In that branch, `DOid.String()` was called to get the object's name for the lookup. But `DOid.String()` is designed to return just the resolved object name without schema qualification - correct for display purposes, but wrong here. It returned `"myseq"` instead of `"sc.myseq"`. The code then passed that bare name to `MakeUnqualifiedTableName` and tried to resolve it via `b.resolveDataSource`, which failed because `myseq` didn't exist in the default `public` schema. `resolveDataSource` ended up panicking.

```go
id, err := strconv.Atoi(regclass.String())
if err == nil {
    ds, _, err = b.catalog.ResolveDataSourceByID(b.ctx, cat.Flags{}, cat.StableID(id))
    if err != nil {
        panic(err)
    }
} else {
    tn := tree.MakeUnqualifiedTableName(tree.Name(regclass.String()))
    ds, _, _ = b.resolveDataSource(&tn, privilege.SELECT)
}
```

The fix skips that lossy round-trip entirely and just looks up the object directly using the numeric OID, which is always unambiguous.

```go
dOid, ok := regclass.(*tree.DOid)
if !ok {
    panic(errors.AssertionFailedf(
        "expected *tree.DOid from eval.Expr on REGCLASS expression, got %T", regclass,
    ))
}
ds, _, err := b.catalog.ResolveDataSourceByID(b.ctx, cat.Flags{}, cat.StableID(dOid.Oid))
if err != nil {
    panic(err)
}
```

*I also did some minor refactoring along the way for readability.*

## Testing

CockroachDB uses a system called **logic tests** for SQL-level testing. Instead of writing Go test code, you write plain text files that look like a conversation between you and the database. The test runner reads the file line by line and executes each statement, then checks that the output matches what's written in the file.

There are a few key directives in these test files:

**`statement ok`** - run this SQL and expect it to succeed with no output:
```
statement ok
CREATE SCHEMA sc_62227;
CREATE SEQUENCE sc_62227.myseq;
```

**`query I`** - run this SQL and expect it to return rows. The `I` means the result is an integer column. After `----` you write the expected output:
```
query I
SELECT sc_62227.next_id()
----
1
```

**`let $variable`** - capture the result of a query into a variable you can reuse later. This is useful when you can't predict an exact value (like an auto-assigned OID):
```
let $seqoid
SELECT 'sc_62227.myseq'::REGCLASS::OID;
```
Then you can use `$seqoid` in later statements.

**`subtest name` / `subtest end`** - groups related tests together under a named section, making it easy to run or identify a specific regression test in isolation.

The whole test file (`udf_regressions`) is just a long flat text file of these blocks, one regression test after another. The test runner is a Go program that parses and executes them, but as a contributor you never have to write Go to add a SQL-level test - you just append a new `subtest` block to the file. It's a very readable format, and the test itself essentially doubles as documentation of the expected behavior.

## Approved and merged
After the initial PR, I got a request to add another test. I did and got one of the approvals I needed. That was on April 6th. Performance tests failed but they seemed to be related to some GitHub infrastructure flakiness. I couldn't retry them myself (no permissions), so I waited for quite some time for a response. I followed up on May 5th and was advised to rebase on the latest master. The PR was approved and merged on May 19th. The fix will be included in release 26.3.0. It's been a really positive experience and I'm looking forward to contributing more.

<div class="quiz-widget">
  <div class="quiz-header">
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
    Knowledge Check <span class="quiz-progress"></span>
  </div>

  <div class="quiz-question-block" data-correct="B">
    <div class="quiz-question">What does casting a string like <code>'sc.myseq'</code> to <code>REGCLASS</code> do?</div>
    <div class="quiz-options">
      <div class="quiz-option" data-letter="A"><div>It stores the string as-is for later name resolution at query time.</div></div>
      <div class="quiz-option" data-letter="B"><div>It immediately resolves the name to the object's internal numeric OID.</div></div>
      <div class="quiz-option" data-letter="C"><div>It verifies the schema exists but defers the OID lookup to query time.</div></div>
      <div class="quiz-option" data-letter="D"><div>It creates a new relation with that name if one does not already exist.</div></div>
    </div>
    <div class="quiz-success-msg"><strong>Correct!</strong> The cast happens eagerly - PostgreSQL and CockroachDB look up the object by name right then and convert it to a numeric OID. That OID is what gets stored and used later.</div>
    <div class="quiz-error-msg"><strong>Not quite.</strong> The correct answer is <strong>B</strong>. The name-to-OID resolution happens at cast time, which is why <code>REGCLASS</code> expressions inside UDFs can be tracked as compile-time dependencies.</div>
  </div>

  <div class="quiz-question-block" data-correct="A">
    <div class="quiz-question">If <code>search_path</code> is set to <code>("public", "sc")</code>, in what order does PostgreSQL search for an unqualified object name?</div>
    <div class="quiz-options">
      <div class="quiz-option" data-letter="A"><div><code>public</code> first, then <code>sc</code>.</div></div>
      <div class="quiz-option" data-letter="B"><div><code>sc</code> first, then <code>public</code>.</div></div>
      <div class="quiz-option" data-letter="C"><div>Both schemas are searched in parallel and the first match wins.</div></div>
      <div class="quiz-option" data-letter="D"><div>The order depends on which schema was created first.</div></div>
    </div>
    <div class="quiz-success-msg"><strong>Correct!</strong> <code>search_path</code> is searched strictly left to right. Whichever schema appears first in the list is checked first.</div>
    <div class="quiz-error-msg"><strong>Not quite.</strong> The correct answer is <strong>A</strong>. PostgreSQL resolves schemas in the order they appear in <code>search_path</code>, left to right.</div>
  </div>

  <div class="quiz-question-block" data-correct="C">
    <div class="quiz-question">What was the root cause of the CockroachDB bug described in this post?</div>
    <div class="quiz-options">
      <div class="quiz-option" data-letter="A"><div><code>REGCLASS</code> casts are not supported inside PL/pgSQL UDFs.</div></div>
      <div class="quiz-option" data-letter="B"><div>The schema name was never stored in the dependency record at all.</div></div>
      <div class="quiz-option" data-letter="C"><div><code>DOid.String()</code> returns just the object name without schema qualification, making the subsequent name-based catalog lookup fail outside the default schema.</div></div>
      <div class="quiz-option" data-letter="D"><div>CockroachDB's catalog rejects schema-qualified names as invalid identifiers.</div></div>
    </div>
    <div class="quiz-success-msg"><strong>Correct!</strong> <code>DOid.String()</code> is designed for display purposes and strips schema qualification. Using it for a catalog lookup was a subtle misuse of the API - the name path worked fine within the default schema, which is why the bug only surfaced with non-default schemas.</div>
    <div class="quiz-error-msg"><strong>Not quite.</strong> The correct answer is <strong>C</strong>. The OID-path branch of the lookup already worked correctly. Only the name-path branch was broken, because <code>DOid.String()</code> returned a bare name that couldn't be resolved outside the default <code>public</code> schema.</div>
  </div>

  <div class="quiz-question-block" data-correct="B">
    <div class="quiz-question">How does CockroachDB's logic test format work?</div>
    <div class="quiz-options">
      <div class="quiz-option" data-letter="A"><div>Test cases are written in Go using the standard <code>testing</code> package and a mock database.</div></div>
      <div class="quiz-option" data-letter="B"><div>Plain text files describe SQL statements alongside their expected output; a Go test runner executes and validates them against a real database.</div></div>
      <div class="quiz-option" data-letter="C"><div>SQL files are compiled to Go bytecode and executed in a sandboxed VM.</div></div>
      <div class="quiz-option" data-letter="D"><div>Each test is a separate <code>.sql</code> file run against a live cluster via <code>psql</code>.</div></div>
    </div>
    <div class="quiz-success-msg"><strong>Correct!</strong> The plain text format means contributors can add regression tests without writing any Go - just append a new <code>subtest</code> block. The test itself doubles as documentation of the expected behavior.</div>
    <div class="quiz-error-msg"><strong>Not quite.</strong> The correct answer is <strong>B</strong>. The logic test runner is Go, but contributors interact with it purely through the plain text file format - no Go required to add a new test case.</div>
  </div>

  <div class="quiz-footer">
    <button class="quiz-next-btn">Next Question →</button>
  </div>

  <div class="quiz-results">
    <h4>Quiz Complete!</h4>
    <p>You scored <strong class="quiz-score">0</strong> out of <strong>4</strong>.</p>
  </div>
</div>
