import type { PromptTemplateModule } from "./prompt-template.types";

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
    user: (instruction || "Describe this image in a short caption.").trim(),
  }),
};

export default template;
