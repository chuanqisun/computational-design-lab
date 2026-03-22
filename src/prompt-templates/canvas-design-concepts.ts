import { canvasDesignConceptsPresets } from "./prompt-template.presets";
import type { PromptTemplateModule } from "./prompt-template.types";
import { toTextBlock } from "./prompt-template.utils";

const outputSchema = {
  type: "object",
  properties: {
    designs: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          imagePrompt: { type: "string" },
        },
        required: ["title", "description", "imagePrompt"],
      },
    },
  },
  required: ["designs"],
} as const;

export interface CanvasDesignConceptsVars {
  numDesigns: number;
  requirements: string[];
  referenceSummary: string[];
  brandGuide?: string | string[];
}

const template: PromptTemplateModule<
  CanvasDesignConceptsVars,
  "numDesigns" | "requirements" | "referenceSummary" | "brandGuide"
> = {
  metadata: {
    title: "Generate Design Concepts",
    sourceFiles: ["src/components/context-tray/llm/design-concepts.ts"],
    categories: ["canvas", "mixed-to-json", "concept-generation"],
    inputType: "mixed",
    outputType: "json",
    outputSchema,
    slots: {
      numDesigns: {
        description: "How many concepts to produce.",
        required: true,
        multiple: false,
        type: "number",
      },
      requirements: {
        description: "Design constraints or directional requirements.",
        required: false,
        multiple: true,
        type: "text",
      },
      referenceSummary: {
        description: "Optional summary of the reference items attached in the request.",
        required: false,
        multiple: true,
        type: "text",
      },
      brandGuide: {
        description: "Optional brand guide to shape design language and decision-making.",
        required: false,
        multiple: true,
        type: "text",
      },
    },
  },
  presets: canvasDesignConceptsPresets,
  template: ({ numDesigns = 3, requirements = [], referenceSummary = [], brandGuide }) => ({
    system: toTextBlock(brandGuide)
      ? `You generate design concepts from mixed visual and textual references. Follow the provided brand guide when making design decisions.\n\nBrand guide:\n${toTextBlock(brandGuide)}`
      : undefined,
    user: `Generate ${numDesigns} unique design concepts based on the provided inputs (images and texts) and the following requirements:
${requirements.length > 0 ? requirements.join("\n") : "Any"}

CRITICAL: Every design concept MUST explicitly draw inspiration from ALL provided reference items (both images and texts). You must synthesise ideas from all inputs, but you can interpret them differently to create variety across the designs.
${
  referenceSummary.length > 0
    ? `

Reference summary:
${referenceSummary.join("\n")}`
    : ""
}

For each design, provide:
1. A highly detailed text description (title and description). The description must:
   - Capture the conceptual vision and specific physical details (materials, form, finish, mechanism).
   - Explicitly rationalize how the reference texts and images influenced the design. Explain the connection between the input references and the resulting design choices.
2. A separate 'imagePrompt' optimized for generating a high-quality, keyshot-style product rendering of this design. Include details on lighting, camera angle, and material properties for a photorealistic studio look.

Return ONLY valid JSON matching this schema:
${JSON.stringify(outputSchema, null, 2)}`,
  }),
};

export default template;
