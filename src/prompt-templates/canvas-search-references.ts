import type { PromptTemplateModule } from "./prompt-template.types";
import { toTextBlock } from "./prompt-template.utils";

const outputSchema = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          details: { type: "string" },
        },
        required: ["title", "details"],
      },
    },
  },
  required: ["results"],
} as const;

export interface CanvasSearchReferencesVars {
  prompt: string;
  contextText: string | string[];
  maxResults: number;
}

const canvasSearchReferencesPresets = [
  {
    title: "Refillable Shampoo Systems",
    description: "Search for real refill systems with no cards selected.",
    values: {
      prompt: "Refillable shampoo bottle systems with countertop-worthy primary bottles",
      contextText: [],
      maxResults: 8,
    },
  },
  {
    title: "Mouthwash Dosage Caps",
    description: "Search for dosage cap references using a selected concept card as context.",
    values: {
      prompt: "Mouthwash bottles with integrated dosage or measuring caps",
      contextText: [
        "Measured Clarity",
        "A transparent mouthwash bottle that shows the aqua rinse and pairs it with an intuitive integrated dosage cap.",
      ],
      maxResults: 6,
    },
  },
  {
    title: "Pouch Materials",
    description: "Search for mono-material refill pouch references from a selected image card.",
    values: {
      prompt: "Mono-material recyclable refill pouches for personal care",
      contextText: [
        "Refill Ritual",
        "Stand-up shampoo refill pouch with pearl matte film, compact screw cap, and translucent product window.",
        "Studio packshot of a pearl matte stand-up pouch on a pale stone surface, soft side light",
      ],
      maxResults: 4,
    },
  },
];

const template: PromptTemplateModule<CanvasSearchReferencesVars, "prompt" | "contextText" | "maxResults"> = {
  metadata: {
    title: "Search References",
    purpose:
      'Search the web (google_search tool) for distinct real-world references on a topic and stream them back as JSON results; each result becomes a card. Images of the selected cards are sent as image parts before the text. Afterwards, the search_references action renders one reference image per result with the image model, using the prompt `Search for and generate a clear, representative visual reference image of "<title>". <details>\\nSearch topic: <prompt>. Clean single-subject presentation, no text labels or watermarks.`',
    sourceFiles: ["src/components/context-tray/llm/search-images.ts", "src/lib/actions/defs/generate.ts"],
    categories: ["canvas", "mixed-to-json", "reference-search"],
    inputType: "mixed",
    outputType: "json",
    model: "gemini-4-hydrogen",
    outputSchema,
    slots: {
      prompt: {
        description: "Search topic entered by the user (trimmed).",
        required: true,
        multiple: false,
        type: "text",
      },
      contextText: {
        description:
          "Title, body, and image prompt of each selected card (empty fields skipped), one per line. Omitted from the prompt when empty.",
        required: false,
        multiple: true,
        type: "text",
      },
      maxResults: {
        description: "Number of results to request (action default 8, max 8). Extra streamed results are ignored.",
        required: true,
        multiple: false,
        type: "number",
      },
    },
  },
  presets: canvasSearchReferencesPresets,
  template: ({ prompt = "", contextText, maxResults = 8 }) => {
    const context = toTextBlock(contextText);

    return {
      user: `Search online to find the top ${maxResults} most representative, distinct real-world products, references, or projects for the request below.
For each result, return:
- "title": exact, concise name (product, project, or reference title, max 6 words).
- "details": precise, concise 1-2 sentence description of its key visual features, materials/form, and why it is a strong reference.
Keep entries accurate, specific, and non-redundant.

Request: ${prompt.trim()}${context ? `\n\nSelected canvas context:\n${context}` : ""}`,
    };
  },
};

export default template;
