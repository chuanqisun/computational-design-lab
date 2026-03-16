import type { PromptTemplateModule } from "./prompt-template.types";
import { canvasScanConceptsPresets } from "./prompt-template.presets";
import { toTextBlock } from "./prompt-template.utils";

export interface CanvasScanConceptsVars {
  instruction: string | string[];
}

const template: PromptTemplateModule<CanvasScanConceptsVars, "instruction"> = {
  metadata: {
    title: "Scan Concepts",
    sourceFiles: ["src/components/context-tray/llm/scan-concepts.ts"],
    categories: ["canvas", "mixed-to-json", "concept-extraction"],
    inputType: "mixed",
    outputType: "json",
    slots: {
      instruction: {
        description: "User instruction that shapes the conceptual scan.",
        required: false,
        multiple: true,
        type: "text",
      },
    },
  },
  presets: canvasScanConceptsPresets,
  template: ({ instruction }) => ({
    developer:
      "Analyze the provided input and distill 3-5 key concepts based on user instruction. Each concept should have a clear title and one short sentence description.",
    user: toTextBlock(instruction, "Distill key concepts from the provided references."),
  }),
};

export default template;
