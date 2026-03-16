import type { PromptTemplateModule } from "./prompt-template.types";
import { canvasFillCardPresets } from "./prompt-template.presets";
import { toTextBlock } from "./prompt-template.utils";

export interface CanvasFillCardVars {
  title: string;
  body: string | string[];
  imagePrompt: string | string[];
  imageStatus: string;
  guidance: string | string[];
}

const template: PromptTemplateModule<
  CanvasFillCardVars,
  "title" | "body" | "imagePrompt" | "imageStatus" | "guidance"
> = {
  metadata: {
    title: "Fill Card Fields",
    sourceFiles: ["src/components/canvas/ai-helpers.ts"],
    categories: ["canvas", "mixed-to-json", "field-completion"],
    inputType: "mixed",
    outputType: "json",
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

Return ONLY a JSON object with the generated fields. Do not include fields that were already present or that cannot be generated.
Example: {"title": "...", "body": "...", "imagePrompt": "..."}`,
  }),
};

export default template;
