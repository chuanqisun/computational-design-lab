import { buildLensQuestion } from "../components/context-tray/llm/rate-lenses";
import type { PromptTemplateModule } from "./prompt-template.types";

const outputSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["choice"] },
    choice: { type: "string", description: "Lens key with the highest probability." },
    probabilities: {
      type: "object",
      description: "Calibrated probability per lens key, summing to 1.",
      additionalProperties: { type: "number" },
    },
    confidence: { type: "number", description: "Probability of the chosen lens." },
  },
  required: ["type", "choice", "probabilities", "confidence"],
} as const;

export interface CanvasRateLensesVars {
  cardTexts: string[];
}

const canvasRateLensesPresets = [
  {
    title: "Shampoo Bottle Pair",
    description: "Which scan lens fits two shampoo bottle cards best?",
    values: {
      cardTexts: [
        "Matte Eucalyptus: Rounded matte shampoo bottle with a eucalyptus green cap and minimal recessed label.",
        "Gloss Botanica: Glossy shampoo bottle with high-contrast botanical graphics and a metallic cap.",
      ],
    },
  },
  {
    title: "Mouthwash Dosage Cap",
    description: "Rate lenses for a single mouthwash concept card.",
    values: {
      cardTexts: [
        "Measured Clarity: Transparent aqua mouthwash bottle with a measured dosage cap that clicks at each fill line.",
      ],
    },
  },
  {
    title: "Refill Ritual",
    description: "Rate lenses for a refill pouch and countertop bottle system.",
    values: {
      cardTexts: [
        "Refill Ritual: Pearl matte refill pouch with a translucent product window and a pour spout.",
        "Countertop System: Heavy reusable glass bottle with a brushed aluminum pump, refilled weekly from the pouch.",
      ],
    },
  },
];

const template: PromptTemplateModule<CanvasRateLensesVars, "cardTexts"> = {
  metadata: {
    title: "Rate Scan Lenses",
    purpose:
      "Gemini Decisions API (ai.decisions.create) call, not a chat prompt: one `choice` question whose options are the Scan lenses, evaluated against the selected cards. The lenses compete for probability mass, and the returned per-lens probabilities drive the Scan tool's meter bars (lengths are relative to the top lens). Rendered here as the question instructions, one `key: description` line per option, then the card text input parts.",
    sourceFiles: [
      "src/components/context-tray/llm/rate-lenses.ts",
      "src/lib/actions/defs/generate.ts",
      "src/components/context-tray/tools/conceptual-scan.tool.ts",
    ],
    categories: ["canvas", "mixed-to-json", "decision"],
    inputType: "mixed",
    outputType: "json",
    model: "gemini-decision-1",
    outputSchema,
    slots: {
      cardTexts: {
        description:
          "One text input part per selected card that has a title or body, formatted as `<title>: <body>` (each part ends with a newline). A card's image, if any, is sent as an image input part just before its text.",
        required: true,
        multiple: true,
        type: "text",
      },
    },
  },
  presets: canvasRateLensesPresets,
  template: ({ cardTexts = [] }) => {
    const { instructions, criteria } = buildLensQuestion();
    const instructionText = typeof instructions === "string" ? instructions : "";
    const options = Object.entries(criteria)
      .map(([key, description]) => `${key}: ${description}`)
      .join("\n");
    // Each input part ends with "\n" (as built by buildDecisionInput); joining with "\n" leaves a blank line between parts.
    const inputParts = cardTexts.map((text) => `${text}\n`).join("\n");

    return {
      user: [instructionText, options, inputParts].filter(Boolean).join("\n\n"),
    };
  },
};

export default template;
