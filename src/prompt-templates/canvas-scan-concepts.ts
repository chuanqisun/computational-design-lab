import type { PromptTemplateModule } from "./prompt-template.types";

export interface CanvasScanConceptsVars {
  instruction: string;
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
  template: ({ instruction }) => ({
    developer:
      "Analyze the provided input and distill 3-5 key concepts based on user instruction. Each concept should have a clear title and one short sentence description.",
    user: (instruction || "Distill key concepts from the provided references.").trim(),
  }),
};

export default template;
