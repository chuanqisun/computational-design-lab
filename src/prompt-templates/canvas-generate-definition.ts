import type { PromptTemplateModule } from "./prompt-template.types";
import { canvasGenerateDefinitionPresets } from "./prompt-template.presets";
import { toTextBlock } from "./prompt-template.utils";

export interface CanvasGenerateDefinitionVars {
  text: string | string[];
}

const template: PromptTemplateModule<CanvasGenerateDefinitionVars, "text"> = {
  metadata: {
    title: "Define Term",
    sourceFiles: ["src/components/context-tray/llm/generate-definition-gemini.ts"],
    categories: ["canvas", "text-to-text", "definition"],
    inputType: "text",
    outputType: "text",
    slots: {
      text: {
        description: "Term or phrase to define.",
        required: true,
        multiple: true,
        type: "text",
      },
    },
  },
  presets: canvasGenerateDefinitionPresets,
  template: ({ text }) => ({
    user: `Define this term or phrase in 2-3 sentences. Return text directly, no quotes.

${toTextBlock(text)}`,
  }),
};

export default template;
