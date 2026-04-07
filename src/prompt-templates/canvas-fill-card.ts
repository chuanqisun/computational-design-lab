import type { PromptTemplateModule } from "./prompt-template.types";
import { toTextBlock } from "./prompt-template.utils";

const outputSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    body: { type: "string" },
    imagePrompt: { type: "string" },
  },
  additionalProperties: false,
} as const;

export interface CanvasFillCardVars {
  title: string;
  body: string | string[];
  imagePrompt: string | string[];
  imageStatus: string;
  guidance: string | string[];
}

const canvasFillCardPresets = [
  {
    title: "Missing Title",
    description: "Complete a shampoo concept card missing its title.",
    values: {
      title: "",
      body: [
        "A rounded shampoo bottle inspired by eucalyptus leaves and smooth river stones.",
        "The pack should feel restorative, quiet, and premium without leaning overly clinical.",
      ],
      imagePrompt: ["Studio render of a warm white matte shampoo bottle with a eucalyptus green cap."],
      imageStatus: "image ready",
      guidance: ["Prioritize a short brandable title."],
    },
  },
  {
    title: "Missing Body",
    description: "Fill in descriptive copy for a mouthwash design card.",
    values: {
      title: "Measured Clarity",
      body: [],
      imagePrompt: [
        "Premium mouthwash bottle render, clear rectangular body, aqua rinse, white dosage cap, bright clinical studio lighting.",
      ],
      imageStatus: "image ready",
      guidance: ["Keep the body to two compact sentences and explain the dosage cap benefit."],
    },
  },
  {
    title: "Missing Image Prompt",
    description: "Generate a missing image prompt from card text for a refill concept.",
    values: {
      title: "Refill Ritual",
      body: [
        "A premium shampoo refill pouch designed for countertop rituals rather than hidden storage.",
        "Pearl matte film, a transparent fill window, and calm forest green accents make it feel elevated and sustainable.",
      ],
      imagePrompt: [],
      imageStatus: "no image attached",
      guidance: ["Include lighting, material finish, and camera angle in the generated prompt."],
    },
  },
];

const template: PromptTemplateModule<
  CanvasFillCardVars,
  "title" | "body" | "imagePrompt" | "imageStatus" | "guidance"
> = {
  metadata: {
    title: "Fill Card Fields",
    purpose: "Fill missing canvas card fields from the available text and image context.",
    sourceFiles: ["src/components/canvas/ai-helpers.ts"],
    categories: ["canvas", "mixed-to-json", "field-completion"],
    inputType: "mixed",
    outputType: "json",
    outputSchema,
    slots: {
      title: {
        description: "Existing card title, if any.",
        required: false,
        multiple: false,
        type: "text",
      },
      body: {
        description: "Existing card body content.",
        required: false,
        multiple: true,
        type: "text",
      },
      imagePrompt: {
        description: "Existing image prompt text.",
        required: false,
        multiple: true,
        type: "text",
      },
      imageStatus: {
        description: "Whether an image is attached or missing.",
        required: false,
        multiple: false,
        type: "text",
      },
      guidance: {
        description: "Extra completion guidance beyond the built-in rules.",
        required: false,
        multiple: true,
        type: "text",
      },
    },
  },
  presets: canvasFillCardPresets,
  template: ({ title, body, imagePrompt, imageStatus, guidance }) => ({
    user: `I have a card with the following content:
Title: ${title || "(missing)"}
Body: ${toTextBlock(body, "(missing)")}
Image Prompt: ${toTextBlock(imagePrompt, "(missing)")}
Image Status: ${imageStatus || "(unknown)"}

Please generate the missing fields based on the available information.
- If title is missing, generate a short, catchy title (max 3 words).
- If body is missing, generate a concise description (max 2 sentences).
- If image prompt is missing and no image is provided, generate a detailed image generation prompt.
- If image is provided, use it to generate the missing text fields.
${toTextBlock(guidance) ? `- Additional guidance: ${toTextBlock(guidance)}` : ""}

Return ONLY valid JSON matching this schema. Omit fields that were already present or cannot be generated.
${JSON.stringify(outputSchema, null, 2)}`,
  }),
};

export default template;
