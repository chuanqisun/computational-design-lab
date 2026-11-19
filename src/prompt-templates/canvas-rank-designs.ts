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
  personaName: string;
  personaAge: number;
  personaOccupation: string;
  personaDescription: string;
  trait: string;
  designSummaries: string[];
}

const canvasRankDesignsPresets = [
  {
    title: "Ingredient-Driven Ranking",
    description: "Rank shampoo concepts for an ingredient-conscious shopper.",
    values: {
      personaName: "Maya Chen",
      personaAge: 34,
      personaOccupation: "product designer",
      personaDescription:
        "She shops for shampoo based on ingredient transparency, calm aesthetics, and whether the pack looks credible in a premium bathroom.",
      trait: "premium",
      designSummaries: [
        'Design 1 (id: A1): "Matte Eucalyptus" — Rounded matte shampoo bottle with eucalyptus green cap and minimal recessed label.',
        'Design 2 (id: B2): "Gloss Botanica" — Glossy shampoo bottle with high-contrast botanical graphics and metallic cap.',
        'Design 3 (id: C3): "Refill Duo" — Refill pouch plus reusable countertop bottle system with soft neutral labeling.',
      ],
    },
  },
  {
    title: "Clinical Trust Ranking",
    description: "Rank mouthwash concepts for a trust-seeking oral care buyer.",
    values: {
      personaName: "Daniel Okafor",
      personaAge: 41,
      personaOccupation: "school administrator and parent of two",
      personaDescription:
        "He compares mouthwash packs for the family and cares most about visible dosage cues, product clarity, and whether the design looks safe and clinically trustworthy.",
      trait: "trustworthy",
      designSummaries: [
        'Design 1 (id: A1): "Measured Clarity" — Transparent aqua mouthwash bottle with measured dosage cap and crisp white label.',
        'Design 2 (id: B2): "Bold Flavor" — Dark opaque bottle with bold flavor graphics and neon accents.',
        'Design 3 (id: C3): "Frosted Calm" — Frosted bottle with soft blue cap and oversized ingredient callouts.',
      ],
    },
  },
  {
    title: "Sustainability Ranking",
    description: "Rank refill concepts for eco-oriented packaging users.",
    values: {
      personaName: "Lena Fischer",
      personaAge: 29,
      personaOccupation: "environmental consultant",
      personaDescription:
        "She actively chooses refill systems when they feel easy to use and premium enough to justify countertop space.",
      trait: "sustainable",
      designSummaries: [
        'Design 1 (id: A1): "Loop Pouch" — Mono-material refill pouch with reusable pump bottle companion.',
        'Design 2 (id: B2): "Recycled Classic" — Conventional rigid shampoo bottle with recycled plastic claim on pack.',
        'Design 3 (id: C3): "Concentrate Pods" — Concentrate pod system with small reusable aluminum bottle.',
      ],
    },
  },
];

const template: PromptTemplateModule<
  CanvasRankDesignsVars,
  "personaName" | "personaAge" | "personaOccupation" | "personaDescription" | "trait" | "designSummaries"
> = {
  metadata: {
    title: "Rank Designs As Persona",
    purpose:
      "Rank the selected design cards (text plus attached images) from a persona's perspective against a target trait and return ordered IDs with brief feedback.",
    sourceFiles: ["src/components/context-tray/llm/synthetic-users.ts", "src/lib/actions/defs/media.ts"],
    categories: ["canvas", "mixed-to-json", "ranking"],
    inputType: "mixed",
    outputType: "json",
    model: "gemini-4-hydrogen",
    outputSchema,
    slots: {
      personaName: {
        description: "Persona name, used in the system instruction.",
        required: true,
        multiple: false,
        type: "text",
      },
      personaAge: {
        description: "Persona age, used in the system instruction.",
        required: true,
        multiple: false,
        type: "number",
      },
      personaOccupation: {
        description: "Persona occupation, used in the system instruction.",
        required: true,
        multiple: false,
        type: "text",
      },
      personaDescription: {
        description: "Persona description, used in the system instruction.",
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
      designSummaries: {
        description:
          'One line per design, formatted as `Design N (id: <id>): "<title>" — <body>`. The design count is derived from this list. Design images are attached as separate image parts after the text.',
        required: false,
        multiple: true,
        type: "text",
      },
    },
  },
  presets: canvasRankDesignsPresets,
  template: ({
    personaName = "",
    personaAge = 30,
    personaOccupation = "",
    personaDescription = "",
    trait = "",
    designSummaries = [],
  }) => {
    const designCount = designSummaries.length;

    return {
      developer: `You are ${personaName}, ${personaAge} years old, ${personaOccupation}. ${personaDescription}`,
      user: `Here are ${designCount} design concepts:

${designSummaries.join("\n\n")}

Rank these designs from least to most "${trait}" based on your personal perspective. Return all ${designCount} item IDs in order from least ${trait} (first) to most ${trait} (last). Also write 1-2 sentences of feedback explaining your ranking.`,
    };
  },
};

export default template;
