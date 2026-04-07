import type { PromptTemplateModule } from "./prompt-template.types";
import { toTextBlock } from "./prompt-template.utils";

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
  instruction: string | string[];
}

const canvasScanConceptsPresets = [
  {
    title: "Extract Bottle Cues",
    description: "Pull key form and finish concepts from packaging references.",
    values: {
      instruction: [
        "Distill the key bottle form, finish, and brand mood concepts from the provided shampoo references.",
      ],
    },
  },
  {
    title: "Extract Oral Care Signals",
    description: "Identify concepts that make mouthwash packaging feel trustworthy.",
    values: {
      instruction: [
        "Identify the 3-5 strongest concepts that make the mouthwash references feel clinically trustworthy and easy to use.",
      ],
    },
  },
  {
    title: "Extract Refill Ideas",
    description: "Focus concept extraction on sustainability and ritual.",
    values: {
      instruction: [
        "Distill the key concepts around sustainability, refill behavior, and countertop desirability from these references.",
      ],
    },
  },
];

const template: PromptTemplateModule<CanvasScanConceptsVars, "instruction"> = {
  metadata: {
    title: "Scan Concepts",
    purpose: "Distill key concepts from referenced canvas items.",
    sourceFiles: ["src/components/context-tray/llm/scan-concepts.ts"],
    categories: ["canvas", "mixed-to-json", "concept-extraction"],
    inputType: "mixed",
    outputType: "json",
    outputSchema,
    slots: {
      instruction: {
        description: "User instruction that shapes the conceptual scan.",
        required: false,
        multiple: true,
        type: "text",
      },
    },
  },
  presets: canvasScanConceptsPresets,
  template: ({ instruction }) => ({
    developer: `Analyze the provided input and distill 3-5 key concepts based on user instruction. Each concept should have a clear title and one short sentence description.

Return ONLY valid JSON matching this schema:
${JSON.stringify(outputSchema, null, 2)}`,
    user: toTextBlock(instruction, "Distill key concepts from the provided references."),
  }),
};

export default template;
