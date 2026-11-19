<!-- Generated from src/prompt-templates by prompt-templates.test.ts. Do not edit; run `npx vitest run -u`. -->

# Animate

Generate a short video from the selected canvas cards (Animate tool / animate action). Cards are sent in selection order: video cards as a video part, image cards as image parts (numbered Image1, Image2...), text-only cards as text parts. Annotated starting-frame sketches are appended as extra image parts. The final text part is the instruction: a generated image-role sentence group followed by the user's direction. Aspect ratio, duration, and task (text_to_video, image_to_video, reference_to_video, edit, extend) are request settings, not prompt text.

- **Template:** `src/prompt-templates/canvas-animate.ts`
- **Model:** `gemini-omni-1.2-flash`
- **Input → output:** mixed → video
- **Sources:** `src/components/context-tray/llm/animate.ts`, `src/components/context-tray/tools/animate.tool.ts`, `src/lib/actions/defs/media.ts`
- **Categories:** canvas, mixed-to-video, video-generation

## Slots

| Slot | Type | Required | Multiple | Description |
| --- | --- | --- | --- | --- |
| `textInputs` | text | no | yes | One text part per text-only card (no video or image), with lines `Title: ...`, `Body: ...`, `Image prompt: ...` for the non-empty fields. Sent in card order, interleaved with media parts, before the instruction. |
| `startingFrameImageId` | text | no | no | Image id given the "starting-frame" role (at most one, e.g. "Image1"). Adds "Use <id> as the starting frame." |
| `referenceImageIds` | text | no | yes | Image ids given the "reference" role (by default every image after the first, or all images when a video is selected). Adds a "visual reference(s), not as a starting frame(s)" sentence. |
| `annotatedSketchImageId` | text | no | no | Id of the appended annotated sketch for the starting frame (Image<number of images + 1>). Only used when the starting frame has annotations drawn in the Animate tool. |
| `instruction` | text | no | no | Motion, camera, pacing, and audio direction typed by the user (trimmed). If both this and the role sentences are empty, the action sends "Animate the selected content." |

## Example: Shampoo Cap Flip

One shampoo bottle render used as the starting frame.

### User

```text
Use Image1 as the starting frame. A hand enters from the right, flips open the eucalyptus green cap, and squeezes a small ribbon of shampoo. Slow push-in, soft studio light, gentle cap click.
```

## Presets

- **Shampoo Cap Flip** — One shampoo bottle render used as the starting frame.
- **Mouthwash Pour With References** — Starting frame plus two material references, with an annotated sketch on the starting frame.
- **Refill Pouch From Text** — Text-only card animated without images.
