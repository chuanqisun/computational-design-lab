---
applyTo: "**/workbench-page.ts"
---

## Purpose

Simple single page web app showing a set of product design tools.

## Layout

### Layout/Header

- Showing app name "Workbench" and setup buton

## Layout/Main

- Scrollable
- From top to bottom, each section is a stand alone tool that takes some input and user takes action to produce output

## Tools

Generally, tools should have similar input and output interface.
Output should be easily copy/pasted into other tools' input
When running multiple times, we want to accumate the output if there is any generative process involved.
