<!-- Generated from src/prompt-templates by prompt-templates.test.ts. Do not edit; run `npx vitest run -u`. -->

# Summarize Interview

Turn a persona interview transcript (from the live voice interview or the text interview) into a summary card with a short title and actionable design findings.

- **Template:** `src/prompt-templates/canvas-summarize-interview.ts`
- **Model:** `gemini-4-hydrogen`
- **Input → output:** text → json
- **Sources:** `src/components/context-tray/llm/interview.ts`, `src/lib/actions/defs/media.ts`
- **Categories:** canvas, text-to-json, interview

## Slots

| Slot | Type | Required | Multiple | Description |
| --- | --- | --- | --- | --- |
| `personaName` | text | yes | no | Persona card title (falls back to "Synthetic User"). |
| `personaProfile` | text | no | no | Persona card body (falls back to the persona name). |
| `discussedItems` | text | no | yes | One line per discussed card, formatted as `- Item N ("<title>"): <body>` (title and body parts omitted when empty). Omit for an open conversation. |
| `transcript` | text | yes | yes | Transcript turns, one per line, formatted as `<speaker>: <text>`. |

## Example: Shampoo Bottle Findings

Summarize a short interview comparing two shampoo bottles.

### User

```text
Summarize the following live user-research interview with Maya Chen into concise, actionable design findings for a moodboard card.

Persona Profile:
34-year-old product designer who reads every ingredient list before buying shampoo. She wants packaging that looks calm and credible in a premium bathroom.

Discussed Canvas Items:
- Item 1 ("Matte Eucalyptus"): Rounded matte shampoo bottle with a eucalyptus green cap and minimal recessed label.
- Item 2 ("Gloss Botanica"): Glossy shampoo bottle with high-contrast botanical graphics and a metallic cap.

Interview Transcript:
Interviewer: Which of these two bottles would you pick up first, and why?
Maya Chen: The matte eucalyptus one. It looks quiet and honest, like it isn't trying to sell me anything.
Interviewer: What about the glossy botanical one?
Maya Chen: It's pretty, but the busy graphics make me suspect the formula is mostly fragrance. I'd also worry it shows every water spot.

Return a JSON object with:
- "title": a short, descriptive card title (max 6 words) referencing Maya Chen or the main finding.
- "body": a concise summary of key takeaways, pain points, preferences, and design recommendations (3-5 sentences or compact bullet points).
```

## Output schema

```json
{
  "type": "object",
  "properties": {
    "title": {
      "type": "string"
    },
    "body": {
      "type": "string"
    }
  },
  "required": [
    "title",
    "body"
  ]
}
```

## Presets

- **Shampoo Bottle Findings** — Summarize a short interview comparing two shampoo bottles.
- **Mouthwash Cap Findings** — Summarize a parent's reaction to a dosage cap concept.
- **Open Refill Conversation** — Summarize an open conversation with no discussed cards.
