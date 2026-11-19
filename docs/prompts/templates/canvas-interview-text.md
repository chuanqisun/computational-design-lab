<!-- Generated from src/prompt-templates by prompt-templates.test.ts. Do not edit; run `npx vitest run -u`. -->

# Text Interview

Text equivalent of the live voice interview, used by the interview_persona action when questions are given. Uses the same persona system prompt plus a text-mode instruction. Each question is a separate interaction chained via previous_interaction_id; the selected cards' context parts are sent only with the first question. The questions and answers form the transcript that is then summarized into a card.

- **Template:** `src/prompt-templates/canvas-interview-text.ts`
- **Model:** `gemini-4-hydrogen`
- **Input → output:** mixed → text
- **Sources:** `src/components/context-tray/llm/interview-text.ts`, `src/components/context-tray/llm/interview.ts`, `src/lib/actions/defs/media.ts`
- **Categories:** canvas, mixed-to-text, interview

## Slots

| Slot | Type | Required | Multiple | Description |
| --- | --- | --- | --- | --- |
| `personaName` | text | yes | no | Persona card title (falls back to "Synthetic User"). |
| `personaProfile` | text | yes | no | Persona card body (falls back to "A thoughtful design research participant."). |
| `personaGender` | text | no | no | Persona gender from the card metadata ("female", "male", or anything else = "neutral"). Neutral personas get an extra gender-neutral instruction line. |
| `contextItems` | text | no | yes | One entry per selected non-persona card: its text lines ("Title: …", "Body: …", and "Image prompt: …" only when the card has no image). Each card's image, if any, is attached as an image part right after its text. Sent with the first question only. |
| `questions` | text | yes | yes | Interview questions (1-8). Each is sent as its own user turn, in order, after the model has answered the previous one. |

## Example: Shampoo Bottle Q&A

Ask an ingredient-conscious shopper to compare two shampoo bottle concepts.

### System instruction

```text
You are role-playing a synthetic user research participant in a live voice interview.

Persona Name: Maya Chen
Persona Profile:
34-year-old product designer who reads every ingredient list before buying shampoo. She wants packaging that looks calm and credible in a premium bathroom.

Instructions:
- Stay fully in character as Maya Chen throughout the conversation. Never break character or mention being an AI.
- Speak naturally, concisely, and conversationally—like a real person in a live voice interview.
- The interviewer has selected 2 design items on the canvas to discuss with you (provided in the conversation context with their text and images). Engage naturally in a spoken user-research interview about these selected items from your persona's honest perspective—react to specific visual details, strengths, friction points, and personal preferences.
- This interview happens in text. Answer each question in 2-4 natural sentences, in first person, as Maya Chen.
```

### User

```text
Here are the 2 selected canvas items we are discussing in this interview:

Item 1:
Title: Matte Eucalyptus
Body: Rounded matte shampoo bottle with a eucalyptus green cap and minimal recessed label.

Item 2:
Title: Gloss Botanica
Body: Glossy shampoo bottle with high-contrast botanical graphics and a metallic cap.

Which of these two bottles would you pick up first on the shelf, and why?

What on either label makes you trust or doubt the ingredients?

How would each bottle look in your bathroom after a month of use?
```

## Presets

- **Shampoo Bottle Q&A** — Ask an ingredient-conscious shopper to compare two shampoo bottle concepts.
- **Mouthwash Trust Check** — Probe a parent's trust in a mouthwash dosage cap concept.
- **Refill Habits Interview** — Open-ended questions about refill routines with no design cards selected.
