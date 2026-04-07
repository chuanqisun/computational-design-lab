import { canvasScanMoodsPresets } from "./prompt-template.presets";
import type { PromptTemplateModule } from "./prompt-template.types";
import { toTextBlock } from "./prompt-template.utils";

const outputSchema = {
  type: "object",
  properties: {
    moods: {
      type: "array",
      items: {
        type: "object",
        properties: {
          mood: { type: "string" },
          arousal: { type: "number" },
        },
        required: ["mood", "arousal"],
      },
    },
  },
  required: ["moods"],
} as const;

export interface CanvasScanMoodsVars {
  instruction: string | string[];
  minOutputCount: number;
  maxOutputCount: number;
}

const template: PromptTemplateModule<CanvasScanMoodsVars, "instruction" | "minOutputCount" | "maxOutputCount"> = {
  metadata: {
    title: "Scan Moods",
    purpose: "Identify moods evoked by a referenced item and score their arousal levels.",
    sourceFiles: ["src/components/context-tray/llm/scan-moods.ts"],
    categories: ["canvas", "mixed-to-json", "mood-analysis"],
    inputType: "mixed",
    outputType: "json",
    outputSchema,
    slots: {
      instruction: {
        description: "User-side task wording sent with the item payload.",
        required: false,
        multiple: true,
        type: "text",
      },
      minOutputCount: {
        description: "Minimum number of moods to identify.",
        required: false,
        multiple: false,
        type: "number",
      },
      maxOutputCount: {
        description: "Maximum number of moods to identify.",
        required: false,
        multiple: false,
        type: "number",
      },
    },
  },
  presets: canvasScanMoodsPresets,
  template: ({ instruction, minOutputCount = 3, maxOutputCount = 5 }) => ({
    developer: `Analyze the provided item and identify ${minOutputCount}-${Math.max(minOutputCount, maxOutputCount)} moods it evokes. For each mood, provide a single English word with first letter Capitalized and an arousal level from 1 to 10, where 1 is calm/low energy and 10 is intense/high energy.

Return ONLY valid JSON matching this schema:
${JSON.stringify(outputSchema, null, 2)}`,
    user: toTextBlock(instruction, "Analyze this item for moods and arousal levels."),
  }),
};

export default template;
