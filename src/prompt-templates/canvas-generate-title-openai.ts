import type { PromptTemplateModule } from "./prompt-template.types";
import { canvasGenerateTitleOpenaiPresets } from "./prompt-template.presets";
import { toTextBlock } from "./prompt-template.utils";

export interface CanvasGenerateTitleOpenAIVars {
  fullText: string | string[];
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
  presets: canvasGenerateTitleOpenaiPresets,
  template: ({ fullText }) => ({
    developer: "Summarize user provided content into one word or short phrase",
    user: toTextBlock(fullText),
  }),
};

export default template;
