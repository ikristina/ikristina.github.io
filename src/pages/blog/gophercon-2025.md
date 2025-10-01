---
layout: ../../layouts/BlogPost.astro
title: 'Highlights and Insights from GopherCon 2025'
date: '2025-09-24 08:00 MDT'
description: 'A long-overdue impression from this year’s GopherCon, which took place in New York from August 26th to 28th.'
tags: ['go', 'conference', 'gophercon', 'community']
showToc: true
---

A long-overdue impression from this year's GopherCon, which took place in New York from August 26th to 28th.

This was my second time attending GopherCon. The last time I went was in San Diego in 2023, and the event felt much larger back then. There were two tracks of talks happening simultaneously, and many companies were present to showcase their work. This year, it was held in New York, and although it was still a great event with interesting sessions and plenty to learn, it felt smaller. Nonetheless, it was a good time, and I learned a lot and met interesting people. I will definitely return in the future.

I'd like to share some takeaways from the talks and my impressions of the conference.

## The Venue

New York. It was my first time visiting the city. When people ask me about New York, I often say it felt like a bigger version of Toronto, haha.

The conference took place at the Javits Convention Center. It was a large venue, which felt somewhat empty due to the size of our crowd. And our crowd wasn't small. There were great views all around, including some rooftop gardens.
<figure class="image-figure">
<img src="/images/gophercon-2025-javits.jpg" alt="Javits center from the sky" />
<figcaption>Source: http://www.greenroofs.com</figcaption>
</figure>

## Meetups and Socials

**Monday**.

Just like last time, the conference kicked off with the Women Who Go meetup. If you haven't heard of them, it's a group of women who code and are passionate about Go. I'm pretty introverted and a bit shy, so this was once again a step out of my comfort zone. But hey, there were drinks and some food, which really helped. It was great to see familiar faces from the last event and meet new people to share experiences and chat about work life. Networking in action. It's incredible how welcoming this community is.

**Tuesday**.

