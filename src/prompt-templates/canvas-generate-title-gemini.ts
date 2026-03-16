import { canvasGenerateTitleGeminiPresets } from "./prompt-template.presets";
import type { PromptTemplateModule } from "./prompt-template.types";
import { toTextBlock } from "./prompt-template.utils";

export interface CanvasGenerateTitleGeminiVars {
  text: string | string[];
}

const template: PromptTemplateModule<CanvasGenerateTitleGeminiVars, "text"> = {
  metadata: {
    title: "Short Title Gemini",
    sourceFiles: ["src/components/context-tray/llm/generate-title-gemini.ts"],
    categories: ["canvas", "text-to-text", "title-generation"],
    inputType: "text",
    outputType: "text",
    slots: {
      text: {
        description: "Longer source text to summarize as a short title.",
        required: true,
        multiple: true,
        type: "text",
      },
    },
  },
  presets: canvasGenerateTitleGeminiPresets,
  template: ({ text }) => ({
    user: `One word/short phrase summary of text. Return text directly, no quotes.

${toTextBlock(text)}`,
  }),
};

export default template;
