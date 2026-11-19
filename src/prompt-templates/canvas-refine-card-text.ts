import type { PromptTemplateModule } from "./prompt-template.types";

export interface CanvasRefineCardTextVars {
  oldTitle: string;
  oldBody: string;
  hasOldImage: boolean;
  hasNewImage: boolean;
}

const canvasRefineCardTextPresets = [
  {
    title: "Shampoo Cap Recolor",
    description: "Rewrite a shampoo card after a sketch changed the cap to a brushed copper finish.",
    values: {
      oldTitle: "Eucalyptus Repair",
      oldBody:
        "A rounded shampoo bottle with a warm white matte body and eucalyptus green cap, built for a calm spa-like shelf presence.",
      hasOldImage: true,
      hasNewImage: true,
    },
  },
  {
    title: "Mouthwash Dosage Cap Edit",
    description: "Refresh a mouthwash card after the sketch added measurement ridges to the dosage cap.",
    values: {
      oldTitle: "Measured Clarity",
      oldBody:
        "A transparent mouthwash bottle that shows the aqua rinse and pairs it with an intuitive integrated dosage cap.",
      hasOldImage: true,
      hasNewImage: true,
    },
  },
  {
    title: "Refill Pouch Window",
    description: "Update a refill pouch card after the sketch enlarged the translucent product window.",
    values: {
      oldTitle: "Refill Ritual",
      oldBody: "A stand-up shampoo refill pouch with pearl matte film, compact screw cap, and a small product window.",
      hasOldImage: true,
      hasNewImage: true,
    },
  },
];

const template: PromptTemplateModule<CanvasRefineCardTextVars, "oldTitle" | "oldBody" | "hasOldImage" | "hasNewImage"> =
  {
    metadata: {
      title: "Refine Card Text",
      purpose:
        "After the Sketch tool (edit_image action) produces an edited image, compare the original and edited images and write a new title and body for the result card. The instruction is sent first, then a caption text part followed by the original image, then a caption text part followed by the edited image. The response is requested as application/json without a schema.",
      sourceFiles: [
        "src/components/canvas/ai-helpers.ts",
        "src/lib/actions/defs/generate.ts",
        "src/components/context-tray/tools/sketch.tool.ts",
      ],
      categories: ["canvas", "mixed-to-json", "card-text-refinement"],
      inputType: "mixed",
      outputType: "json",
      model: "gemini-4-hydrogen",
      slots: {
        oldTitle: {
          description: "Title of the source card whose image was edited (empty string if none).",
          required: false,
          multiple: false,
          type: "text",
        },
        oldBody: {
          description: "Body text of the source card whose image was edited (empty string if none).",
          required: false,
          multiple: false,
          type: "text",
        },
        hasOldImage: {
          description:
            "Whether the original (pre-edit) image loaded. If so, its caption text part is sent, followed by the image part. Defaults to true.",
          required: false,
          multiple: false,
          type: "boolean",
        },
        hasNewImage: {
          description:
            "Whether the edited image loaded. If so, its caption text part is sent, followed by the image part. Defaults to true.",
          required: false,
          multiple: false,
          type: "boolean",
        },
      },
    },
    presets: canvasRefineCardTextPresets,
    template: ({ oldTitle = "", oldBody = "", hasOldImage = true, hasNewImage = true }) => ({
      user: [
        `You are an AI assistant helping to refine a card's content after an image modification.
We modified an original image based on user drawing and feedback to produce a refined image.
Original Card Title: "${oldTitle || ""}"
Original Card Body: "${oldBody || ""}"

We will show you the original (old) image and the refined (new) image.
Please analyze the differences and generate a new title and a new body text that match the refined image while preserving the style and context of the original card.

Your output must be a JSON object with two fields:
- "title": a short, catchy title (max 4 words)
- "body": a concise, compelling description (1-2 sentences)

Return ONLY the JSON object. Do not include any other text or markdown formatting.
Example: {"title": "...", "body": "..."}`,
        ...(hasOldImage ? ["This is the original (old) image before modification."] : []),
        ...(hasNewImage ? ["This is the refined (new) image after modification."] : []),
      ].join("\n\n"),
    }),
  };

export default template;
