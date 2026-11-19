import type { PromptTemplateModule } from "./prompt-template.types";

export interface CanvasSearchReferenceImageVars {
  resultTitle: string;
  resultDetails: string;
  searchTopic: string;
}

const canvasSearchReferenceImagePresets = [
  {
    title: "Refill Pouch Reference",
    description: "Image request for one result of a search on refillable shampoo packaging.",
    values: {
      resultTitle: "Spouted Refill Pouch",
      resultDetails:
        "Flexible stand-up pouch with a wide screw spout that decants shampoo into a reusable countertop bottle with minimal mess.",
      searchTopic: "refillable shampoo packaging",
    },
  },
  {
    title: "Mouthwash Dosing Cap Reference",
    description: "Image request for one result of a search on mouthwash dosing caps.",
    values: {
      resultTitle: "Squeeze-to-Dose Chamber",
      resultDetails:
        "Clear measuring chamber on top of the bottle that fills to a fixed dose when the bottle is squeezed, then pours from the chamber only.",
      searchTopic: "mouthwash bottle dosing mechanisms",
    },
  },
];

const template: PromptTemplateModule<CanvasSearchReferenceImageVars, "resultTitle" | "resultDetails" | "searchTopic"> =
  {
    metadata: {
      title: "Search Reference Image",
      purpose:
        "Second step of Search (search_references action): for each streamed search result, ask the image model (with Google web + image search grounding, 1:1, 1K) to find and render a representative reference image for the result card.",
      sourceFiles: ["src/lib/actions/defs/generate.ts", "src/components/context-tray/llm/search-images.ts"],
      categories: ["canvas", "text-to-image", "search", "references"],
      inputType: "text",
      outputType: "image",
      model: "gemini-nano-banana-2.1",
      slots: {
        resultTitle: {
          description: "Title of the search result (also the card title).",
          required: true,
          multiple: false,
          type: "text",
        },
        resultDetails: {
          description: "Details of the search result (also the card body).",
          required: true,
          multiple: false,
          type: "text",
        },
        searchTopic: {
          description: "The user's trimmed search prompt.",
          required: true,
          multiple: false,
          type: "text",
        },
      },
    },
    presets: canvasSearchReferenceImagePresets,
    template: ({ resultTitle = "", resultDetails = "", searchTopic = "" }) => ({
      user: `Search for and generate a clear, representative visual reference image of "${resultTitle}". ${resultDetails}\nSearch topic: ${searchTopic}. Clean single-subject presentation, no text labels or watermarks.`,
    }),
  };

export default template;
