import type { PromptTemplateModule } from "./prompt-template.types";

export interface CanvasSummarizeWorkflowVars {
  name: string;
  goal?: string;
  catalog: string[];
  steps: string[];
}

const catalogLines = {
  select_cards:
    "- `select_cards`: Change which cards are selected. mode: replace (default) selects exactly cardIds; add/remove adjust the selection; all/none ignore cardIds.",
  add_media:
    "- `add_media` (human-only): Bring outside media (camera capture, uploaded files, pasted images or cards) onto the board.",
  search_references:
    "- `search_references`: Search the web for visual references on a topic. Creates one card (title, details, reference image) per result. Input cards add context.",
  scan_concept:
    "- `scan_concept`: Analyze the input cards through a lens and create concept cards (title, description, rendered image).",
  design_concepts:
    "- `design_concepts`: Generate design concepts (title, description, rendered image) from the input cards and requirements.",
  iterate_designs:
    "- `iterate_designs`: Iterate on the input designs, optionally following a direction or feedback, producing improved variants.",
  blend_images:
    "- `blend_images`: Blend two or more input cards (images and text) into one new image following an instruction.",
  run_user_testing:
    "- `run_user_testing`: Run synthetic user testing on the input designs: generate personas for a segment, have each rank the designs on a trait, and lay out persona, ranked copies and feedback cards in a grid. Rankings are returned in data.",
  export_cards: "- `export_cards` (human-only): Open the selected cards in Studio (new browser tab).",
};

const canvasSummarizeWorkflowPresets = [
  {
    title: "Refill Concept Sprint",
    description: "A recorded session from refill references to tested shampoo concepts.",
    values: {
      name: "Refill concept sprint",
      goal: "Turn refill-system references into tested premium shampoo concepts.",
      catalog: [
        catalogLines.select_cards,
        catalogLines.search_references,
        catalogLines.design_concepts,
        catalogLines.iterate_designs,
        catalogLines.run_user_testing,
      ],
      steps: [
        '1. [user] search_references args={"prompt":"premium shampoo refill pouch and countertop bottle","maxResults":6}\n   Note: Keep only refill formats that look premium, not utilitarian.',
        '2. [user] select_cards args={"cardIds":["search-1a","search-3c","search-4d"],"mode":"replace"}',
        '3. [ai] design_concepts args={"count":3,"requirements":"Aluminium countertop bottle plus mono-material refill pouch"}',
        '4. [user] run_user_testing args={"trait":"premium feel","segment":"urban professionals buying salon shampoo","numUsers":3}',
        '5. [user] iterate_designs args={"count":2,"direction":"Make the refill step obvious from the bottle shape"}\n   Note: Iterate only on the top-ranked design.',
      ],
    },
  },
  {
    title: "Mouthwash Mood To Studio",
    description: "Includes human-only capture and export steps.",
    values: {
      name: "Mouthwash mood to Studio",
      goal: "",
      catalog: [
        catalogLines.add_media,
        catalogLines.scan_concept,
        catalogLines.blend_images,
        catalogLines.export_cards,
      ],
      steps: [
        "1. [user] add_media (HUMAN-ONLY) args={}\n   Note: Photograph two competitor mouthwash bottles on the bathroom shelf.",
        '2. [user] scan_concept args={"lens":"emotions","cardIds":["scan-8f2","scan-a17"]}',
        '3. [user] blend_images args={"instruction":"Blend the calm clinical mood into one beveled bottle with a measuring cap","cardIds":["scan-8f2","concept-c01"]}',
        '4. [user] export_cards (HUMAN-ONLY) args={"cardIds":["blend-5e0"]}',
      ],
    },
  },
];

const template: PromptTemplateModule<CanvasSummarizeWorkflowVars, "name" | "goal" | "catalog" | "steps"> = {
  metadata: {
    title: "Summarize Trace To Workflow",
    purpose:
      "Distill a recorded (and user-edited) action trace into a reusable AGENTS.md workflow that the Auto-Iterate agent can follow. Output thumbnails of the included steps (up to 12) are sent as image parts after the text; the reply is Markdown with any surrounding code fence stripped.",
    sourceFiles: [
      "src/lib/workflows/summarize-agents-md.ts",
      "src/lib/workflows/workflow-storage.ts",
      "src/components/workflow/workflow-editor.component.ts",
    ],
    categories: ["canvas", "workflow", "mixed-to-text", "summarization"],
    inputType: "mixed",
    outputType: "text",
    model: "gemini-4-hydrogen",
    slots: {
      name: {
        description:
          'Workflow name from the editor (the UI passes "Untitled workflow" when blank). Also used as the H1.',
        required: true,
        multiple: false,
        type: "text",
      },
      goal: {
        description: 'Workflow goal from the editor. Falls back to "(infer from the steps)" when empty.',
        required: false,
        multiple: false,
        type: "text",
      },
      catalog: {
        description:
          'Tool catalog, one line per registry action except perception actions, formatted as "- `name` (human-only): description" (the marker only for human-only actions).',
        required: true,
        multiple: true,
        type: "text",
      },
      steps: {
        description:
          'Included trace steps, numbered in order, formatted as "N. [actor] action (HUMAN-ONLY) args=<JSON, truncated at 400 chars>" with an optional "\\n   Note: <note>" line. Falls back to "(no steps)" when empty.',
        required: false,
        multiple: true,
        type: "text",
      },
    },
  },
  presets: canvasSummarizeWorkflowPresets,
  template: ({ name = "", goal, catalog = [], steps = [] }) => ({
    user: `You write AGENTS.md files (https://agents.md/): plain, high-signal Markdown instructions for an AI agent.

Distill the recorded design session below into a reusable workflow that an agent can follow on a mood-board canvas using the tools listed. The agent sees the board as a card table plus images, and calls tools by name.

Workflow name: ${name}
Goal: ${goal || "(infer from the steps)"}

## Tool catalog (exact names)
${catalog.join("\n")}

## Recorded steps (edited by the user; notes explain intent)
${steps.join("\n") || "(no steps)"}

Images after the steps show what some steps produced (in step order).

Write the AGENTS.md with exactly these sections:
# ${name}
One short paragraph: the design objective.
## Tools
Bullet list of the tool names used (backticked, exactly as in the catalog) with parameter conventions that matter.
## Workflow
Numbered, generalized procedure. Never use raw card ids; describe targets by intent (e.g. "the three highest-ranked designs from the previous step", "the persona card"). Human-only steps become "Human step: <what the user must do>" and the agent must pause and ask the user.
## Aesthetic & Quality Criteria
Recurring visual, material, brand or evaluation criteria inferred from prompts, notes and images.
## Guardrails & Stop Conditions
Turn/card limits, when to stop, what never to do. Do not allow \`clear_canvas\` unless the user's notes explicitly ask for it.

Rules: only use tool names from the catalog; be concise (under 400 words); output only the Markdown, no code fences.`,
  }),
};

export default template;
