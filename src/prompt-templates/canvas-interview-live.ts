import type { CanvasItem } from "../components/canvas/canvas.component";
import { buildInterviewSystemPrompt } from "../components/context-tray/llm/interview";
import type { PromptTemplateModule } from "./prompt-template.types";

export interface CanvasInterviewLiveVars {
  personaName: string;
  personaProfile: string;
  personaGender: string;
  contextItems: string[];
}

const canvasInterviewLivePresets = [
  {
    title: "Shampoo Bottle Walkthrough",
    description: "Voice-interview an ingredient-conscious shopper about two shampoo bottle concepts.",
    values: {
      personaName: "Maya Chen",
      personaProfile:
        "34-year-old product designer who reads every ingredient list before buying shampoo. She wants packaging that looks calm and credible in a premium bathroom.",
      personaGender: "female",
      contextItems: [
        "Title: Matte Eucalyptus\nBody: Rounded matte shampoo bottle with a eucalyptus green cap and minimal recessed label.",
        "Title: Gloss Botanica\nBody: Glossy shampoo bottle with high-contrast botanical graphics and a metallic cap.",
      ],
    },
  },
  {
    title: "Mouthwash Dosage Cap",
    description: "Discuss a single mouthwash concept (image not yet rendered) with a trust-seeking parent.",
    values: {
      personaName: "Daniel Okafor",
      personaProfile:
        "41-year-old school administrator and parent of two. He compares mouthwash packs for the family and cares most about visible dosage cues and clinical trustworthiness.",
      personaGender: "male",
      contextItems: [
        "Title: Measured Clarity\nBody: Transparent aqua mouthwash bottle with a measured dosage cap.\nImage prompt: Product photo of a transparent aqua mouthwash bottle with a white measuring cap on a bathroom shelf",
      ],
    },
  },
  {
    title: "Open Refill Conversation",
    description: "No cards selected: an open conversation about refill habits with a gender-neutral persona.",
    values: {
      personaName: "Sam Rivera",
      personaProfile:
        "29-year-old environmental consultant who switches to refill systems whenever they are easy to use and look good enough to keep on the counter.",
      personaGender: "neutral",
      contextItems: [],
    },
  },
];

const template: PromptTemplateModule<
  CanvasInterviewLiveVars,
  "personaName" | "personaProfile" | "personaGender" | "contextItems"
> = {
  metadata: {
    title: "Live Voice Interview",
    purpose:
      "Gemini Live session that role-plays a synthetic-user persona card in a spoken user-research interview. The persona prompt is the session system instruction (voice is the persona's prebuilt Gemini Live voice); the selected design cards are sent once as an initial client-content turn, after which the interviewer's microphone audio streams in and the persona answers in audio. Input and output transcriptions become the transcript that is later summarized.",
    sourceFiles: [
      "src/components/context-tray/llm/interview.ts",
      "src/components/context-tray/tools/user-testing.tool.ts",
      "src/lib/gemini-voices.ts",
    ],
    categories: ["canvas", "live-audio", "interview"],
    inputType: "mixed",
    outputType: "audio",
    model: "gemini-3.8-live",
    slots: {
      personaName: {
        description: 'Persona card title (falls back to "Synthetic User").',
        required: true,
        multiple: false,
        type: "text",
      },
      personaProfile: {
        description: 'Persona card body (falls back to "A thoughtful design research participant.").',
        required: true,
        multiple: false,
        type: "text",
      },
      personaGender: {
        description:
          'Persona gender from the card metadata ("female", "male", or anything else = "neutral"). Neutral personas get an extra gender-neutral instruction line.',
        required: false,
        multiple: false,
        type: "text",
      },
      contextItems: {
        description:
          'One entry per selected non-persona card: its text lines ("Title: …", "Body: …", and "Image prompt: …" only when the card has no image). Each card\'s image, if any, is attached as an inline image part right after its text. Empty list = open conversation with no context turn.',
        required: false,
        multiple: true,
        type: "text",
      },
    },
  },
  presets: canvasInterviewLivePresets,
  template: ({ personaName = "", personaProfile = "", personaGender, contextItems = [] }) => {
    const personaCard: CanvasItem = {
      id: "persona",
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      title: personaName,
      body: personaProfile,
      metadata: { gender: personaGender },
    };
    const contextCards: CanvasItem[] = contextItems.map((_, index) => ({
      id: `item-${index + 1}`,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    }));

    const contextParts =
      contextItems.length > 0
        ? [
            `Here are the ${contextItems.length} selected canvas ${contextItems.length === 1 ? "item" : "items"} we are discussing in this interview:`,
            ...contextItems.map((text, index) => [`Item ${index + 1}:`, text.trim()].filter(Boolean).join("\n")),
          ]
        : [];

    return {
      developer: buildInterviewSystemPrompt(personaCard, contextCards),
      user: contextParts.join("\n\n"),
    };
  },
};

export default template;
