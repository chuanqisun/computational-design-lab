import type { PromptTemplateModule } from "./prompt-template.types";

export interface StudioAnimatePhotoVars {
  instructions: string;
  soundDescription: string;
  hasStartFrame: boolean;
}

const studioAnimatePhotoPresets = [
  {
    title: "Shampoo Cap Flip",
    description: "Animate a staged shampoo photo with a cap-flip interaction and matching sound.",
    values: {
      instructions:
        "The hand flips open the cap, squeezes a small ribbon of shampoo, and closes the bottle with a soft snap.",
      soundDescription:
        "A soft plastic click as the cap opens, a gentle squelch of thick shampoo, then a muted snap as the cap closes.",
      hasStartFrame: true,
    },
  },
  {
    title: "Mouthwash Pour",
    description: "Animate a staged mouthwash photo pouring into its dosage cap.",
    values: {
      instructions:
        "The bottle tilts into the dosage cap, the liquid glugs once, then the cap clicks back onto the bottle.",
      soundDescription:
        "A single hollow glug of liquid into the cap, a light splash, and a crisp plastic click as the cap reseals.",
      hasStartFrame: true,
    },
  },
  {
    title: "Refill Pouch Decant, No Sound",
    description: "Animate a refill pouch transfer with the sound description left empty.",
    values: {
      instructions:
        "A refill pouch unscrews, softly flexes, and pours product into a reusable bottle before being sealed again.",
      soundDescription: "",
      hasStartFrame: true,
    },
  },
];

const template: PromptTemplateModule<StudioAnimatePhotoVars, "instructions" | "soundDescription" | "hasStartFrame"> = {
  metadata: {
    title: "Animate Photo",
    purpose:
      "Animate a staged studio photo into a short video. The photo is sent as the starting-frame image part, followed by one text part combining the animation instructions and sound description. Requested at 9:16 with the default 4s duration.",
    sourceFiles: [
      "src/lib/studio-ai.ts",
      "src/components/generative-video/generate-video-gemini.ts",
      "src/components/generative-video/generative-video.ts",
      "src/components/photo-gallery/photo-gallery.component.ts",
    ],
    categories: ["studio", "mixed-to-video", "video-generation"],
    inputType: "mixed",
    outputType: "video",
    model: "gemini-omni-1.2-flash",
    slots: {
      instructions: {
        description:
          "Animation instructions from the Animate dialog (trimmed), falling back to the photo's stored animation prompt.",
        required: true,
        multiple: false,
        type: "text",
      },
      soundDescription: {
        description:
          'Sound description from the Animate dialog (trimmed), falling back to the generated one. Appended as " Sound: <description>" when non-empty.',
        required: false,
        multiple: false,
        type: "text",
      },
      hasStartFrame: {
        description:
          'Whether the staged photo is sent as the starting-frame image (always true in the studio flow). Adds the "Use Image1 as the starting frame." prefix. Defaults to true.',
        required: false,
        multiple: false,
        type: "boolean",
      },
    },
  },
  presets: studioAnimatePhotoPresets,
  template: ({ instructions = "", soundDescription = "", hasStartFrame = true }) => {
    const videoPrompt = soundDescription ? `${instructions} Sound: ${soundDescription}` : instructions;

    return {
      user: hasStartFrame ? `Use Image1 as the starting frame. ${videoPrompt.trim()}` : videoPrompt.trim(),
    };
  },
};

export default template;
