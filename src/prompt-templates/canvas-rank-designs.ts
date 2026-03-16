import type { PromptTemplateModule } from "./prompt-template.types";
import { canvasRankDesignsPresets } from "./prompt-template.presets";

export interface CanvasRankDesignsVars {
  personaSummary: string;
  trait: string;
  designCount: number;
  designSummaries: string[];
}

const template: PromptTemplateModule<
  CanvasRankDesignsVars,
  "personaSummary" | "trait" | "designCount" | "designSummaries"
> = {
  metadata: {
    title: "Rank Designs As Persona",
    sourceFiles: ["src/components/context-tray/llm/synthetic-users.ts"],
    categories: ["canvas", "mixed-to-json", "ranking"],
    inputType: "mixed",
    outputType: "json",
    slots: {
      personaSummary: {
        description: "Persona description used as the system instruction.",
        required: true,
        multiple: false,
        type: "text",
      },
      trait: {
        description: "Trait used for ranking the designs.",
        required: true,
        multiple: false,
        type: "text",
      },
      designCount: {
        description: "Number of design concepts that must be ranked.",
        required: true,
        multiple: false,
        type: "number",
      },
      designSummaries: {
        description: "List of design labels and descriptions.",
        required: false,
        multiple: true,
        type: "text",
      },
    },
  },
  presets: canvasRankDesignsPresets,
  template: ({ personaSummary = "", trait = "", designCount = 0, designSummaries = [] }) => ({
    system: personaSummary,
    user: `Here are ${designCount} design concepts:

${designSummaries.join("\n\n")}

Rank these designs from least to most "${trait}" based on your personal perspective. Return all ${designCount} item IDs in order from least ${trait} (first) to most ${trait} (last). Also write 1-2 sentences of feedback explaining your ranking.`,
  }),
};

export default template;
