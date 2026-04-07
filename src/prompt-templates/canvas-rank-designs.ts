import { canvasRankDesignsPresets } from "./prompt-template.presets";
import type { PromptTemplateModule } from "./prompt-template.types";

const outputSchema = {
  type: "object",
  properties: {
    rankedItemIds: {
      type: "array",
      items: { type: "string" },
    },
    feedback: { type: "string" },
  },
  required: ["rankedItemIds", "feedback"],
} as const;

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
    purpose:
      "Rank designs from a persona perspective against a target trait and return ordered IDs with brief feedback.",
    sourceFiles: ["src/components/context-tray/llm/synthetic-users.ts"],
    categories: ["canvas", "mixed-to-json", "ranking"],
    inputType: "mixed",
    outputType: "json",
    outputSchema,
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

Rank these designs from least to most "${trait}" based on your personal perspective. Return all ${designCount} item IDs in order from least ${trait} (first) to most ${trait} (last). Also write 1-2 sentences of feedback explaining your ranking.

Return ONLY valid JSON matching this schema:
${JSON.stringify(outputSchema, null, 2)}`,
  }),
};

export default template;
