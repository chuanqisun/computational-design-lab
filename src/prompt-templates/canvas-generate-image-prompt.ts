import type { PromptTemplateModule } from "./prompt-template.types";
import { toTextBlock } from "./prompt-template.utils";

export interface CanvasGenerateImagePromptVars {
  text: string | string[];
  guidance: string | string[];
}

const canvasGenerateImagePromptPresets = [
  {
    title: "Botanical Shampoo Prompt",
    description: "Turn a shampoo concept description into a render prompt.",
    values: {
      text: [
        "A rounded botanical repair shampoo bottle with a warm white body, eucalyptus green cap, and subtle recessed front label.",
      ],
      guidance: ["Use premium beauty-ad style lighting.", "Keep the scene minimal and studio-based."],
    },
  },
  {
    title: "Mouthwash Prompt",
    description: "Generate a premium prompt from an oral care description.",
    values: {
      text: [
        "A clear rectangular mouthwash bottle with beveled shoulders, visible aqua liquid, and a clean measured dosage cap.",
      ],
      guidance: ["Emphasize clinical clarity, crisp reflections, and legible front labeling."],
    },
  },
  {
    title: "Refill Pouch Prompt",
    description: "Create a studio prompt for a refill-first packaging concept.",
    values: {
      text: [
        "A premium shampoo refill pouch with pearl matte film, translucent product window, compact cap, and understated forest green accents.",
      ],
      guidance: ["Make it feel editorial and sustainable rather than generic ecommerce."],
    },
  },
];

const template: PromptTemplateModule<CanvasGenerateImagePromptVars, "text" | "guidance"> = {
  metadata: {
    title: "Create Image Prompt",
    purpose: "Convert source text into a detailed text-to-image prompt with optional rendering guidance.",
    sourceFiles: ["src/components/context-tray/llm/generate-image-prompt-gemini.ts"],
    categories: ["canvas", "text-to-text", "prompt-generation"],
    inputType: "text",
    outputType: "text",
    slots: {
      text: {
        description: "Source text that should be turned into an image prompt.",
        required: true,
        multiple: true,
        type: "text",
      },
      guidance: {
        description: "Optional direction for style or rendering emphasis.",
        required: false,
        multiple: true,
        type: "text",
      },
    },
  },
  presets: canvasGenerateImagePromptPresets,
  template: ({ text, guidance }) => ({
    user: `Create a detailed image generation prompt for the following text. The prompt should be descriptive, visual, and suitable for a text-to-image model. Return only the prompt.

${toTextBlock(text)}${
      toTextBlock(guidance)
        ? `

Additional guidance:
${toTextBlock(guidance)}`
        : ""
    }`,
  }),
};

export default template;
