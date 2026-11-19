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
  requirements: string | string[];
  referenceItems: string[];
  brandGuide?: string | string[];
}

const canvasDesignConceptsPresets = [
  {
    title: "Botanical Shampoo Range",
    description: "Concept generation from a natural haircare board.",
    values: {
      numDesigns: 3,
      brandGuide: "Luma Vale: calm botanicals, matte restraint, soft green accents.",
      requirements: [
        "Design a premium shampoo bottle for a botanical repair line.",
        "Use a rounded bottle form, matte surfaces, and restrained green accents.",
      ],
      referenceItems: [
        "Title: Spa Mood\nContent: Eucalyptus leaves, pale stone, soft daylight, calm spa mood.",
        "Title: Rounded Bottle\nContent: Compact rounded bottle with generous shoulders and flip-top cap.",
      ],
    },
  },
  {
    title: "Family Mouthwash Concepts",
    description: "Explore approachable but trustworthy oral care concepts.",
    values: {
      numDesigns: 4,
      brandGuide: "Northstar Care: clear, gentle, clinically calm, never flashy.",
      requirements: [
        "Create mouthwash packaging concepts that feel family-safe and clinically credible.",
        "Make dosage and clarity of use obvious from the form.",
      ],
      referenceItems: [
        "Title: Shelf Clarity\nContent: Transparent aqua liquid, crisp white labels, bathroom shelf context.",
        "Title: Dosage Bottle\nContent: Beveled rectangular bottle with measurement cap and front label window.",
      ],
    },
  },
  {
    title: "Refill System Concepts",
    description: "Generate sustainable packaging concepts for refill-led haircare.",
    values: {
      numDesigns: 3,
      brandGuide: "Morrow Loop: premium sustainability, muted tones, visible utility.",
      requirements: [
        "Create refill-first shampoo packaging concepts for a premium sustainable line.",
        "Balance reduced plastic use with strong shelf presence.",
      ],
      referenceItems: [
        "Title: Refill Pouch\nContent: Stand-up pouch, mono-material film, compact cap, neutral editorial styling.",
        "Title: Countertop Bottle\nContent: Reusable countertop bottle paired with soft-touch labels and muted color blocking.",
      ],
    },
  },
];

const template: PromptTemplateModule<
  CanvasDesignConceptsVars,
  "numDesigns" | "requirements" | "referenceItems" | "brandGuide"
> = {
  metadata: {
    title: "Generate Design Concepts",
    purpose:
      "Generate multiple design concepts (title, description, image prompt) from the selected cards' images and text plus design requirements; used by both Design/Create and Design/Iterate.",
    sourceFiles: ["src/components/context-tray/llm/design-concepts.ts", "src/lib/actions/defs/generate.ts"],
    categories: ["canvas", "mixed-to-json", "concept-generation"],
    inputType: "mixed",
    outputType: "json",
    model: "gemini-4-hydrogen",
    outputSchema,
    slots: {
      numDesigns: {
        description: "How many concepts to produce.",
        required: true,
        multiple: false,
        type: "number",
      },
      requirements: {
        description:
          'Design requirements (Design/Create) or iteration direction (Design/Iterate). Falls back to "Any" when empty.',
        required: false,
        multiple: true,
        type: "text",
      },
      referenceItems: {
        description:
          'Text part of each selected card, formatted as "Title: <title>\\nContent: <body>" and sent before the prompt (each after that card\'s image, if any). Cards without body text send only their image.',
        required: false,
        multiple: true,
        type: "text",
      },
      brandGuide: {
        description: "Optional brand guide, appended inline to the system instruction when non-empty.",
        required: false,
        multiple: false,
        type: "text",
      },
    },
  },
  presets: canvasDesignConceptsPresets,
  template: ({ numDesigns = 3, requirements, referenceItems = [], brandGuide }) => ({
    developer: toTextBlock(brandGuide)
      ? `You generate design concepts from mixed visual and textual references. Follow the provided brand guide when making design decisions.\n\nBrand guide: ${toTextBlock(brandGuide)}`
      : "You generate design concepts from mixed visual and textual references.",
    user: [
      ...referenceItems,
      `Generate ${numDesigns} unique design concepts based on the provided inputs (images and texts) and the following requirements:
${toTextBlock(requirements, "Any")}

CRITICAL: Every design concept MUST explicitly draw inspiration from ALL provided reference items (both images and texts). You must synthesise ideas from all inputs, but you can interpret them differently to create variety across the designs.

For each design, provide:
1. A highly detailed text description (title and description). The description must:
   - Capture the conceptual vision and specific physical details (materials, form, finish, mechanism).
   - Explicitly rationalize how the reference texts and images influenced the design. Explain the connection between the input references and the resulting design choices.
2. A separate 'imagePrompt' optimized for generating a high-quality, keyshot-style product rendering of this design. Include details on lighting, camera angle, and material properties for a photorealistic studio look.`,
    ].join("\n\n"),
  }),
};

export default template;
