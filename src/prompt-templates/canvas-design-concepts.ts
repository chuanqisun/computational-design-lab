import type { PromptTemplateModule } from "./prompt-template.types";

export interface CanvasDesignConceptsVars {
  numDesigns: number;
  requirements: string[];
  referenceSummary: string[];
}

const template: PromptTemplateModule<CanvasDesignConceptsVars, "numDesigns" | "requirements" | "referenceSummary"> = {
  metadata: {
    title: "Generate Design Concepts",
    sourceFiles: ["src/components/context-tray/llm/design-concepts.ts"],
    categories: ["canvas", "mixed-to-json", "concept-generation"],
    inputType: "mixed",
    outputType: "json",
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
    },
  },
  template: ({ numDesigns = 3, requirements = [], referenceSummary = [] }) => ({
    user: `Generate ${numDesigns} unique design concepts based on the provided inputs (images and texts) and the following requirements:
${requirements.length > 0 ? requirements.join("\n") : "Any"}

CRITICAL: Every design concept MUST explicitly draw inspiration from ALL provided reference items (both images and texts). You must synthesise ideas from all inputs, but you can interpret them differently to create variety across the designs.
${referenceSummary.length > 0 ? `

Reference summary:
${referenceSummary.join("\n")}` : ""}

For each design, provide:
1. A highly detailed text description (title and description). The description must:
   - Capture the conceptual vision and specific physical details (materials, form, finish, mechanism).
   - Explicitly rationalize how the reference texts and images influenced the design. Explain the connection between the input references and the resulting design choices.
2. A separate 'imagePrompt' optimized for generating a high-quality, keyshot-style product rendering of this design. Include details on lighting, camera angle, and material properties for a photorealistic studio look.`,
  }),
};

export default template;