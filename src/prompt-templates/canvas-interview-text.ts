import type { CanvasItem } from "../components/canvas/canvas.component";
import { buildInterviewSystemPrompt } from "../components/context-tray/llm/interview";
import type { PromptTemplateModule } from "./prompt-template.types";

export interface CanvasInterviewTextVars {
  personaName: string;
  personaProfile: string;
  personaGender: string;
  contextItems: string[];
  questions: string[];
}

const canvasInterviewTextPresets = [
  {
    title: "Shampoo Bottle Q&A",
    description: "Ask an ingredient-conscious shopper to compare two shampoo bottle concepts.",
    values: {
      personaName: "Maya Chen",
      personaProfile:
        "34-year-old product designer who reads every ingredient list before buying shampoo. She wants packaging that looks calm and credible in a premium bathroom.",
      personaGender: "female",
      contextItems: [
        "Title: Matte Eucalyptus\nBody: Rounded matte shampoo bottle with a eucalyptus green cap and minimal recessed label.",
        "Title: Gloss Botanica\nBody: Glossy shampoo bottle with high-contrast botanical graphics and a metallic cap.",
      ],
      questions: [
        "Which of these two bottles would you pick up first on the shelf, and why?",
        "What on either label makes you trust or doubt the ingredients?",
        "How would each bottle look in your bathroom after a month of use?",
      ],
    },
  },
  {
    title: "Mouthwash Trust Check",
    description: "Probe a parent's trust in a mouthwash dosage cap concept.",
    values: {
      personaName: "Daniel Okafor",
      personaProfile:
        "41-year-old school administrator and parent of two. He compares mouthwash packs for the family and cares most about visible dosage cues and clinical trustworthiness.",
      personaGender: "male",
      contextItems: [
        "Title: Measured Clarity\nBody: Transparent aqua mouthwash bottle with a measured dosage cap and crisp white label.",
      ],
      questions: [
        "Would you let your kids use this bottle on their own? What would worry you?",
        "Does the dosage cap feel clear enough to use half-asleep in the morning?",
      ],
    },
  },
  {
    title: "Refill Habits Interview",
    description: "Open-ended questions about refill routines with no design cards selected.",
    values: {
      personaName: "Sam Rivera",
      personaProfile:
        "29-year-old environmental consultant who switches to refill systems whenever they are easy to use and look good enough to keep on the counter.",
      personaGender: "neutral",
      contextItems: [],
      questions: [
        "Walk me through the last time you refilled a personal care product at home.",
        "What would make you give up on a refill system after a few weeks?",
      ],
    },
  },
];

const template: PromptTemplateModule<
  CanvasInterviewTextVars,
  "personaName" | "personaProfile" | "personaGender" | "contextItems" | "questions"
> = {
  metadata: {
    title: "Text Interview",
    purpose:
      "Text equivalent of the live voice interview, used by the interview_persona action when questions are given. Uses the same persona system prompt plus a text-mode instruction. Each question is a separate interaction chained via previous_interaction_id; the selected cards' context parts are sent only with the first question. The questions and answers form the transcript that is then summarized into a card.",
    sourceFiles: [
      "src/components/context-tray/llm/interview-text.ts",
      "src/components/context-tray/llm/interview.ts",
      "src/lib/actions/defs/media.ts",
    ],
    categories: ["canvas", "mixed-to-text", "interview"],
    inputType: "mixed",
    outputType: "text",
    model: "gemini-4-hydrogen",
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
          'One entry per selected non-persona card: its text lines ("Title: …", "Body: …", and "Image prompt: …" only when the card has no image). Each card\'s image, if any, is attached as an image part right after its text. Sent with the first question only.',
        required: false,
        multiple: true,
        type: "text",
      },
      questions: {
        description:
          "Interview questions (1-8). Each is sent as its own user turn, in order, after the model has answered the previous one.",
        required: true,
        multiple: true,
        type: "text",
      },
    },
  },
  presets: canvasInterviewTextPresets,
  template: ({ personaName = "", personaProfile = "", personaGender, contextItems = [], questions = [] }) => {
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
    const resolvedName = personaName.trim() || "Synthetic User";

    const contextParts =
      contextItems.length > 0
        ? [
            `Here are the ${contextItems.length} selected canvas ${contextItems.length === 1 ? "item" : "items"} we are discussing in this interview:`,
            ...contextItems.map((text, index) => [`Item ${index + 1}:`, text.trim()].filter(Boolean).join("\n")),
          ]
        : [];

    return {
      developer: `${buildInterviewSystemPrompt(personaCard, contextCards)}
- This interview happens in text. Answer each question in 2-4 natural sentences, in first person, as ${resolvedName}.`,
      user: [...contextParts, ...questions].join("\n\n"),
    };
  },
};

export default template;
