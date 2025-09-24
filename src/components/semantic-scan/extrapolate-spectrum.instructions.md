---
applyTo: "**/extrapolate-spectrum.ts"
---

<input>
- A text prompt
- A paragraph describing a spectrum of property, e.g. Mild <-> Aggressive
</input>

<output>
- A pair of alternative text prompts, describing the two ends of the spectrum
</output>

<format>
```json 
{
  "leftEnd": "text prompt for one end of the spectrum",
  "rightEnd": "text prompt for the other end of the spectrum"
}
```
