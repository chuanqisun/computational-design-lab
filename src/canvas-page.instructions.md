---
applyTo: "**/canvas-page.ts"
---

# Layout

## Composition

- Top of the screen is a header bar
  - Contains a button to setup API connections
- Rest of the screen is the main area, split into two parts:
  - Left side: main canvas for user to manipulate objects. Similar to Miro and Figma
    - See details in [canvas documentation](./components//canvas/canvas.instructions.md)
- Right side: context menu tray, always visible and activated based on the state of the app
  - Default: suggest new ideas to add to canvas
  - When one item is selected: display caption and labels, and suggest more like this
  - When multiple items are selected: display shared pattern, and suggest more like the group## Z-Index

Top and Main areas are on the same level.

## Scroll

The main canvas area should have horizontal and vertical scrolling.
