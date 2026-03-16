import type { PromptTemplateModule } from "./prompt-template.types";
import { toTextBlock } from "./prompt-template.utils";

export interface CanvasCaptionFromImageVars {
  instruction: string;
}

const template: PromptTemplateModule<CanvasCaptionFromImageVars, "instruction"> = {
  metadata: {
    title: "Short Image Caption",
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
  template: ({ instruction }) => ({
    user: toTextBlock(instruction, "Describe this image in a short caption."),
  }),
};

export default template;
