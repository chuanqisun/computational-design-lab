import type { PromptTemplateModule } from "./prompt-template.types";

const outputSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    body: { type: "string" },
  },
  required: ["title", "body"],
} as const;

export interface CanvasSummarizeInterviewVars {
  personaName: string;
  personaProfile: string;
  discussedItems: string[];
  transcript: string[];
}

const canvasSummarizeInterviewPresets = [
  {
    title: "Shampoo Bottle Findings",
    description: "Summarize a short interview comparing two shampoo bottles.",
    values: {
      personaName: "Maya Chen",
      personaProfile:
        "34-year-old product designer who reads every ingredient list before buying shampoo. She wants packaging that looks calm and credible in a premium bathroom.",
      discussedItems: [
        '- Item 1 ("Matte Eucalyptus"): Rounded matte shampoo bottle with a eucalyptus green cap and minimal recessed label.',
        '- Item 2 ("Gloss Botanica"): Glossy shampoo bottle with high-contrast botanical graphics and a metallic cap.',
      ],
      transcript: [
        "Interviewer: Which of these two bottles would you pick up first, and why?",
        "Maya Chen: The matte eucalyptus one. It looks quiet and honest, like it isn't trying to sell me anything.",
        "Interviewer: What about the glossy botanical one?",
        "Maya Chen: It's pretty, but the busy graphics make me suspect the formula is mostly fragrance. I'd also worry it shows every water spot.",
      ],
    },
  },
  {
    title: "Mouthwash Cap Findings",
    description: "Summarize a parent's reaction to a dosage cap concept.",
    values: {
      personaName: "Daniel Okafor",
      personaProfile:
        "41-year-old school administrator and parent of two. He compares mouthwash packs for the family and cares most about visible dosage cues and clinical trustworthiness.",
      discussedItems: [
        '- Item 1 ("Measured Clarity"): Transparent aqua mouthwash bottle with a measured dosage cap and crisp white label.',
      ],
      transcript: [
        "Interviewer: Would you let your kids use this bottle on their own?",
        "Daniel Okafor: Probably, because I can see the fill lines on the cap. But the cap needs to be child-resistant or I'd keep it on the top shelf.",
        "Interviewer: Is the dosage clear enough?",
        "Daniel Okafor: The lines are good, but I'd want a number printed next to them, not just a mark.",
      ],
    },
  },
  {
    title: "Open Refill Conversation",
    description: "Summarize an open conversation with no discussed cards.",
    values: {
      personaName: "Sam Rivera",
      personaProfile:
        "29-year-old environmental consultant who switches to refill systems whenever they are easy to use and look good enough to keep on the counter.",
      discussedItems: [],
      transcript: [
        "Interviewer: What would make you give up on a refill system?",
        "Sam Rivera: Spills. If pouring the refill makes a mess even once, I'm back to buying bottles.",
        "Interviewer: Anything else?",
        "Sam Rivera: Pouches that don't fully empty. Seeing product trapped in the corners feels like the opposite of sustainable.",
      ],
    },
  },
];

const template: PromptTemplateModule<
  CanvasSummarizeInterviewVars,
  "personaName" | "personaProfile" | "discussedItems" | "transcript"
> = {
  metadata: {
    title: "Summarize Interview",
    purpose:
      "Turn a persona interview transcript (from the live voice interview or the text interview) into a summary card with a short title and actionable design findings.",
    sourceFiles: ["src/components/context-tray/llm/interview.ts", "src/lib/actions/defs/media.ts"],
    categories: ["canvas", "text-to-json", "interview"],
    inputType: "text",
    outputType: "json",
    model: "gemini-4-hydrogen",
    outputSchema,
    slots: {
      personaName: {
        description: 'Persona card title (falls back to "Synthetic User").',
        required: true,
        multiple: false,
        type: "text",
      },
      personaProfile: {
        description: "Persona card body (falls back to the persona name).",
        required: false,
        multiple: false,
        type: "text",
      },
      discussedItems: {
        description:
          'One line per discussed card, formatted as `- Item N ("<title>"): <body>` (title and body parts omitted when empty). Omit for an open conversation.',
        required: false,
        multiple: true,
        type: "text",
      },
      transcript: {
        description: "Transcript turns, one per line, formatted as `<speaker>: <text>`.",
        required: true,
        multiple: true,
        type: "text",
      },
    },
  },
  presets: canvasSummarizeInterviewPresets,
  template: ({ personaName = "", personaProfile = "", discussedItems = [], transcript = [] }) => {
    const resolvedName = personaName.trim() || "Synthetic User";
    const discussed = discussedItems.join("\n");
    const transcriptText = transcript.join("\n");

    return {
      user: `Summarize the following live user-research interview with ${resolvedName} into concise, actionable design findings for a moodboard card.

Persona Profile:
${personaProfile.trim() || resolvedName}
${discussed ? `\nDiscussed Canvas Items:\n${discussed}\n` : ""}
Interview Transcript:
${transcriptText}

Return a JSON object with:
- "title": a short, descriptive card title (max 6 words) referencing ${resolvedName} or the main finding.
- "body": a concise summary of key takeaways, pain points, preferences, and design recommendations (3-5 sentences or compact bullet points).`,
    };
  },
};

export default template;
