import { canvasEnhanceImagePromptPresets } from "./prompt-template.presets";
import type { PromptTemplateModule } from "./prompt-template.types";
import { toTextBlock } from "./prompt-template.utils";

export interface CanvasEnhanceImagePromptVars {
  originalPrompt: string;
  cardContext: string | string[];
  qualityGoal: string | string[];
}

const template: PromptTemplateModule<CanvasEnhanceImagePromptVars, "originalPrompt" | "cardContext" | "qualityGoal"> = {
  metadata: {
    title: "Enhance Image Prompt",
    purpose:
      "Rewrite a basic image prompt into a higher quality image-generation instruction using card context and quality goals.",
    sourceFiles: ["src/components/canvas/ai-helpers.ts", "src/components/canvas/canvas.component.ts"],
    categories: ["canvas", "text-to-text", "prompt-optimization"],
    inputType: "text",
    outputType: "text",
    slots: {
      originalPrompt: {
        description: "Base prompt authored by the user or stored on the card.",
        required: true,
        multiple: false,
        type: "text",
      },
      cardContext: {
        description: "Context from the card or action that should shape the rewrite.",
        required: false,
        multiple: true,
        type: "text",
      },
      qualityGoal: {
        description: "Optional quality target for the rewritten prompt.",
        required: false,
        multiple: true,
        type: "text",
      },
    },
  },
  presets: canvasEnhanceImagePromptPresets,
  template: ({ originalPrompt = "", cardContext, qualityGoal }) => ({
    user: `You are an expert prompt engineer. Improve this prompt for an image generator to create a high quality image.

Original prompt: '${originalPrompt}'
Context from card: '${toTextBlock(cardContext, "General design exploration")}'
Quality goal: '${toTextBlock(qualityGoal, "Keep it descriptive but concise")}'

Keep it descriptive but concise. Return ONLY the enhanced prompt.`,
  }),
};

export default template;
