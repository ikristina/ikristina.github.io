

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