import type { PromptTemplateModule } from "./prompt-template.types";
import { toTextBlock } from "./prompt-template.utils";

const outputSchema = {
  type: "object",
  properties: {
    moods: {
      type: "array",
      items: {
        type: "object",
        properties: {
          mood: { type: "string" },
          arousal: { type: "number" },
        },
        required: ["mood", "arousal"],
      },
    },
  },
  required: ["moods"],
} as const;

export interface CanvasScanMoodsSupervisedVars {
  instruction: string | string[];
  requiredList: string[];
}

const canvasScanMoodsSupervisedPresets = [
  {
    title: "Botanical Supervised",
    description: "Score a shampoo concept against a targeted mood list.",
    values: {
      instruction: ["Analyze this shampoo packaging concept for the required moods and arousal levels."],
      requiredList: ["Calm", "Restorative", "Premium", "Natural"],
    },
  },
  {
    title: "Mouthwash Supervised",
    description: "Score a mouthwash concept against trust-related moods.",
    values: {
      instruction: ["Analyze this mouthwash packaging concept for the required moods and arousal levels."],
      requiredList: ["Fresh", "Clinical", "Trustworthy", "Precise"],
    },
  },
  {
    title: "Refill Supervised",
    description: "Score a refill concept against sustainability moods.",
    values: {
      instruction: ["Analyze this refill packaging concept for the required moods and arousal levels."],
      requiredList: ["Sustainable", "Calm", "Modern", "Minimal"],
    },
  },
];

const template: PromptTemplateModule<CanvasScanMoodsSupervisedVars, "instruction" | "requiredList"> = {
  metadata: {
    title: "Scan Moods Supervised",
    purpose: "Score a predefined mood list, or fall back to open mood discovery, against a referenced item.",
    sourceFiles: ["src/components/context-tray/llm/scan-moods.ts"],
    categories: ["canvas", "mixed-to-json", "mood-analysis"],
    inputType: "mixed",
    outputType: "json",
    model: "gemini-3-flash-preview",
    outputSchema,
    slots: {
      instruction: {
        description: "User-visible task instruction.",
        required: false,
        multiple: true,
        type: "text",
      },
      requiredList: {
        description: "Mood names that must appear in the result.",
        required: false,
        multiple: true,
        type: "text",
      },
    },
  },
  presets: canvasScanMoodsSupervisedPresets,
  template: ({ instruction, requiredList = [] }) => {
    const developer =
      requiredList.length > 0
        ? `Analyze the provided item and assign an arousal level to each of the following moods: ${requiredList.map((m) => `"${m}"`).join(", ")}.

      For each mood in the list, provide the exact mood string and an arousal level from 1 to 10, where 1 means the item has very low intensity of that mood and 10 means the item has very high intensity of that mood.

      Return ONLY valid JSON matching this schema:
      ${JSON.stringify(outputSchema, null, 2)}`
        : `Analyze the provided item and identify 3-5 moods it evokes.

      For each mood, provide a single English word with first letter Capitalized and an arousal level from 1 to 10, where 1 is calm/low energy and 10 is intense/high energy.

      Return ONLY valid JSON matching this schema:
      ${JSON.stringify(outputSchema, null, 2)}`;

    return {
      developer,
      user: toTextBlock(instruction, "Analyze this item for moods and arousal levels."),
    };
  },
};

export default template;
