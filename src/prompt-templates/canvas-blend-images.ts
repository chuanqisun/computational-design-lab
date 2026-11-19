import type { PromptTemplateModule } from "./prompt-template.types";
import { toTextBlock } from "./prompt-template.utils";

export interface CanvasBlendImagesVars {
  instruction: string | string[];
  itemBodies: string[];
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
      itemBodies: [
        "Rounded shampoo bottle with a matte off-white body and eucalyptus green cap.",
        "Dewy eucalyptus leaves on a pale stone surface with soft morning light.",
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
      itemBodies: [
        "Transparent rectangular mouthwash bottle with integrated dosage cap.",
        "White tile, chrome, and diffused daylight from a modern bathroom interior.",
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
      itemBodies: [
        "Stand-up shampoo refill pouch with pearl matte film and clear window.",
        "Recycled paper, smooth pebbles, and soft side light in a quiet neutral palette.",
      ],
    },
  },
];

const template: PromptTemplateModule<CanvasBlendImagesVars, "instruction" | "itemBodies"> = {
  metadata: {
    title: "Blend Images",
    purpose:
      "Blend two or more canvas cards into a single generated image: the instruction is sent first, followed by each card's image and body text as separate parts.",
    sourceFiles: ["src/components/context-tray/llm/blend-images.ts", "src/lib/actions/defs/generate.ts"],
    categories: ["canvas", "mixed-to-image", "image-blending"],
    inputType: "mixed",
    outputType: "image",
    model: "gemini-nano-banana-2.1",
    slots: {
      instruction: {
        description: "Blend instruction from the user (sent as the first text part).",
        required: true,
        multiple: true,
        type: "text",
      },
      itemBodies: {
        description:
          "Body text of each selected card, sent verbatim as its own text part after that card's image (cards without body text send only their image).",
        required: false,
        multiple: true,
        type: "text",
      },
    },
  },
  presets: canvasBlendImagesPresets,
  template: ({ instruction, itemBodies = [] }) => ({
    user: [toTextBlock(instruction), ...itemBodies].join("\n\n"),
  }),
};

export default template;
