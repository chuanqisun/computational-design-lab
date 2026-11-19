import type { PromptTemplateModule } from "./prompt-template.types";
import { toTextBlock } from "./prompt-template.utils";

const outputSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    body: { type: "string" },
    imagePrompt: { type: "string" },
  },
  required: ["title", "body", "imagePrompt"],
} as const;

export interface CanvasFillCardVars {
  title: string;
  body: string | string[];
  imagePrompt: string | string[];
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
    },
  },
];

const template: PromptTemplateModule<CanvasFillCardVars, "title" | "body" | "imagePrompt"> = {
  metadata: {
    title: "Fill Card Fields",
    purpose:
      "Fill missing canvas card fields (title, body, image prompt) from the card's available text plus its attached image or video, if any. The response schema is built per request from only the missing fields; outputSchema shows the case where all three are missing.",
    sourceFiles: ["src/components/canvas/ai-helpers.ts", "src/lib/actions/card-fill.ts"],
    categories: ["canvas", "mixed-to-json", "field-completion"],
    inputType: "mixed",
    outputType: "json",
    model: "gemini-4-hydrogen",
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
    },
  },
  presets: canvasFillCardPresets,
  template: ({ title, body, imagePrompt }) => ({
    user: `I have a card with the following content:
Title: ${title || "(missing)"}
Body: ${toTextBlock(body, "(missing)")}
Image Prompt: ${toTextBlock(imagePrompt, "(missing)")}

Please generate the missing fields based on the available information.
- If title is missing, generate a short, catchy title (max 3 words).
- If body is missing, generate a concise description (max 2 sentences).
- If image prompt is missing and no image or video is provided, generate a detailed image generation prompt.
- If image or video is provided, use it to generate the missing text fields.
- Never generate or return video content.

Return ONLY a JSON object with the generated fields. Do not include fields that were already present or that cannot be generated.
Example: {"title": "...", "body": "...", "imagePrompt": "..."}`,
  }),
};

export default template;
