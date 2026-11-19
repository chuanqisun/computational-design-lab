import type { PromptTemplateModule } from "./prompt-template.types";

export interface CanvasEnhanceImagePromptVars {
  originalPrompt: string;
  cardContext: string;
}

const canvasEnhanceImagePromptPresets = [
  {
    title: "Shampoo Hero Upgrade",
    description: "Rewrite a basic shampoo render prompt into a stronger commercial brief.",
    values: {
      originalPrompt: "A shampoo bottle on a white background",
      cardContext: "User regeneration request",
    },
  },
  {
    title: "Mouthwash Clarity Upgrade",
    description: "Improve a mouthwash prompt for transparency and clinical polish.",
    values: {
      originalPrompt: "A mouthwash bottle product shot with visible aqua rinse and a measured dosage cap",
      cardContext: "User regeneration request",
    },
  },
  {
    title: "Refill Editorial Upgrade",
    description: "Sharpen a refill pouch prompt into an editorial sustainability render.",
    values: {
      originalPrompt: "A pearl matte refill pouch for shampoo in an editorial sustainability setting",
      cardContext: "User regeneration request",
    },
  },
];

const template: PromptTemplateModule<CanvasEnhanceImagePromptVars, "originalPrompt" | "cardContext"> = {
  metadata: {
    title: "Enhance Image Prompt",
    purpose:
      "Rewrite a card's image prompt (or a user-supplied prompt) into a higher quality image-generation prompt before re-rendering the card's image.",
    sourceFiles: ["src/components/canvas/ai-helpers.ts", "src/lib/actions/defs/generate.ts"],
    categories: ["canvas", "text-to-text", "prompt-optimization"],
    inputType: "text",
    outputType: "text",
    model: "gemini-4-hydrogen",
    slots: {
      originalPrompt: {
        description: "Prompt passed to regenerate_image, or the card's stored image prompt.",
        required: true,
        multiple: false,
        type: "text",
      },
      cardContext: {
        description:
          'Context string. The only current caller (regenerate_image) always passes the literal "User regeneration request".',
        required: true,
        multiple: false,
        type: "text",
      },
    },
  },
  presets: canvasEnhanceImagePromptPresets,
  // Whitespace (trailing space, 6-space indents) mirrors the template literal in ai-helpers.ts exactly.
  template: ({ originalPrompt = "", cardContext = "User regeneration request" }) => ({
    user: `You are an expert prompt engineer. Improve this prompt for an image generator to create a high quality image. 
      
      Original prompt: '${originalPrompt}'
      Context from card: '${cardContext}'
      
      Keep it descriptive but concise. Return ONLY the enhanced prompt.`,
  }),
};

export default template;
