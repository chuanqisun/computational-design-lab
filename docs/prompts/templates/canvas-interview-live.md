<!-- Generated from src/prompt-templates by prompt-templates.test.ts. Do not edit; run `npx vitest run -u`. -->

# Live Voice Interview

Gemini Live session that role-plays a synthetic-user persona card in a spoken user-research interview. The persona prompt is the session system instruction (voice is the persona's prebuilt Gemini Live voice); the selected design cards are sent once as an initial client-content turn, after which the interviewer's microphone audio streams in and the persona answers in audio. Input and output transcriptions become the transcript that is later summarized.

- **Template:** `src/prompt-templates/canvas-interview-live.ts`
- **Model:** `gemini-3.8-live`
- **Input → output:** mixed → audio
- **Sources:** `src/components/context-tray/llm/interview.ts`, `src/components/context-tray/tools/user-testing.tool.ts`, `src/lib/gemini-voices.ts`
- **Categories:** canvas, live-audio, interview

## Slots

| Slot | Type | Required | Multiple | Description |
| --- | --- | --- | --- | --- |
| `personaName` | text | yes | no | Persona card title (falls back to "Synthetic User"). |
| `personaProfile` | text | yes | no | Persona card body (falls back to "A thoughtful design research participant."). |
| `personaGender` | text | no | no | Persona gender from the card metadata ("female", "male", or anything else = "neutral"). Neutral personas get an extra gender-neutral instruction line. |
| `contextItems` | text | no | yes | One entry per selected non-persona card: its text lines ("Title: …", "Body: …", and "Image prompt: …" only when the card has no image). Each card's image, if any, is attached as an inline image part right after its text. Empty list = open conversation with no context turn. |

## Example: Shampoo Bottle Walkthrough

Voice-interview an ingredient-conscious shopper about two shampoo bottle concepts.

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
```

## Presets

- **Shampoo Bottle Walkthrough** — Voice-interview an ingredient-conscious shopper about two shampoo bottle concepts.
- **Mouthwash Dosage Cap** — Discuss a single mouthwash concept (image not yet rendered) with a trust-seeking parent.
- **Open Refill Conversation** — No cards selected: an open conversation about refill habits with a gender-neutral persona.
