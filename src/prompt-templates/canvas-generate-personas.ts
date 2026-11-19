import type { PromptTemplateModule } from "./prompt-template.types";
import { formatVoiceCatalogForPrompt, GEMINI_LIVE_VOICE_NAMES } from "../lib/gemini-voices";

const outputSchema = {
  type: "object",
  properties: {
    personas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" },
          gender: { type: "string", enum: ["female", "male", "neutral"] },
          occupation: { type: "string" },
          description: { type: "string" },
          voiceName: { type: "string", enum: [...GEMINI_LIVE_VOICE_NAMES] },
        },
        required: ["name", "age", "gender", "occupation", "description", "voiceName"],
      },
    },
  },
  required: ["personas"],
} as const;

export interface CanvasGeneratePersonasVars {
  trait: string;
  segment: string;
  numUsers: number;
}

const canvasGeneratePersonasPresets = [
  {
    title: "Salon-Lite Shoppers",
    description: "Generate personas for a premium botanical shampoo segment.",
    values: {
      trait: "ingredient consciousness",
      segment: "Premium shampoo shoppers, urban professionals",
      numUsers: 3,
    },
  },
  {
    title: "Family Oral Care",
    description: "Create personas for approachable mouthwash packaging decisions.",
    values: {
      trait: "trust in clinical cues",
      segment: "Parents shopping for family oral care",
      numUsers: 4,
    },
  },
  {
    title: "Eco Refill Buyers",
    description: "Generate refill-oriented packaging personas.",
    values: {
      trait: "willingness to adopt refill systems",
      segment: "Sustainability-minded personal care buyers",
      numUsers: 3,
    },
  },
];

const template: PromptTemplateModule<CanvasGeneratePersonasVars, "trait" | "segment" | "numUsers"> = {
  metadata: {
    title: "Generate Personas",
    purpose:
      "Generate synthetic user personas (name, age, gender, occupation, description, Gemini Live voice) that vary along a chosen trait within an optional segment.",
    sourceFiles: [
      "src/components/context-tray/llm/synthetic-users.ts",
      "src/lib/actions/defs/media.ts",
      "src/lib/gemini-voices.ts",
    ],
    categories: ["canvas", "text-to-json", "persona-generation"],
    inputType: "text",
    outputType: "json",
    model: "gemini-4-hydrogen",
    outputSchema,
    slots: {
      trait: {
        description: "Trait to vary across personas.",
        required: true,
        multiple: false,
        type: "text",
      },
      segment: {
        description: 'Optional market or demographic segment ("All" or empty means no segment).',
        required: false,
        multiple: false,
        type: "text",
      },
      numUsers: {
        description: "How many personas to generate.",
        required: true,
        multiple: false,
        type: "number",
      },
    },
  },
  presets: canvasGeneratePersonasPresets,
  template: ({ trait = "", segment, numUsers = 3 }) => {
    const segmentText = segment && segment !== "All" ? ` in the segment: ${segment}` : "";

    return {
      user: `Generate ${numUsers} synthetic user personas${segmentText}. Each persona should have varying levels of "${trait}". Give them realistic names, ages, genders ("female", "male", or "neutral" for non-binary / gender-neutral personas), occupations, a brief 2-3 sentence description of their personality and how "${trait}" manifests in their life, and a matching Gemini Live voiceName.

Assign each persona a distinct voiceName from the Gemini Live catalog below, matching female personas to female voices, male personas to male voices, and gender-neutral ("neutral") personas to a balanced or personality-fitting voice:
${formatVoiceCatalogForPrompt()}`,
    };
  },
};

export default template;
