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

const canvasRankDesignsPresets = [
  {
    title: "Ingredient-Driven Ranking",
    description: "Rank shampoo concepts for an ingredient-conscious shopper.",
    values: {
      personaSummary:
        "You are a 34-year-old product designer who shops for shampoo based on ingredient transparency, calm aesthetics, and whether the pack looks credible in a premium bathroom.",
      trait: "premium",
      designCount: 3,
      designSummaries: [
        "A1: Rounded matte shampoo bottle with eucalyptus green cap and minimal recessed label.",
        "B2: Glossy shampoo bottle with high-contrast botanical graphics and metallic cap.",
        "C3: Refill pouch plus reusable countertop bottle system with soft neutral labeling.",
      ],
    },
  },
  {
    title: "Clinical Trust Ranking",
    description: "Rank mouthwash concepts for a trust-seeking oral care buyer.",
    values: {
      personaSummary:
        "You are a parent comparing mouthwash packs and care most about visible dosage cues, product clarity, and whether the design looks safe and clinically trustworthy.",
      trait: "trustworthy",
      designCount: 3,
      designSummaries: [
        "A1: Transparent aqua mouthwash bottle with measured dosage cap and crisp white label.",
        "B2: Dark opaque bottle with bold flavor graphics and neon accents.",
        "C3: Frosted bottle with soft blue cap and oversized ingredient callouts.",
      ],
    },
  },
  {
    title: "Sustainability Ranking",
    description: "Rank refill concepts for eco-oriented packaging users.",
    values: {
      personaSummary:
        "You actively choose refill systems when they feel easy to use and premium enough to justify countertop space.",
      trait: "sustainable",
      designCount: 3,
      designSummaries: [
        "A1: Mono-material refill pouch with reusable pump bottle companion.",
        "B2: Conventional rigid shampoo bottle with recycled plastic claim on pack.",
        "C3: Concentrate pod system with small reusable aluminum bottle.",
      ],
    },
  },
];

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
