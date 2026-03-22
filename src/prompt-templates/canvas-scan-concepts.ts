import { canvasScanConceptsPresets } from "./prompt-template.presets";
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

const template: PromptTemplateModule<CanvasScanConceptsVars, "instruction"> = {
  metadata: {
    title: "Scan Concepts",
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
