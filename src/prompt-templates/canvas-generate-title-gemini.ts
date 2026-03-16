import type { PromptTemplateModule } from "./prompt-template.types";

export interface CanvasGenerateTitleGeminiVars {
  text: string;
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
  template: ({ text = "" }) => ({
    user: `One word/short phrase summary of text. Return text directly, no quotes.

${text}`,
  }),
};

export default template;