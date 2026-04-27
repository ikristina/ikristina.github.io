

---
layout: ../../layouts/BlogPost.astro
title: "Go Pointers: Stack vs Heap"
date: 2026-02-17 13:30
description: "Clarifying the misconception that passing pointers always causes heap allocations in Go with practical examples."
tags: ['go', 'performance', 'memory', 'pointers', 'stack', 'heap']
showToc: true
---

When passing pointers between functions in Go, a common misconception is that it always causes heap allocations. Let's clear this up with concrete examples.

## The Misconception

> "Passing pointers around creates heap allocations because the data needs to survive after the function returns."

This is partially true but misses the key point: where the allocation happens matters more than where the pointer goes.

## Example 1: Pointer from a Map

```go
type User struct {
    ID       string
    Name     string
    Email    string
    Settings map[string]string // Large nested data
}

// Global cache - values are on the heap
var userCache = map[string]*User{
    "user-123": {
        ID:    "user-123",
        Name:  "Alice",
        Email: "alice@example.com",
        Settings: map[string]string{
            "theme": "dark",
            "lang":  "en",
        },
    },
}

func GetUser(id string) *User {
    user := userCache[id]  // user is a pointer (8 bytes on stack)
    return user            // returning the pointer (8 bytes copied)
}

func ProcessUser(id string) {
    user := GetUser(id)           // user = 0x00c0001a2000 (stack)
    ValidateUser(user)            // passing 0x00c0001a2000 (stack)
    SendEmail(user.Email)         // accessing heap data via pointer
}

func ValidateUser(u *User) {
    // u is just a copy of the pointer address (8 bytes on stack)
    // The actual User struct is still on the heap in the map
    if u.Email == "" {
        panic("invalid user")
    }
}
```

### What's happening:

*   The `User` struct was allocated on the heap when the map was created.
*   `GetUser` returns a pointer (8-byte address) on the stack.
*   `ProcessUser` and `ValidateUser` copy that 8-byte address on their stacks.
*   **No new heap allocation occurs** from passing the pointer around.
*   The original struct stays in the heap where it was.

## Example 2: Creating a New Struct

```go
func CreateUser(name, email string) *User {
    user := &User{  // This DOES allocate on the heap
        ID:    generateID(),
        Name:  name,
        Email: email,
    }
    return user  // Returning pointer to heap-allocated struct
}

func main() {
    user := CreateUser("Bob", "bob@example.com")
    // user is a pointer to heap memory
    ProcessUser(user)  // Just passing the 8-byte address
}
```

### Why heap allocation?

*   The compiler sees `&User{...}` being returned.
*   The struct must outlive the function.
*   **Escape analysis** determines it must go on the heap.

## Example 3: Stack-Only Pointers

```go
func CalculateTotal(prices []float64) float64 {
    total := 0.0
    
    // ptr is on the stack, points to stack memory
    ptr := &total
    
    for _, price := range prices {
        *ptr += price  // Modifying via pointer
    }
    
    return *ptr  // Returning the value, not the pointer
}
```

### Stack-only scenario:

*   `total` is on the stack.
*   `ptr` (the pointer) is also on the stack.
*   Nothing escapes the function.
*   **No heap allocation**.

## The Key Insight

```go
// Scenario A: Pointer from existing heap data
func GetFromCache(id string) *Config {
    return cache[id]  // ✅ No new allocation
}

// Scenario B: Creating new data
func CreateConfig() *Config {
    return &Config{...}  // ⚠️ Heap allocation HERE
}

// Scenario C: Passing the pointer around
func Process(cfg *Config) {
    Validate(cfg)    // ✅ No allocation (just copying 8 bytes)
    Transform(cfg)   // ✅ No allocation (just copying 8 bytes)
    Save(cfg)        // ✅ No allocation (just copying 8 bytes)
}
```

## Performance Implications

### Cheap operations:

*   Copying a pointer value (8 bytes).
*   Passing pointers between functions.
*   Returning pointers from functions.

### Expensive operations:

*   Initial heap allocation.
*   Garbage collection of heap objects.
*   Fetching large structs from database/cache.

## Common Mistake

```go
// ❌ Thinking this is expensive
func HandleRequest(userID string) {
    user := GetUserFromCache(userID)  // Just getting a pointer
    ValidateUser(user)                // Just passing 8 bytes
    ProcessUser(user)                 // Just passing 8 bytes
    SaveUser(user)                    // Just passing 8 bytes
}

// ✅ The real cost is here
func GetUserFromCache(id string) *User {
    // If cache miss, THIS is expensive:
    user := FetchFromDatabase(id)  // Network I/O + deserialization
    cache[id] = user               // Heap allocation
    return user
}
```

## Practical Takeaway

When you see code like:

```go
config := configMap[key]
service.DoSomething(config)
helper.Process(config)
validator.Check(config)
```

Don't worry about passing the pointer around - it's just copying 8 bytes.

**Do worry about:**

*   Where the **initial allocation** happened.
*   Whether you're fetching more data than you need.
*   Whether the data is already cached.

The pointer itself is cheap. The **data it points to**, and **how you got it**, is what matters.

