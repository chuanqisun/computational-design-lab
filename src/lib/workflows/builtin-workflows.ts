import type { SavedWorkflow } from "./workflow-storage";

export interface BuiltInWorkflow extends SavedWorkflow {
  builtIn: true;
  summary: string;
}

const builtIn = (id: string, name: string, summary: string, agentsMd: string): BuiltInWorkflow => ({
  id: `builtin:${id}`,
  name,
  summary,
  agentsMd: agentsMd.trim(),
  createdAt: 0,
  updatedAt: 0,
  builtIn: true,
});

export const BUILT_IN_WORKFLOWS: BuiltInWorkflow[] = [
  builtIn(
    "brief-to-moodboard",
    "Brief to moodboard",
    "Research references for the brief, read their mood, and visualize it.",
    `
# Brief to moodboard
Turn a short design brief into a focused moodboard: references, the feelings they evoke, and a visual synthesis.

## Tools
- \`search_references\` (\`prompt\` = the brief, \`maxResults\` 6)
- \`view_cards\` to look at results before choosing
- \`select_cards\`
- \`scan_concept\` with \`lens\` "emotions"
- \`visualize_concept\` with \`style\` "abstract"

## Workflow
1. Use the run brief as the topic; if there is none, use the text of the selected cards. If neither exists, ask: "Human step: describe the brief."
2. Call \`search_references\` with the brief (\`maxResults\` 6).
3. Call \`view_cards\` on the new reference cards and pick the 3 that best fit the brief.
4. Call \`scan_concept\` with \`lens\` "emotions" on those 3 cards.
5. Call \`visualize_concept\` with \`style\` "abstract" on the emotion cards.

## Aesthetic & Quality Criteria
Coherent palette and mood across picks; prefer distinctive, high-quality imagery over generic stock photos.

## Guardrails & Stop Conditions
At most 8 actions. Never delete the user's cards and never call \`clear_canvas\`. Stop after the visualization and summarize the mood in one sentence.
`,
  ),
  builtIn(
    "design-sprint",
    "Design sprint",
    "Generate concepts, test them with synthetic users, and iterate on the winner.",
    `
# Design sprint
A compact design loop: concepts from the selected inspiration, synthetic user testing, then one iteration on the winner.

## Tools
- \`design_concepts\` (\`count\` 3)
- \`run_user_testing\` (\`trait\`, \`numUsers\` 3)
- \`view_cards\`
- \`iterate_designs\` (\`direction\` from the test feedback, \`count\` 2)

## Workflow
1. Use the selected cards as inspiration; if nothing is selected, ask: "Human step: select the inspiration cards."
2. Call \`design_concepts\` on them with \`count\` 3, using the run brief as \`requirements\`.
3. Call \`run_user_testing\` on the 3 new design cards with \`trait\` "appeal" (or the trait named in the brief) and \`numUsers\` 3.
4. Read the rankings and feedback in the result; call \`view_cards\` on the most-preferred design.
5. Call \`iterate_designs\` on that design with \`count\` 2 and a \`direction\` that addresses the most common feedback.

## Aesthetic & Quality Criteria
Designs must stay true to the inspiration's materials and mood; iterations should fix concrete feedback, not restyle everything.

## Guardrails & Stop Conditions
At most 8 actions. Never call \`clear_canvas\`. Stop after the iteration and name the winning design and what changed.
`,
  ),
  builtIn(
    "material-study",
    "Material study",
    "Analyze materials and touch, blend them into a sample, and refine it.",
    `
# Material study
Explore the materials in the selection and produce one refined material sample image.

## Tools
- \`scan_concept\` with \`lens\` "material" and "tactility"
- \`view_cards\`
- \`blend_images\` (\`instruction\`)
- \`edit_image\` (\`instruction\`, optional \`regions\`)

## Workflow
1. Use the selected cards; if fewer than 2 are selected, ask: "Human step: select at least two reference cards."
2. Call \`scan_concept\` with \`lens\` "material" on the selection.
3. Call \`scan_concept\` with \`lens\` "tactility" on the selection.
4. Call \`view_cards\` on the new concept cards and choose the 2 most compatible materials.
5. Call \`blend_images\` on those 2 cards with an \`instruction\` describing a close-up physical material sample combining them.
6. Call \`view_cards\` on the blend, then \`edit_image\` once to fix the most obvious flaw (mark it with \`regions\`).

## Aesthetic & Quality Criteria
Photographic close-up, soft daylight, believable physical texture; no text or logos.

## Guardrails & Stop Conditions
At most 9 actions. Never call \`clear_canvas\`. Stop after one edit.
`,
  ),
  builtIn(
    "persona-interview",
    "Persona interview",
    "Interview one synthetic user about the selected designs and capture findings.",
    `
# Persona interview
Get qualitative feedback on the selected designs from one synthetic user.

## Tools
- \`run_user_testing\` (\`numUsers\` 1) when no persona exists yet
- \`view_cards\`
- \`interview_persona\` (\`cardIds\` = one persona card + the designs, \`questions\`)

## Workflow
1. If the board has a card tagged synthetic-user, use it; otherwise call \`run_user_testing\` on the selected designs with \`numUsers\` 1 and \`trait\` from the brief (default "usefulness").
2. Call \`view_cards\` on the designs to ground your questions in what they look like.
3. Call \`interview_persona\` with the persona card plus the designs and 4 open questions: first impression, where they would use it, what feels wrong, what would make them choose it.

## Aesthetic & Quality Criteria
Questions are open-ended, specific to visible details, and never leading.

## Guardrails & Stop Conditions
At most 5 actions. One interview only. Never call \`clear_canvas\`. Stop after the interview summary card appears.
`,
  ),
  builtIn(
    "motion-teaser",
    "Motion teaser",
    "Pick the strongest image, polish it, and turn it into a short video.",
    `
# Motion teaser
Turn the strongest image on the board into a short animated teaser.

## Tools
- \`view_cards\`
- \`render_image\` (\`prompt\`, \`cardIds\` as reference)
- \`animate\` (\`instruction\`, \`duration\` "4s")
- \`wait_for_idle\`

## Workflow
1. Call \`view_cards\` on up to 6 image cards (selected first, otherwise the most recent) and pick the strongest one.
2. Call \`render_image\` with that card as reference and a \`prompt\` for a clean hero shot of the same subject on a simple background.
3. Call \`animate\` on the new hero image with \`duration\` "4s" and an \`instruction\` for a slow orbiting camera move with soft light changes.
4. Call \`wait_for_idle\` (\`timeoutS\` 300), then \`view_cards\` on the video card to confirm it worked.

## Aesthetic & Quality Criteria
Calm, premium product-film feel; subject stays recognizable; no text overlays.

## Guardrails & Stop Conditions
At most 6 actions and only one \`animate\` call. Never call \`clear_canvas\`. Stop after confirming the video.
`,
  ),
];
