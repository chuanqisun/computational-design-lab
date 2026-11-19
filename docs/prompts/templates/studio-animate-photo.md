<!-- Generated from src/prompt-templates by prompt-templates.test.ts. Do not edit; run `npx vitest run -u`. -->

# Animate Photo

Animate a staged studio photo into a short video. The photo is sent as the starting-frame image part, followed by one text part combining the animation instructions and sound description. Requested at 9:16 with the default 4s duration.

- **Template:** `src/prompt-templates/studio-animate-photo.ts`
- **Model:** `gemini-omni-1.2-flash`
- **Input → output:** mixed → video
- **Sources:** `src/lib/studio-ai.ts`, `src/components/generative-video/generate-video-gemini.ts`, `src/components/generative-video/generative-video.ts`, `src/components/photo-gallery/photo-gallery.component.ts`
- **Categories:** studio, mixed-to-video, video-generation

## Slots

| Slot | Type | Required | Multiple | Description |
| --- | --- | --- | --- | --- |
| `instructions` | text | yes | no | Animation instructions from the Animate dialog (trimmed), falling back to the photo's stored animation prompt. |
| `soundDescription` | text | no | no | Sound description from the Animate dialog (trimmed), falling back to the generated one. Appended as " Sound: <description>" when non-empty. |
| `hasStartFrame` | boolean | no | no | Whether the staged photo is sent as the starting-frame image (always true in the studio flow). Adds the "Use Image1 as the starting frame." prefix. Defaults to true. |

## Example: Shampoo Cap Flip

Animate a staged shampoo photo with a cap-flip interaction and matching sound.

### User

```text
Use Image1 as the starting frame. The hand flips open the cap, squeezes a small ribbon of shampoo, and closes the bottle with a soft snap. Sound: A soft plastic click as the cap opens, a gentle squelch of thick shampoo, then a muted snap as the cap closes.
```

## Presets

- **Shampoo Cap Flip** — Animate a staged shampoo photo with a cap-flip interaction and matching sound.
- **Mouthwash Pour** — Animate a staged mouthwash photo pouring into its dosage cap.
- **Refill Pouch Decant, No Sound** — Animate a refill pouch transfer with the sound description left empty.
