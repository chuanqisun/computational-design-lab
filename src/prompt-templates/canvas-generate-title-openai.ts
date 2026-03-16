import type { PromptTemplateModule } from "./prompt-template.types";

export interface CanvasGenerateTitleOpenAIVars {
  fullText: string;
}

const template: PromptTemplateModule<CanvasGenerateTitleOpenAIVars, "fullText"> = {
  metadata: {
    title: "Short Title OpenAI",
    sourceFiles: ["src/components/context-tray/llm/generate-title-openai.ts"],
    categories: ["canvas", "text-to-text", "title-generation"],
    inputType: "text",
    outputType: "text",
    slots: {
      fullText: {
        description: "User-provided content to summarize.",
        required: true,
        multiple: true,
        type: "text",
      },
    },
  },
  template: ({ fullText = "" }) => ({
    developer: "Summarize user provided content into one word or short phrase",
    user: fullText,
  }),
};

export default template;