It was a full day of workshops. After that, there were two meetups. One of them was for neurodivergent folks. I really wanted to go (and even RSVP'ed!) but I was so exhausted after the full day of workshops that I just went back to the hotel and stayed in. I forget how tiring it is to be around people for 9 hours straight, haha. The workshop was intense and packed with information to learn too so I really needed to recharge and be alone. Next time, I will definitely attend.

Another meetup that day, I believe, was for Asian individuals.
<figure class="image-figure">
<img src="/images/gophercon-2025-meetups.jpeg" alt="meetups collage picture" />
<figcaption>Photo was posted on Gophers #gophercon slack channel </figcaption>
</figure>

**Wednesday.**

That was the first day of the actual conference full of talks. After that, there was a rooftop party, nicely sponsored by Skool. I had never heard of them before, but since then I've seen a few links online to communities on Skool. [Baader-Meinhof phenomenon](https://science.howstuffworks.com/life/inside-the-mind/human-brain/baader-meinhof-phenomenon.htm) is wild! I mostly sat there sipping wine, haha. Last time, in 2023, I went with my manager, which made networking a bit easier. I could listen to him talk to people and join the conversation. Plus, I met an extroverted fellow gopher who I hung out most of the time with, which really helped. It was a bit disappointing that she couldn't make it this time. Still, I managed to meet a few interesting people thanks to their people skills, for sure not mine.

**Thursday**.

So, no afterparty this time either. Last time, there was a big afterparty with several raffle prizes, and I won a Beats headset. This time, they only had two golden tickets as prizes for future conference attendance. I didn't have high expectations, but the difference was surprisingly drastic.

## Workshop Day

I was initially interested in three workshops:

1. Full-Day Workshop: AI-Powered Systems in Go: RAG & Tool Calling, by Ardan Labs.

    * Because everyone is talking about AI.

2. Full-Day Workshop: Ultimate Software Design and Engineering, by Ardan Labs - Bill Kennedy.

    * Because it's the most relevant topic to what I currently do.

3. Community Day: TinyGo Hardware Hack Session

    * I was interested in this one the last time I went to GopherCon and thought maybe I would attend it next time. When I was buying the tickets, it wasn't on the schedule yet. Unfortunately, it is on the same day as all the workshops, so you can't do both. This one was free. It would be interesting to flash some microcontrollers with a program written in *tinyGo*.

    * My interest might come from nostalgia for my school years when I studied Electrical Engineering and did some embedded programming in Assembly and C.

In the end, I chose the Ultimate Software Design workshop and didn't regret it. Bill Kennedy is a great teacher who explains complex topics clearly. I wasn't expecting to dive into any low-level design stuff, but surprisingly we learned about some Golang-specific CPU-level features that are important when working with Kubernetes.

By the end of the day, I was exhausted. I'm not sure if I'll want to attend a full-day workshop again in the future. However, I definitely recommend this workshop to anyone interested in the topic.

---

## Talks

The talks were spread over two days with just one stream.

There were several talks about AI. I attend conferences mainly to see what others are working on. I've been at my current company for over seven years, and sometimes it's hard to imagine what else is out there. GopherCon is a great opportunity to learn about that. This time, I felt like I was missing out on something big. It seemed like everyone was involved in some kind of AI agent-related projects, except me, haha.

It's always insightful to hear talks from the Go team about the internals and new features of the language.

[https://github.com/gophercon/talks](http://github.com/gophercon/talks)

*Some talks I really liked:*

### **Go's Next Frontier.**

By Cameron Balahan, Google.

[Link to the slides.](https://github.com/gophercon/talks/blob/main/2025/Go's%20Next%20Frontier/GopherCon%20New%20York%202025_%20Go's%20Next%20Frontier.pdf)

On the wave of the AI taking our jobs talks, the very first talk was about how great Go is for working with LLMs. Go has a lot of "safety" features included, which means that all the LLMs were/are learning on good code, which means the code generated is expected to be of higher quality compared to many other languages.
<figure class="image-figure">
<img src="/images/gophercon-2025-go-for-ai.png" alt="comparison of languages for generating and validating code" />
</figure>
Another interesting take is that the role of an engineer is shifting. AI helps to produce the code faster but that increases the cost of reviewing the code.

### **The Code You Reviewed is Not the Code You Built**

By Jess McClintock, Google.

Another great talk from Google introducing/re-introducing a security tool called capslock ([github](https://github.com/google/capslock)).

The talk was about different ways vulnerabilities make their way into production code (including into open source code!). Capslock checks if newly added (or existing) code introduce any new capabilities that shouldn't be there.

Related blog post: [https://security.googleblog.com/2023/09/capslock-what-is-your-code-really.html](https://security.googleblog.com/2023/09/capslock-what-is-your-code-really.html)

### **Building a Decentralized Social Media App with Go and ATProto**

by Gautam Dey

[**Slides**](https://github.com/gophercon/talks/blob/main/2025/Building%20a%20Decentralized%20Social%20Media%20App%20with%20Go%20and%20ATProto/Building%20a%20Decentralized%20Social%20Apps%20with%20_Go%20and%20@Proto.pdf)**.**

[https://pkg.go.dev/github.com/bluesky-social/indigo](https://pkg.go.dev/github.com/bluesky-social/indigo)

A talk about ATProto, a protocol on which the social media platform Blue Sky is built. What they are trying to do is one open system, many apps, but your account and content aren't trapped inside a single platform. Similar to like you have an email on gmail but you can send emails to other platforms, but for social media.

**Main components:**

* **Personal Data Repository (PDS):** Each user's "server" that stores their posts, follows, likes, etc.

* **DID (Decentralized Identifier):** Your portable identity, not tied to one company.

* **Relay (a.k.a. indexer):** Services that crawl PDSes, index content, and serve it to apps.

* **App View:** The front-end apps (like Bluesky) that present feeds, profiles, moderation, etc.

* **Lexicon schemas:** Define the data formats so everything is interoperable.

**How they all relate to each other:**

1. **User signs up:** A DID is created for identity, linked to a PDS.

2. **User posts:** Post is written into their PDS.

3. **Relay fetches:** Relays crawl PDSes and replicate records into searchable indexes.

4. **App shows content:** An app (like Bluesky) queries relays to assemble feeds.

5. **Moderation/feeds:** Independent services can apply filtering, ranking, or moderation rules on the shared data.

6. **Portability:** If the user switches apps or PDS providers, their DID + repo move with them, so nothing is lost.

### [**Analysis and Transformation Tools for Go Codebase Modernization**](https://web.archive.org/web/20250912120944/https://www.gophercon.com/agenda/session/1557387)

Alan Donovan, a co-author of [the blue book](https://www.gopl.io/).

> Alan is a member of Google's Go team in New York, where he develops analysis and refactoring tools including **gopls, the language server for Go, which turns any editor into a Go IDE.**

For example, [neovim](https://threadsofthought.hashnode.dev/a-beginners-guide-to-configuring-neovim-for-go-programming).

Anyway, the talk introduced an analysis tool used in Go to help update your codebase. Although Go is designed to be backward compatible, new features are constantly added and become standard. So, it's a good practice to update and refactor your codebase to remove outdated and deprecated functions. The [analysis](https://pkg.go.dev/golang.org/x/tools/go/analysis) tool is used to analyze the codebase and report on deprecated function calls. You set up an analyzer that identifies deprecated functions and reports a diagnostic at the function call. Here is an example of a modernizer that was provided:

```go
package readfile; import (...)

var Analyzer = &analysis.Analyzer{
 Name: "readfile",
 Doc:  "report uses of deprecated ioutil.ReadFile",
 Run:  run,
 ...
}

func run(pass *analysis.Pass) (any, error) {
 for _, file := range pass.Files {
        ast.Inspect(file, func (n ast.Node) bool {
            if call, ok := n.(*ast.CallExpr); ok && isFunctionNamed(
                    typeutil.Callee(pass.TypesInfo, call), "io/ioutil", "ReadFile") {
                       pass.ReportRangef(call, "ioutil.Readfile is deprecated; use os.ReadFile")
                }
                return true
        })
    }
    return nil, nil
}
```

* To use the analyzer as a standalone command, you can use [singlechecker](https://pkg.go.dev/golang.org/x/tools/go/analysis/singlechecker).

* [The slides and talk](https://github.com/gophercon/talks/blob/main/2025/Analysis%20and%20transformation%20tools%20for%20Go%20code%20modernization/adonovan-modernization-handout.pdf) for further information.

* I'm assuming this is what used by different IDEs too when they hint you on your ancient practices.

### [**Next-Gen AI Tooling with MCP Servers in Go**](https://www.gophercon.com/agenda/session/1557399)

I'm not sure I actually attended this talk. Might've zoned out if I have. Which is upsetting, it did introduce [https://github.com/modelcontextprotocol/go-sdk](https://github.com/modelcontextprotocol/go-sdk) which will be (I believe) fun to play with at some point.

### [**Advancing Go Garbage Collection with Green Tea**](https://web.archive.org/web/20250902082940/https://www.gophercon.com/agenda/session/1557401)

by Michael Knyszek

Loving me some talks about Go internals. So another interesting talk from Google people was about the new experimental GC that is available in 1.25.

Currently Go's GC uses a **concurrent mark-and-sweep** algorithm to automatically reclaim memory no longer used by the program. If an object has no references to it, it is marked for removal (at sweep stage).

With the new Green Tea GC, something called **span-based scanning** is used. Instead of scanning small objects individually, Green Tea scans large contiguous memory blocks ("spans"), grouping objects of the same size for more efficient CPU and cache utilization.

I can't remember the details. They did report, however, 10-50% improvements in garbage collection time for some allocation-heavy programs which is pretty significant.

No slides available. I hope the team will publish the talk videos soon.

### [Understanding Escape Analysis](https://web.archive.org/web/20251001135035/https://www.gophercon.com/agenda/session/1647415)

This one I just wanted to mention in the context that it was given by Bill Kennedy and it (or on a similar topic) was supposed to be given by someone else originally, who couldn't make it to the conference. So Bill Kennedy 15 min before the talk agreed to give a talk instead. Which produced the following joke:
<figure class="image-figure">
<img src="/images/gophercon-2025-joke.png" alt="joke from slack" />
<figcaption>The screenshot is from Gopher's #gophercon slack channel. <a href="https://join.slack.com/t/gophers/shared_invite/zt-3e9qs1l5g-kj3rVDYgLW7T3AGLrqE9mA">This is an invite if you are not there but want to be</a> </figcaption>
</figure>

I want to look into escape analysis more though. I feel like we don't leverage these tools enough in our team's day-to-day work.

---

## Conclusions

* GopherCon is a fun and inclusive event, offering a great opportunity to connect with the Go community and learn from industry experts.

* Lots of AI going on. The conference highlighted the growing influence of AI in the tech world, with many talks focusing on AI-related projects and tools (which I have not mentioned here as much).

* Bill Kennedy's workshop on software design was great, providing valuable insights into Golang-specific features. And as we saw, he can just give ad-hoc talks any time.

* The event's atmosphere was welcoming, and it was a great chance to network and share experiences with fellow Gophers. Looking ahead, there is anticipation for the next GopherCon, with potential locations being considered in **Canada** or **Mexico**.

<figure class="image-figure">
<img src="/images/gophercon-2025-canada.png" alt="canada or mexico" />
<figcaption>The screenshot is from Gopher's #gophercon slack channel.
</figure>

* Overall, GopherCon 2025 was a rewarding experience, and I look forward to attending future events.
