---
applyTo: "conceptualize/**"
---

# Feature: Conceptual Map

## What

A step where user and AI collaborate to map out what the Parti truly means

## Outcome

The step will produce a set of concepts (Words or short phrase) that best represent the Parti.
Each concept also has a one short sentence description.

## UI

User can perform these actions:

- Generate concepts: use Parti and existing concepts (if any) to generate new concepts that avoid repetition of the existing ones
- Edit a concept and its description
- Manually add a concept and its description
- Regenerate the concept based on its description
- Regenerate the description based on its concept
- Reject a concept: remove it from the list and move it to the rejected list (so we don't generate it again)
- Revert a rejection: move it back to the main list
- Favorite a concept: mark it as favorite, so we can prioritize it in the next step

## Logic

- Use Gemini in JSON mode via `streamGeminiText({ apiKey, input: prompt, json: true, signal })` from `src/lib/gemini-text.ts`
- Use @streamparser/json (already installed in package.json) to incrementally emit concepts

## Reference implementation of incremental structured output

See `streamConcepts$` in `generate-concepts.ts`: write each text delta from `streamGeminiText` into a `JSONParser`, and emit each array item from `parser.onValue` as it completes.
