import type { PromptTemplateModule } from "./prompt-template.types";
import { toTextBlock } from "./prompt-template.utils";

export interface CanvasScanMoodsVars {
  instruction: string | string[];
  outputCount: number;
}

const template: PromptTemplateModule<CanvasScanMoodsVars, "instruction" | "outputCount"> = {
  metadata: {
    title: "Scan Moods",
    sourceFiles: ["src/components/context-tray/llm/scan-moods.ts"],
    categories: ["canvas", "mixed-to-json", "mood-analysis"],
    inputType: "mixed",
    outputType: "json",
    slots: {
      instruction: {
        description: "User-side task wording sent with the item payload.",
        required: false,
        multiple: true,
        type: "text",
      },
      outputCount: {
        description: "Target number of moods to identify.",
        required: false,
        multiple: false,
        type: "number",
      },
    },
  },
  template: ({ instruction, outputCount = 5 }) => ({
    developer: `Analyze the provided item and identify 3-${Math.max(3, outputCount)} moods it evokes. For each mood, provide a single English word with first letter Capitalized and an arousal level from 1 to 10, where 1 is calm/low energy and 10 is intense/high energy.`,
    user: toTextBlock(instruction, "Analyze this item for moods and arousal levels."),
  }),
};

export default template;
