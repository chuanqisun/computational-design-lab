<!-- Generated from src/prompt-templates by prompt-templates.test.ts. Do not edit; run `npx vitest run -u`. -->

# Search Reference Image

Second step of Search (search_references action): for each streamed search result, ask the image model (with Google web + image search grounding, 1:1, 1K) to find and render a representative reference image for the result card.

- **Template:** `src/prompt-templates/canvas-search-reference-image.ts`
- **Model:** `gemini-nano-banana-2.1`
- **Input → output:** text → image
- **Sources:** `src/lib/actions/defs/generate.ts`, `src/components/context-tray/llm/search-images.ts`
- **Categories:** canvas, text-to-image, search, references

## Slots

| Slot | Type | Required | Multiple | Description |
| --- | --- | --- | --- | --- |
| `resultTitle` | text | yes | no | Title of the search result (also the card title). |
| `resultDetails` | text | yes | no | Details of the search result (also the card body). |
| `searchTopic` | text | yes | no | The user's trimmed search prompt. |

## Example: Refill Pouch Reference

Image request for one result of a search on refillable shampoo packaging.

### User

```text
Search for and generate a clear, representative visual reference image of "Spouted Refill Pouch". Flexible stand-up pouch with a wide screw spout that decants shampoo into a reusable countertop bottle with minimal mess.
Search topic: refillable shampoo packaging. Clean single-subject presentation, no text labels or watermarks.
```

## Presets

- **Refill Pouch Reference** — Image request for one result of a search on refillable shampoo packaging.
- **Mouthwash Dosing Cap Reference** — Image request for one result of a search on mouthwash dosing caps.
