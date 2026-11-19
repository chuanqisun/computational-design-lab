import type { PromptTemplateModule } from "./prompt-template.types";
import { toTextBlock } from "./prompt-template.utils";
import type { CardView } from "../lib/actions/types";
import { buildAgentSystemInstruction, buildInitialAgentPrompt } from "../lib/agent/agent-prompt";
import { renderObservationText } from "../lib/agent/observe";
import { BUILT_IN_WORKFLOWS } from "../lib/workflows/builtin-workflows";

export interface CanvasAutoIterateAgentVars {
  agentsMd: string;
  goal?: string;
  observation: string;
}

const builtInMd = (id: string) =>
  BUILT_IN_WORKFLOWS.find((workflow) => workflow.id === `builtin:${id}`)?.agentsMd ?? "";

const card = (id: string, kind: CardView["kind"], title: string, body: string, x: number, y: number): CardView => ({
  id,
  kind,
  title,
  body,
  isSelected: false,
  x,
  y,
  width: 240,
  height: 320,
});

/** Preset observation text, rendered by the app's own formatter. Availability mirrors the action registry rules. */
function presetObservation(cards: CardView[], selectedIds: string[]): string {
  const viewCards = cards.map((item) => ({ ...item, isSelected: selectedIds.includes(item.id) }));
  const targets = viewCards.filter((item) => item.isSelected);
  const boardEmpty = cards.length === 0;
  const withImage = targets.filter((item) => item.kind === "image" || item.kind === "mixed").length;
  const withText = targets.filter((item) => !!item.body).length;
  const checks: [string, string | true][] = [
    ["observe", true],
    ["view_cards", boardEmpty ? "The board is empty" : true],
    ["wait_for_idle", true],
    ["select_cards", true],
    ["move_cards", boardEmpty ? "The board is empty" : true],
    ["delete_cards", targets.length >= 1 ? true : "Select at least 1 card"],
    ["clear_canvas", "Not allowed by the workflow"],
    ["duplicate_cards", targets.length >= 1 ? true : "Select at least 1 card"],
    ["edit_card", true],
    ["add_card", true],
    ["render_image", true],
    ["search_references", true],
    ["visualize_concept", withText >= 1 ? true : "Select at least one card with text"],
    ["scan_concept", targets.length >= 1 ? true : "Select at least 1 card"],
    ["design_concepts", targets.length >= 1 ? true : "Select at least 1 card"],
    ["iterate_designs", targets.length >= 1 ? true : "Select at least 1 card"],
    ["blend_images", targets.length >= 2 ? true : "Select at least 2 cards"],
    ["regenerate_image", true],
    ["edit_image", withImage >= 1 ? true : "Select a card with an image"],
    ["animate", targets.length >= 1 ? true : "Select a card with video, image, or text content"],
    ["run_user_testing", targets.length >= 1 ? true : "Select at least one design card"],
    ["interview_persona", "Select exactly one synthetic user card (plus any cards to discuss)"],
  ];
  return renderObservationText({
    state: {
      cards: viewCards,
      selectedIds,
      pending: [],
      running: [],
      viewport: { x: 0, y: 0, width: 1440, height: 900 },
      hasApiKey: true,
    },
    available: checks.filter(([, result]) => result === true).map(([name]) => name),
    unavailable: checks
      .filter((entry): entry is [string, string] => entry[1] !== true)
      .map(([name, reason]) => ({ name, reason })),
  });
}

const canvasAutoIterateAgentPresets = [
  {
    title: "Refill Moodboard From Brief",
    description: "Built-in 'Brief to moodboard' workflow on an empty board with a refill-system brief.",
    values: {
      agentsMd: builtInMd("brief-to-moodboard"),
      goal: "Refill system for a premium botanical shampoo: aluminium countertop bottle plus mono-material refill pouch.",
      observation: presetObservation([], []),
    },
  },
  {
    title: "Mouthwash Design Sprint",
    description: "Built-in 'Design sprint' workflow with three selected inspiration cards.",
    values: {
      agentsMd: builtInMd("design-sprint"),
      goal: "Family mouthwash bottle that feels clinically credible; test on appeal with parents of young kids.",
      observation: presetObservation(
        [
          card(
            "upload-7c1e",
            "mixed",
            "Dosage Cap",
            "Beveled bottle with a clear measuring cap and front label window.",
            0,
            0,
          ),
          card(
            "search-2a9f",
            "mixed",
            "Aqua Clarity",
            "Transparent aqua liquid, crisp white labels, bathroom shelf light.",
            260,
            0,
          ),
          card(
            "scan-51d0",
            "text",
            "Calm Trust",
            "Gentle, clinical, reassuring; soft rounded edges and no loud graphics.",
            520,
            0,
          ),
        ],
        ["upload-7c1e", "search-2a9f", "scan-51d0"],
      ),
    },
  },
  {
    title: "Shampoo Material Study",
    description: "Built-in 'Material study' workflow without a brief; two reference cards selected.",
    values: {
      agentsMd: builtInMd("material-study"),
      goal: "",
      observation: presetObservation(
        [
          card("upload-0b44", "image", "Frosted Glass", "", 0, 0),
          card(
            "search-e3a7",
            "mixed",
            "Sugarcane PE",
            "Bio-based matte bottle plastic with a soft, slightly waxy hand feel.",
            260,
            0,
          ),
        ],
        ["upload-0b44", "search-e3a7"],
      ),
    },
  },
];

const template: PromptTemplateModule<CanvasAutoIterateAgentVars, "agentsMd" | "goal" | "observation"> = {
  metadata: {
    title: "Auto-Iterate Agent",
    purpose:
      "System instruction and first user turn of the Auto-Iterate agent loop, which runs the active workflow (AGENTS.md) on the canvas through Gemini function calling. Tool declarations are not prompt text: they are generated from the agent-visible actions in the action registry (src/lib/actions/defs/*.ts), and each turn restricts tool_choice to the actions currently available. Later turns send function results: the action result JSON, any result media, and a fresh observation (plus thumbnails of newly created cards) after the last call.",
    sourceFiles: [
      "src/lib/agent/agent-prompt.ts",
      "src/lib/agent/observe.ts",
      "src/lib/agent/auto-iterate.ts",
      "src/lib/agent/agent-controller.ts",
      "src/lib/workflows/builtin-workflows.ts",
      "src/components/workflow/workflow-section.component.ts",
    ],
    categories: ["canvas", "agent", "workflow", "text-to-tool-calls"],
    inputType: "mixed",
    outputType: "text",
    model: "gemini-4-neon",
    slots: {
      agentsMd: {
        description:
          "Body of the active workflow (AGENTS.md), trimmed and appended to the base agent prompt after a --- separator.",
        required: true,
        multiple: false,
        type: "text",
      },
      goal: {
        description:
          'Optional run brief from the Workflow tray. When empty, the first turn says "Follow the workflow." instead.',
        required: false,
        multiple: false,
        type: "text",
      },
      observation: {
        description:
          "Board observation text as rendered by renderObservationText: card table (id | kind | title | body | flags | x,y), selection, running work, changes since last look, user actions, and available/unavailable actions with reasons. Sent as a separate text part after the brief.",
        required: true,
        multiple: false,
        type: "text",
      },
    },
  },
  presets: canvasAutoIterateAgentPresets,
  template: ({ agentsMd = "", goal, observation }) => ({
    developer: buildAgentSystemInstruction(agentsMd),
    user: [buildInitialAgentPrompt(goal), toTextBlock(observation)].filter(Boolean).join("\n\n"),
  }),
};

export default template;
