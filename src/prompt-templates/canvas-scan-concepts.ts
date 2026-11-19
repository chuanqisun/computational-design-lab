import type { PromptTemplateModule } from "./prompt-template.types";

const outputSchema = {
  type: "object",
  properties: {
    concepts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
        },
        required: ["title", "description"],
      },
    },
  },
  required: ["concepts"],
} as const;

export interface CanvasScanConceptsVars {
  instruction: string;
  itemTexts: string[];
}

const canvasScanConceptsPresets = [
  {
    title: "Extract Bottle Cues",
    description: "Pull key form concepts from shampoo packaging references (shape lens).",
    values: {
      instruction: "Analyze the geometric shapes, contours, silhouettes, and profiles present in the selected items.",
      itemTexts: [
        "Eucalyptus Repair: A rounded shampoo bottle with a warm white matte body, eucalyptus green cap, and subtle spa-inspired restraint.",
        "Soft Shoulder Ritual: A palm-friendly silhouette that makes restorative care feel premium and tactile.",
      ],
    },
  },
  {
    title: "Extract Oral Care Signals",
    description: "Identify how mouthwash packaging makes people feel (emotions lens).",
    values: {
      instruction:
        "Analyze the selected items and describe how people feel when interacting with them. Focus on emotional responses, moods, and psychological impact.",
      itemTexts: [
        "Measured Clarity: A transparent mouthwash bottle built around trust, visible formula clarity, and an intuitive dosage cap.",
        "Fresh Precision: Clinical geometry and crisp label architecture for a premium pharmacy shelf presence.",
      ],
    },
  },
  {
    title: "Extract Refill Ideas",
    description: "Focus concept extraction on refill behavior and ritual (interactions lens).",
    values: {
      instruction:
        "Describe how people interact with the selected items. Focus on gestures, ergonomics, and functional usage patterns.",
      itemTexts: [
        "Refill Ritual: A countertop-worthy shampoo refill pouch with pearl matte film and a translucent product window.",
        "Countertop System: Reusable primary bottle plus elegant refill format designed for sustainable routines.",
      ],
    },
  },
];

const template: PromptTemplateModule<CanvasScanConceptsVars, "instruction" | "itemTexts"> = {
  metadata: {
    title: "Scan Concepts",
    purpose: "Distill 3-5 key concepts from the selected canvas items (text and images) through a chosen scan lens.",
    sourceFiles: ["src/components/context-tray/llm/scan-concepts.ts", "src/lib/actions/defs/generate.ts"],
    categories: ["canvas", "mixed-to-json", "concept-extraction"],
    inputType: "mixed",
    outputType: "json",
    model: "gemini-4-hydrogen",
    outputSchema,
    slots: {
      instruction: {
        description:
          "Scan lens instruction (one of SCAN_LENSES in src/lib/actions/defs/generate.ts: emotions, associations, symbolism, shape, material, color, tactility, acoustics, interactions, narrative).",
        required: true,
        multiple: false,
        type: "text",
      },
      itemTexts: {
        description:
          "One text part per selected item that has a body, formatted as `<title>: <body>`. Item images are sent as separate image parts, each placed before that item's text.",
        required: false,
        multiple: true,
        type: "text",
      },
    },
  },
  presets: canvasScanConceptsPresets,
  template: ({ instruction = "", itemTexts = [] }) => ({
    developer: `Analyze the provided input and distill 3-5 key concepts based on user instruction. Each concept should have a clear title and one short sentence description.`,
    user: [instruction, ...itemTexts].join("\n\n"),
  }),
};

export default template;
