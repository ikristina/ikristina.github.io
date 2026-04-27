---
layout: ../../layouts/BlogPost.astro
title: 'Developing a QR Code Generator: Build Interactive CLI Apps Using Bubble Tea'
date: '2025-09-28 21:00 MDT'
description: 'Build a QR code generator CLI with a gopher mascot overlay using Bubble Tea''s MVU architecture for easy and modular development'
tags: ['go', 'cli', 'bubbletea', 'qr-code']
showToc: false
---

~I'm not sure why I decided to make this, but I spent the last few hours on this random idea and I am hungry please send snacks.~

[Bubble Tea](https://github.com/charmbracelet/bubbletea) uses a **Model–View–Update (MVU)** architecture, making it easy to build **state-driven terminal applications**. It separates application logic from rendering, which is particularly useful for handling multi-step user interactions.

To demonstrate how BubbleTea works, I built a QR code generator CLI. The app asks the user for a name, a website, and optional notes, and produces a PNG QR code. To make it a little more fun and not just "using the library, I'm done", the QR code is being generated with a circular gopher mascot in the center (or any other image, I'm just obsessed with the Go mascot at this point of time.)

Not the most serious project, but I just wanted to try Bubble Tea in action.

![QR Code with Gopher Mascot](/images/qr-code-generator-main.png)

---

## The Bubble Tea Advantage

Bubble Tea uses the **Model-View-Update (MVU)** architecture:

* **Model**: keeps all the app state (current input, QR content, errors, etc.)

* **Update**: handles messages (key presses, timers) and updates the model

* **View**: renders the current state to the terminal

This pattern makes the app **modular** and very easy to extend. You just need to add a new state and update the view accordingly (`Update()`). Here's a tiny snippet showing how my app moves through the input steps:

```go
switch m.state {
case askName:
    m.name = userInput
    m.state = askSite
case askSite:
    m.site = userInput
    m.state = askNotes
case askNotes:
    m.notes = userInput
    m.state = done
    generateQRCode(m)
}
```

---

## Technical Deep Dive: QR Code with Circular Overlay

The tricky bit was putting a circular gopher over the QR code without breaking it. QR codes have **finder patterns, timing patterns, and data modules**. If you cover the wrong part, the scanners will fail. The [QR code library](https://github.com/skip2/go-qrcode) has an option for High quality/high error correction option: `qrcode.High` (~30% redundancy), so you can safely overlay an image in the center, just don't go past 30% coverage.

1. **Finder patterns** - the corner squares for orientation

2. **Timing patterns** - horizontal/vertical lines connecting corners

3. **Data modules** - the rest of the small squares that encode the information

---

### Creating a Circular Mask

To make the gopher circular, I had to mask it. Here's how to do this.

1. Resize the gopher to ~25% of the QR width.

2. Create an **alpha mask** that is opaque inside a circle and transparent outside.

    * had to look it up, I don't like working with images.

3. Use `draw.DrawMask` to apply the mask to both the gopher and a white background.

    * never used this library before, so that was… interesting.

```go
// Create circular mask
mask := image.NewAlpha(resized.Bounds())
cx, cy := resized.Bounds().Dx()/2, resized.Bounds().Dy()/2
radius := cx
for y := 0; y < resized.Bounds().Dy(); y++ {
    for x := 0; x < resized.Bounds().Dx(); x++ {
        dx, dy := x-cx, y-cy
        if dx*dx+dy*dy <= radius*radius {
            mask.SetAlpha(x, y, color.Alpha{A: 255}) // opaque inside
        } else {
            mask.SetAlpha(x, y, color.Alpha{A: 0})   // transparent outside
        }
    }
}
```

Then:

```go
// Draw circular white background
white := image.NewUniform(color.White)
draw.DrawMask(out, resized.Bounds().Add(offset), white, image.Point{}, mask, image.Point{}, draw.Over)

// Draw circular gopher
draw.DrawMask(out, resized.Bounds().Add(offset), resized, image.Point{}, mask, image.Point{}, draw.Over)
```

This ensures:

* The QR code remains scannable

* The gopher image is circular

* The white "safe zone" is circular, blending cleanly with the QR.

I guess, I didn't really need a white background, it just looks neater.

### Why it Works

* **High error correction** in QR code handles the missing modules of the QE code under the gopher image.

* **Masking** gives you true circles in Go, despite `image/draw` being rectangle-based.

---

## Takeaways

* The MVU pattern in Bubble Tea lets you **cleanly separate input handling from rendering**, so adding new features is easy.

* **Masking in Go is straightforward once you get the hang of it**. Draw the mask for both the background and the image.

* **QR codes can handle a center image** as long as error correction is high.

* I could probably make it prettier but I am not a front-end client facing person so... No.

Try it yourself: [https://github.com/ikristina/qr_gopher](https://github.com/ikristina/qr_gopher)

<div class="quiz-widget">
  <div class="quiz-header">
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
    Knowledge Check <span class="quiz-progress"></span>
  </div>

  <div class="quiz-question-block" data-correct="C">
    <div class="quiz-question">What architectural pattern does the Bubble Tea library use to structure terminal applications?</div>
    <div class="quiz-options">
      <div class="quiz-option" data-letter="A"><div>MVC (Model-View-Controller)</div></div>
      <div class="quiz-option" data-letter="B"><div>MVVM (Model-View-ViewModel)</div></div>
      <div class="quiz-option" data-letter="C"><div>MVU (Model-View-Update)</div></div>
      <div class="quiz-option" data-letter="D"><div>ECS (Entity Component System)</div></div>
    </div>
    <div class="quiz-success-msg"><strong>Correct! 🎉</strong> Bubble Tea relies on the Elm-inspired Model-View-Update architecture. State lives in the Model, events trigger the Update function, and the View just renders whatever the Model looks like right now.</div>
    <div class="quiz-error-msg"><strong>Not quite.</strong> The correct answer is <strong>C</strong>. Bubble Tea uses MVU, which enforces a strict, predictable flow of data and cleanly separates application logic from rendering.</div>
  </div>

  <div class="quiz-question-block" data-correct="B">
    <div class="quiz-question">How is it possible to put a custom image (like a Gopher) in the center of a QR code without breaking the scanners?</div>
    <div class="quiz-options">
      <div class="quiz-option" data-letter="A"><div>The image must be drawn using a special transparent alpha layer.</div></div>
      <div class="quiz-option" data-letter="B"><div>By generating the QR code with a "High" error correction level (~30% redundancy), the missing data modules under the image can be mathematically recovered.</div></div>
      <div class="quiz-option" data-letter="C"><div>The center of a QR code never contains data; it is reserved entirely for logos by the international standard.</div></div>
      <div class="quiz-option" data-letter="D"><div>You have to manually calculate the position and avoid the finder patterns.</div></div>
    </div>
    <div class="quiz-success-msg"><strong>Correct! 🎉</strong> High error correction adds up to 30% redundancy to the data modules. As long as your image doesn't cover the crucial corner "finder" patterns and stays within that 30% limit, scanners can still reconstruct the URL!</div>
    <div class="quiz-error-msg"><strong>Not quite.</strong> The correct answer is <strong>B</strong>. You rely entirely on the QR code's built-in error correction. By setting it to `qrcode.High`, it redundantly encodes the data, allowing the scanner to "guess" the missing pieces covered by your logo.</div>
  </div>

  <div class="quiz-question-block" data-correct="B">
    <div class="quiz-question">How do you draw a perfectly circular image in Go using the standard <code>image/draw</code> package, which is fundamentally rectangle-based?</div>
    <div class="quiz-options">
      <div class="quiz-option" data-letter="A"><div>By calling the undocumented <code>draw.Circle()</code> helper function.</div></div>
      <div class="quiz-option" data-letter="B"><div>By creating an Alpha mask (opaque inside the radius, transparent outside) and using <code>draw.DrawMask</code> to apply it over the rectangular image bounds.</div></div>
      <div class="quiz-option" data-letter="C"><div>By mathematically cropping the byte array of the PNG file before decoding it.</div></div>
      <div class="quiz-option" data-letter="D"><div>You can't; you must use an external C library like ImageMagick.</div></div>
    </div>
    <div class="quiz-success-msg"><strong>Correct! 🎉</strong> Masking is the secret! You manually calculate the distance from the center pixel. If it's less than the radius, set alpha to 255 (visible). If it's outside, set alpha to 0 (transparent), then apply it with `DrawMask`.</div>
    <div class="quiz-error-msg"><strong>Not quite.</strong> The correct answer is <strong>B</strong>. You use `image.NewAlpha` to create a mathematical circle of transparency/opacity, and pass it into `draw.DrawMask` to cut out your image perfectly.</div>
  </div>

  <div class="quiz-footer">
    <button class="quiz-next-btn">Next Question →</button>
  </div>
  
  <div class="quiz-results">
    <h4>Quiz Complete!</h4>
    <p>You scored <strong class="quiz-score">0</strong> out of <strong>3</strong>.</p>
  </div>
</div>
