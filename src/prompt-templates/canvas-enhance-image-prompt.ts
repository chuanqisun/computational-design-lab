import type { PromptTemplateModule } from "./prompt-template.types";
import { toTextBlock } from "./prompt-template.utils";

export interface CanvasEnhanceImagePromptVars {
  originalPrompt: string;
  cardContext: string | string[];
  qualityGoal: string | string[];
}

const canvasEnhanceImagePromptPresets = [
  {
    title: "Shampoo Hero Upgrade",
    description: "Rewrite a basic shampoo render prompt into a stronger commercial brief.",
    values: {
      originalPrompt: "A shampoo bottle on a white background",
      cardContext: [
        "Rounded botanical repair shampoo bottle with matte warm white body and eucalyptus green cap.",
        "The brand should feel premium, calm, and naturally science-backed.",
      ],
      qualityGoal: [
        "Push toward premium beauty advertising quality.",
        "Keep the prompt concise and image-model friendly.",
      ],
    },
  },
  {
    title: "Mouthwash Clarity Upgrade",
    description: "Improve a mouthwash prompt for transparency and clinical polish.",
    values: {
      originalPrompt: "A mouthwash bottle product shot",
      cardContext: [
        "Clear rectangular mouthwash bottle with visible aqua rinse and measured dosage cap.",
        "Target a clean pharmacy-plus-premium retail mood.",
      ],
      qualityGoal: ["Emphasize glasslike clarity, clean reflections, and label legibility."],
    },
  },
  {
    title: "Refill Editorial Upgrade",
    description: "Sharpen a refill pouch prompt into an editorial sustainability render.",
    values: {
      originalPrompt: "A refill pouch for shampoo",
      cardContext: [
        "Stand-up refill pouch with pearl matte finish, translucent window, and compact closure.",
        "The concept should feel elevated rather than utilitarian.",
      ],
      qualityGoal: ["Create a premium editorial render rather than a generic ecommerce image."],
    },
  },
];

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
