import type { PromptTemplateModule } from "./prompt-template.types";
import { toTextLines } from "./prompt-template.utils";

export interface CanvasAnimateVars {
  textInputs: string[];
  startingFrameImageId: string;
  referenceImageIds: string[];
  annotatedSketchImageId: string;
  instruction: string;
}

function formatImageList(ids: string[]): string {
  if (ids.length <= 1) return ids[0] || "";
  if (ids.length === 2) return `${ids[0]} and ${ids[1]}`;
  return `${ids.slice(0, -1).join(", ")}, and ${ids.at(-1)}`;
}

const canvasAnimatePresets = [
  {
    title: "Shampoo Cap Flip",
    description: "One shampoo bottle render used as the starting frame.",
    values: {
      textInputs: [],
      startingFrameImageId: "Image1",
      referenceImageIds: [],
      annotatedSketchImageId: "",
      instruction:
        "A hand enters from the right, flips open the eucalyptus green cap, and squeezes a small ribbon of shampoo. Slow push-in, soft studio light, gentle cap click.",
    },
  },
  {
    title: "Mouthwash Pour With References",
    description: "Starting frame plus two material references, with an annotated sketch on the starting frame.",
    values: {
      textInputs: [],
      startingFrameImageId: "Image1",
      referenceImageIds: ["Image2", "Image3"],
      annotatedSketchImageId: "Image4",
      instruction:
        "The bottle tilts and pours aqua rinse into the dosage cap along the drawn arrow. Locked-off camera, clinical white tile background, a single glug sound.",
    },
  },
  {
    title: "Refill Pouch From Text",
    description: "Text-only card animated without images.",
    values: {
      textInputs: [
        "Title: Refill Ritual\nBody: A stand-up shampoo refill pouch with pearl matte film decants into a reusable countertop bottle.\nImage prompt: Pearl matte stand-up pouch beside a frosted glass bottle on pale stone, soft side light",
      ],
      startingFrameImageId: "",
      referenceImageIds: [],
      annotatedSketchImageId: "",
      instruction:
        "Slow orbit as the pouch is unscrewed and poured into the bottle, then sealed. Calm editorial pacing.",
    },
  },
];

const template: PromptTemplateModule<
  CanvasAnimateVars,
  "textInputs" | "startingFrameImageId" | "referenceImageIds" | "annotatedSketchImageId" | "instruction"
> = {
  metadata: {
    title: "Animate",
    purpose:
      "Generate a short video from the selected canvas cards (Animate tool / animate action). Cards are sent in selection order: video cards as a video part, image cards as image parts (numbered Image1, Image2...), text-only cards as text parts. Annotated starting-frame sketches are appended as extra image parts. The final text part is the instruction: a generated image-role sentence group followed by the user's direction. Aspect ratio, duration, and task (text_to_video, image_to_video, reference_to_video, edit, extend) are request settings, not prompt text.",
    sourceFiles: [
      "src/components/context-tray/llm/animate.ts",
      "src/components/context-tray/tools/animate.tool.ts",
      "src/lib/actions/defs/media.ts",
    ],
    categories: ["canvas", "mixed-to-video", "video-generation"],
    inputType: "mixed",
    outputType: "video",
    model: "gemini-omni-1.2-flash",
    slots: {
      textInputs: {
        description:
          "One text part per text-only card (no video or image), with lines `Title: ...`, `Body: ...`, `Image prompt: ...` for the non-empty fields. Sent in card order, interleaved with media parts, before the instruction.",
        required: false,
        multiple: true,
        type: "text",
      },
      startingFrameImageId: {
        description:
          'Image id given the "starting-frame" role (at most one, e.g. "Image1"). Adds "Use <id> as the starting frame."',
        required: false,
        multiple: false,
        type: "text",
      },
      referenceImageIds: {
        description:
          'Image ids given the "reference" role (by default every image after the first, or all images when a video is selected). Adds a "visual reference(s), not as a starting frame(s)" sentence.',
        required: false,
        multiple: true,
        type: "text",
      },
      annotatedSketchImageId: {
        description:
          "Id of the appended annotated sketch for the starting frame (Image<number of images + 1>). Only used when the starting frame has annotations drawn in the Animate tool.",
        required: false,
        multiple: false,
        type: "text",
      },
      instruction: {
        description:
          'Motion, camera, pacing, and audio direction typed by the user (trimmed). If both this and the role sentences are empty, the action sends "Animate the selected content."',
        required: false,
        multiple: false,
        type: "text",
      },
    },
  },
  presets: canvasAnimatePresets,
  template: ({ textInputs = [], startingFrameImageId, referenceImageIds, annotatedSketchImageId, instruction }) => {
    const startingFrame = startingFrameImageId?.trim() || "";
    const references = toTextLines(referenceImageIds);
    const annotation = annotatedSketchImageId?.trim() || "";
    const groups: string[] = [];

    if (startingFrame) {
      groups.push(`Use ${startingFrame} as the starting frame.`);
    }
    if (references.length === 1) {
      groups.push(`Use ${references[0]} as a visual reference, not as a starting frame.`);
    } else if (references.length > 1) {
      groups.push(`Use ${formatImageList(references)} as visual references, not as starting frames.`);
    }
    if (startingFrame && annotation) {
      groups.push(`Use ${annotation} as the annotated sketch guide for ${startingFrame}, not as a literal frame.`);
    }

    const macro = groups.join(" ");
    const combined = [macro, (instruction ?? "").trim()].filter(Boolean).join(" ") || "Animate the selected content.";

    return {
      user: [...textInputs, combined].join("\n\n"),
    };
  },
};

export default template;