<div class="quiz-widget">
  <div class="quiz-header">
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
    Knowledge Check <span class="quiz-progress"></span>
  </div>

  <div class="quiz-question-block" data-correct="B">
    <div class="quiz-question">What is the primary misconception developers have about passing pointers in Go?</div>
    <div class="quiz-options">
      <div class="quiz-option" data-letter="A"><div>That passing a pointer creates a deep copy of the underlying struct.</div></div>
      <div class="quiz-option" data-letter="B"><div>That simply passing an existing pointer into a function triggers a new heap allocation.</div></div>
      <div class="quiz-option" data-letter="C"><div>That pointers are always stored in the L1 CPU cache.</div></div>
      <div class="quiz-option" data-letter="D"><div>That the Go garbage collector ignores pointer references.</div></div>
    </div>
    <div class="quiz-success-msg"><strong>Correct! 🎉</strong> Once data is allocated, passing a pointer to it around your app doesn't create new heap allocations. You're just passing the address.</div>
    <div class="quiz-error-msg"><strong>Not quite.</strong> The correct answer is <strong>B</strong>. Passing an existing pointer just copies the memory address onto the stack. It does not cause a new heap allocation.</div>
  </div>

  <div class="quiz-question-block" data-correct="B">
    <div class="quiz-question">When you pass a pointer to a function in a 64-bit Go program, exactly how much data is being copied onto the call stack?</div>
    <div class="quiz-options">
      <div class="quiz-option" data-letter="A"><div>The exact byte size of the struct the pointer references.</div></div>
      <div class="quiz-option" data-letter="B"><div>8 bytes (the size of a 64-bit memory address).</div></div>
      <div class="quiz-option" data-letter="C"><div>0 bytes, because pointers are passed entirely in CPU registers.</div></div>
      <div class="quiz-option" data-letter="D"><div>It depends on whether the struct contains slices or maps.</div></div>
    </div>
    <div class="quiz-success-msg"><strong>Correct! 🎉</strong> A pointer is just an integer representing a memory address. On a 64-bit system, that's exactly 8 bytes.</div>
    <div class="quiz-error-msg"><strong>Not quite.</strong> The correct answer is <strong>B</strong>. A pointer is just a memory address, which is 8 bytes long on 64-bit architectures, regardless of how huge the underlying struct is.</div>
  </div>

  <div class="quiz-question-block" data-correct="A">
    <div class="quiz-question">How does the Go compiler decide whether a newly created struct belongs on the heap instead of the stack?</div>
    <div class="quiz-options">
      <div class="quiz-option" data-letter="A"><div>Through "Escape Analysis", which detects if the struct's lifetime outlives the function that created it.</div></div>
      <div class="quiz-option" data-letter="B"><div>By checking if the struct is larger than 64KB.</div></div>
      <div class="quiz-option" data-letter="C"><div>It relies entirely on a special <code>//go:heap</code> pragma comment.</div></div>
      <div class="quiz-option" data-letter="D"><div>Any struct created with the <code>&</code> operator is automatically sent to the heap.</div></div>
    </div>
    <div class="quiz-success-msg"><strong>Correct! 🎉</strong> If you return a pointer from a function, the compiler knows the data must survive after the function's stack frame is destroyed. It "escapes" to the heap.</div>
    <div class="quiz-error-msg"><strong>Not quite.</strong> The correct answer is <strong>A</strong>. The compiler runs Escape Analysis. If a reference to the data leaves the function (e.g. returning a pointer), it escapes to the heap.</div>
  </div>

  <div class="quiz-question-block" data-correct="C">
    <div class="quiz-question">Is it possible to use pointers in Go without triggering any heap allocations?</div>
    <div class="quiz-options">
      <div class="quiz-option" data-letter="A"><div>No. All pointers in Go are allocated on the heap by design.</div></div>
      <div class="quiz-option" data-letter="B"><div>Yes, but only if the garbage collector is explicitly disabled.</div></div>
      <div class="quiz-option" data-letter="C"><div>Yes, if the pointer and the data it points to never escape the local function scope, both can safely live on the stack.</div></div>
      <div class="quiz-option" data-letter="D"><div>Only if the pointer references a primitive type (like <code>int</code>) and not a struct.</div></div>
    </div>
    <div class="quiz-success-msg"><strong>Correct! 🎉</strong> If a pointer is just used locally inside a function and isn't returned or saved globally, the compiler keeps both the data and the pointer on the stack.</div>
    <div class="quiz-error-msg"><strong>Not quite.</strong> The correct answer is <strong>C</strong>. As long as the reference doesn't "escape" the function, the Go compiler is smart enough to allocate both the value and the pointer pointing to it entirely on the stack.</div>
  </div>

  <div class="quiz-question-block" data-correct="B">
    <div class="quiz-question">When optimizing Go code that passes pointers heavily, where should you actually focus your attention?</div>
    <div class="quiz-options">
      <div class="quiz-option" data-letter="A"><div>Rewriting the functions to pass copies by value instead of using pointers to relieve stack pressure.</div></div>
      <div class="quiz-option" data-letter="B"><div>The initial allocation of the data, and whether you're fetching more data than necessary.</div></div>
      <div class="quiz-option" data-letter="C"><div>Setting the pointer to <code>nil</code> immediately after the function call to assist the garbage collector.</div></div>
      <div class="quiz-option" data-letter="D"><div>Reducing the absolute number of function parameters.</div></div>
    </div>
    <div class="quiz-success-msg"><strong>Correct! 🎉</strong> Don't waste time worrying about passing an 8-byte pointer around. Worry about the network call, database query, or JSON deserialization that created the huge struct in the first place!</div>
    <div class="quiz-error-msg"><strong>Not quite.</strong> The correct answer is <strong>B</strong>. Passing the pointer is cheap. The performance killer is the work required to *create* the object the pointer points to (like parsing JSON or querying a DB).</div>
  </div>

  <div class="quiz-footer">
    <button class="quiz-next-btn">Next Question →</button>
  </div>
  
  <div class="quiz-results">
    <h4>Quiz Complete!</h4>
    <p>You scored <strong class="quiz-score">0</strong> out of <strong>5</strong>.</p>
  </div>
</div>