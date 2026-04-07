import type { PromptTemplateModule } from "./prompt-template.types";
import { toTextBlock } from "./prompt-template.utils";

export interface CanvasBlendImagesVars {
  instruction: string | string[];
  itemNotes: string[];
}

const canvasBlendImagesPresets = [
  {
    title: "Shampoo Botanical Merge",
    description: "Blend a hero bottle render with botanical references for a natural care concept.",
    values: {
      instruction: [
        "Blend the uploaded shampoo bottle render with the botanical reference image into one cohesive hero shot.",
        "Keep the bottle silhouette readable and let eucalyptus leaves influence only the supporting composition.",
      ],
      itemNotes: [
        "Reference 1: Rounded shampoo bottle with a matte off-white body and eucalyptus green cap.",
        "Reference 2: Dewy eucalyptus leaves on a pale stone surface with soft morning light.",
      ],
    },
  },
  {
    title: "Mouthwash Clinical Fusion",
    description: "Combine a mouthwash packshot with clean bathroom material cues.",
    values: {
      instruction: [
        "Blend the mouthwash bottle image with the bathroom material reference.",
        "Preserve the transparent aqua liquid and make the final image feel clinical but premium.",
      ],
      itemNotes: [
        "Reference 1: Transparent rectangular mouthwash bottle with integrated dosage cap.",
        "Reference 2: White tile, chrome, and diffused daylight from a modern bathroom interior.",
      ],
    },
  },
  {
    title: "Refill Pouch Editorial Composite",
    description: "Merge a refill pouch concept with sustainability cues for a calm editorial image.",
    values: {
      instruction: [
        "Blend the refill pouch render with the recycled paper and pebble texture reference.",
        "Aim for an editorial sustainability mood with restrained styling.",
      ],
      itemNotes: [
        "Reference 1: Stand-up shampoo refill pouch with pearl matte film and clear window.",
        "Reference 2: Recycled paper, smooth pebbles, and soft side light in a quiet neutral palette.",
      ],
    },
  },
];

const template: PromptTemplateModule<CanvasBlendImagesVars, "instruction" | "itemNotes"> = {
  metadata: {
    title: "Blend Images",
    purpose:
      "Blend multiple visual references into a single generated image guided by text instructions and reference notes.",
    sourceFiles: ["src/components/context-tray/llm/blend-images.ts"],
    categories: ["canvas", "mixed-to-image", "image-blending"],
    inputType: "mixed",
    outputType: "image",
    slots: {
      instruction: {
        description: "Primary blend or edit instruction.",
        required: true,
        multiple: true,
        type: "text",
      },
      itemNotes: {
        description: "Optional notes describing attached references.",
        required: false,
        multiple: true,
        type: "text",
      },
    },
  },
  presets: canvasBlendImagesPresets,
  template: ({ instruction, itemNotes = [] }) => ({
    user: `${toTextBlock(instruction)}${
      itemNotes.length > 0
        ? `

Reference notes:
${itemNotes.join("\n")}`
        : ""
    }`,
  }),
};

export default template;
