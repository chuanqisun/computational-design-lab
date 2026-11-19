<!-- Generated from src/prompt-templates by prompt-templates.test.ts. Do not edit; run `npx vitest run -u`. -->

# Summarize Trace To Workflow

Distill a recorded (and user-edited) action trace into a reusable AGENTS.md workflow that the Auto-Iterate agent can follow. Output thumbnails of the included steps (up to 12) are sent as image parts after the text; the reply is Markdown with any surrounding code fence stripped.

- **Template:** `src/prompt-templates/canvas-summarize-workflow.ts`
- **Model:** `gemini-4-hydrogen`
- **Input → output:** mixed → text
- **Sources:** `src/lib/workflows/summarize-agents-md.ts`, `src/lib/workflows/workflow-storage.ts`, `src/components/workflow/workflow-editor.component.ts`
- **Categories:** canvas, workflow, mixed-to-text, summarization

## Slots

| Slot | Type | Required | Multiple | Description |
| --- | --- | --- | --- | --- |
| `name` | text | yes | no | Workflow name from the editor (the UI passes "Untitled workflow" when blank). Also used as the H1. |
| `goal` | text | no | no | Workflow goal from the editor. Falls back to "(infer from the steps)" when empty. |
| `catalog` | text | yes | yes | Tool catalog, one line per registry action except perception actions, formatted as "- `name` (human-only): description" (the marker only for human-only actions). |
| `steps` | text | no | yes | Included trace steps, numbered in order, formatted as "N. [actor] action (HUMAN-ONLY) args=<JSON, truncated at 400 chars>" with an optional "\n   Note: <note>" line. Falls back to "(no steps)" when empty. |

## Example: Refill Concept Sprint

A recorded session from refill references to tested shampoo concepts.

### User

```text
You write AGENTS.md files (https://agents.md/): plain, high-signal Markdown instructions for an AI agent.

Distill the recorded design session below into a reusable workflow that an agent can follow on a mood-board canvas using the tools listed. The agent sees the board as a card table plus images, and calls tools by name.

Workflow name: Refill concept sprint
Goal: Turn refill-system references into tested premium shampoo concepts.

## Tool catalog (exact names)
- `select_cards`: Change which cards are selected. mode: replace (default) selects exactly cardIds; add/remove adjust the selection; all/none ignore cardIds.
- `search_references`: Search the web for visual references on a topic. Creates one card (title, details, reference image) per result. Input cards add context.
- `design_concepts`: Generate design concepts (title, description, rendered image) from the input cards and requirements.
- `iterate_designs`: Iterate on the input designs, optionally following a direction or feedback, producing improved variants.
- `run_user_testing`: Run synthetic user testing on the input designs: generate personas for a segment, have each rank the designs on a trait, and lay out persona, ranked copies and feedback cards in a grid. Rankings are returned in data.

## Recorded steps (edited by the user; notes explain intent)
1. [user] search_references args={"prompt":"premium shampoo refill pouch and countertop bottle","maxResults":6}
   Note: Keep only refill formats that look premium, not utilitarian.
2. [user] select_cards args={"cardIds":["search-1a","search-3c","search-4d"],"mode":"replace"}
3. [ai] design_concepts args={"count":3,"requirements":"Aluminium countertop bottle plus mono-material refill pouch"}
4. [user] run_user_testing args={"trait":"premium feel","segment":"urban professionals buying salon shampoo","numUsers":3}
5. [user] iterate_designs args={"count":2,"direction":"Make the refill step obvious from the bottle shape"}
   Note: Iterate only on the top-ranked design.

Images after the steps show what some steps produced (in step order).

Write the AGENTS.md with exactly these sections:
# Refill concept sprint
One short paragraph: the design objective.
## Tools
Bullet list of the tool names used (backticked, exactly as in the catalog) with parameter conventions that matter.
## Workflow
Numbered, generalized procedure. Never use raw card ids; describe targets by intent (e.g. "the three highest-ranked designs from the previous step", "the persona card"). Human-only steps become "Human step: <what the user must do>" and the agent must pause and ask the user.
## Aesthetic & Quality Criteria
Recurring visual, material, brand or evaluation criteria inferred from prompts, notes and images.
## Guardrails & Stop Conditions
Turn/card limits, when to stop, what never to do. Do not allow `clear_canvas` unless the user's notes explicitly ask for it.

Rules: only use tool names from the catalog; be concise (under 400 words); output only the Markdown, no code fences.
```

## Presets

- **Refill Concept Sprint** — A recorded session from refill references to tested shampoo concepts.
- **Mouthwash Mood To Studio** — Includes human-only capture and export steps.
