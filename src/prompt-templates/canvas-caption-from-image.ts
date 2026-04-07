import type { PromptTemplateModule } from "./prompt-template.types";
import { toTextBlock } from "./prompt-template.utils";

export interface CanvasCaptionFromImageVars {
  instruction: string;
}

const canvasCaptionFromImagePresets = [
  {
    title: "Clinical Shelf Caption",
    description: "Short retail caption for a mouthwash image.",
    values: { instruction: "Describe this mouthwash bottle in a short retail-ready caption." },
  },
  {
    title: "Material Focus Caption",
    description: "Highlight finish and packaging details in one line.",
    values: { instruction: "Write a one-sentence caption focusing on material finish, cap design, and overall mood." },
  },
  {
    title: "Campaign Caption",
    description: "Generate a concise hero image caption for shampoo packaging.",
    values: { instruction: "Generate a concise campaign caption for this shampoo packaging image." },
  },
];

const template: PromptTemplateModule<CanvasCaptionFromImageVars, "instruction"> = {
  metadata: {
    title: "Short Image Caption",
    purpose: "Generate a short caption for an input image.",
    sourceFiles: ["src/components/canvas/ai-helpers.ts"],
    categories: ["canvas", "image-to-text", "captioning"],
    inputType: "image",
    outputType: "text",
    slots: {
      instruction: {
        description: "Captioning instruction shown to the model alongside the source image.",
        required: false,
        multiple: false,
        type: "text",
      },
    },
  },
  presets: canvasCaptionFromImagePresets,
  template: ({ instruction }) => ({
    user: toTextBlock(instruction, "Describe this image in a short caption."),
  }),
};

export default template;
