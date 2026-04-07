import { canvasGenerateImagePromptPresets } from "./prompt-template.presets";
import type { PromptTemplateModule } from "./prompt-template.types";
import { toTextBlock } from "./prompt-template.utils";

export interface CanvasGenerateImagePromptVars {
  text: string | string[];
  guidance: string | string[];
}

const template: PromptTemplateModule<CanvasGenerateImagePromptVars, "text" | "guidance"> = {
  metadata: {
    title: "Text To Image Prompt",
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
