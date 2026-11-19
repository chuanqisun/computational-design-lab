import type { PromptTemplateModule } from "./prompt-template.types";

export interface CanvasEditImageVars {
  instruction: string;
}

const DEFAULT_EDIT_INSTRUCTION = "Apply the changes indicated by the sketch annotations on this image";

const canvasEditImagePresets = [
  {
    title: "Shampoo Cap Material Swap",
    description: "Sketch circles the cap of a shampoo bottle render and asks for a new finish.",
    values: {
      instruction: "Change the circled cap to brushed copper and keep the warm white matte bottle body unchanged.",
    },
  },
  {
    title: "Mouthwash Dosage Ridges",
    description: "Sketch marks the dosage cap of a mouthwash bottle for added measurement ridges.",
    values: {
      instruction:
        "Add fine horizontal measurement ridges to the dosage cap where I drew the lines, matching the clear plastic of the bottle.",
    },
  },
  {
    title: "Refill Pouch Sketch Only",
    description: "No typed feedback, so the default instruction asks the model to follow the drawn annotations.",
    values: {
      instruction: "",
    },
  },
];

const template: PromptTemplateModule<CanvasEditImageVars, "instruction"> = {
  metadata: {
    title: "Edit Image",
    purpose:
      "Edit a card's image with the image model (Sketch tool / edit_image action). The image is sent first: the Sketch tool's flattened drawing, or for agent calls the source image with labeled regions drawn on it (or the plain source image). The instruction follows as a single text part.",
    sourceFiles: [
      "src/components/semantic-scan/image-to-image.ts",
      "src/lib/actions/defs/generate.ts",
      "src/components/context-tray/tools/sketch.tool.ts",
    ],
    categories: ["canvas", "mixed-to-image", "image-editing"],
    inputType: "mixed",
    outputType: "image",
    model: "gemini-nano-banana-2.1",
    slots: {
      instruction: {
        description: `Edit feedback typed in the Sketch dialog (or the agent's instruction argument), trimmed. When empty the edit_image action falls back to "${DEFAULT_EDIT_INSTRUCTION}".`,
        required: false,
        multiple: false,
        type: "text",
      },
    },
  },
  presets: canvasEditImagePresets,
  template: ({ instruction }) => ({
    user: instruction?.trim() || DEFAULT_EDIT_INSTRUCTION,
  }),
};

export default template;
