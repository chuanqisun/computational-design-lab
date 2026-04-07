import { canvasGeneratePersonasPresets } from "./prompt-template.presets";
import type { PromptTemplateModule } from "./prompt-template.types";
import { toInlineText } from "./prompt-template.utils";

const outputSchema = {
  type: "object",
  properties: {
    personas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" },
          occupation: { type: "string" },
          description: { type: "string" },
        },
        required: ["name", "age", "occupation", "description"],
      },
    },
  },
  required: ["personas"],
} as const;

export interface CanvasGeneratePersonasVars {
  trait: string;
  segment: string | string[];
  numUsers: number;
}

const template: PromptTemplateModule<CanvasGeneratePersonasVars, "trait" | "segment" | "numUsers"> = {
  metadata: {
    title: "Generate Personas",
    purpose: "Generate synthetic user personas that vary along a chosen trait and optional segment.",
    sourceFiles: ["src/components/context-tray/llm/synthetic-users.ts"],
    categories: ["canvas", "text-to-json", "persona-generation"],
    inputType: "text",
    outputType: "json",
    outputSchema,
    slots: {
      trait: {
        description: "Trait to vary across personas.",
        required: true,
        multiple: false,
        type: "text",
      },
      segment: {
        description: "Optional market or demographic segment.",
        required: false,
        multiple: true,
        type: "text",
      },
      numUsers: {
        description: "How many personas to generate.",
        required: true,
        multiple: false,
        type: "number",
      },
    },
  },
  presets: canvasGeneratePersonasPresets,
  template: ({ trait = "", segment, numUsers = 3 }) => {
    const segmentText = toInlineText(segment);

    return {
      user: `Generate ${numUsers} synthetic user personas${segmentText && segmentText !== "All" ? ` in the segment: ${segmentText}` : ""}. Each persona should have varying levels of "${trait}". Give them realistic names, ages, occupations, and a brief 2-3 sentence description of their personality and how "${trait}" manifests in their life.

Return ONLY valid JSON matching this schema:
${JSON.stringify(outputSchema, null, 2)}`,
    };
  },
};

export default template;
