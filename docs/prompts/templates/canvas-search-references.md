<!-- Generated from src/prompt-templates by prompt-templates.test.ts. Do not edit; run `npx vitest run -u`. -->

# Search References

Search the web (google_search tool) for distinct real-world references on a topic and stream them back as JSON results; each result becomes a card. Images of the selected cards are sent as image parts before the text. Afterwards, the search_references action renders one reference image per result with the image model, using the prompt `Search for and generate a clear, representative visual reference image of "<title>". <details>\nSearch topic: <prompt>. Clean single-subject presentation, no text labels or watermarks.`

- **Template:** `src/prompt-templates/canvas-search-references.ts`
- **Model:** `gemini-4-hydrogen`
- **Input → output:** mixed → json
- **Sources:** `src/components/context-tray/llm/search-images.ts`, `src/lib/actions/defs/generate.ts`
- **Categories:** canvas, mixed-to-json, reference-search

## Slots

| Slot | Type | Required | Multiple | Description |
| --- | --- | --- | --- | --- |
| `prompt` | text | yes | no | Search topic entered by the user (trimmed). |
| `contextText` | text | no | yes | Title, body, and image prompt of each selected card (empty fields skipped), one per line. Omitted from the prompt when empty. |
| `maxResults` | number | yes | no | Number of results to request (action default 9, max 9). Extra streamed results are ignored. |

## Example: Refillable Shampoo Systems

Search for real refill systems with no cards selected.

### User

```text
Search online to find the top 9 most representative, distinct real-world products, references, or projects for the request below.
For each result, return:
- "title": exact, concise name (product, project, or reference title, max 6 words).
- "details": precise, concise 1-2 sentence description of its key visual features, materials/form, and why it is a strong reference.
Keep entries accurate, specific, and non-redundant.

Request: Refillable shampoo bottle systems with countertop-worthy primary bottles
```

## Output schema

```json
{
  "type": "object",
  "properties": {
    "results": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "title": {
            "type": "string"
          },
          "details": {
            "type": "string"
          }
        },
        "required": [
          "title",
          "details"
        ]
      }
    }
  },
  "required": [
    "results"
  ]
}
```

## Presets

- **Refillable Shampoo Systems** — Search for real refill systems with no cards selected.
- **Mouthwash Dosage Caps** — Search for dosage cap references using a selected concept card as context.
- **Pouch Materials** — Search for mono-material refill pouch references from a selected image card.
