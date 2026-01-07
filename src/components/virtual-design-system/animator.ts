import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import type { LibraryItem } from "../../assets/library/index";

export interface GeminiConnection {
  apiKey: string;
}

/**
 * Generates an animation prompt for a video AI based on the selected components.
 */
export async function generateAnimationPrompt(
  connection: GeminiConnection,
  components: LibraryItem[],
): Promise<string> {
  const shape = components.find((c) => c.type === "shape");
  const cap = components.find((c) => c.type === "cap");
  const material = components.find((c) => c.type === "material");
  const surface = components.find((c) => c.type === "surface");

  if (!shape || !cap || !material || !surface) {
    throw new Error("Missing required components: shape, cap, material, or surface");
  }

  const ai = new GoogleGenAI({
    apiKey: connection.apiKey,
  });

  const interactionContext = cap.interactionHint
    ? `Interaction hint: ${cap.interactionHint}`
    : "Describe a natural and ergonomic way to dispense from this container.";

  const prompt = `
Generate a concise interaction prompt for an image-to-video AI. The AI already sees the image.
Focus on describing ONE fluid, natural interaction involving a hand and the container.

Context:
- Cap & Interaction: ${cap.name}. ${interactionContext}
- Material: ${material.name} (${material.description})

Task:
Describe a single continuous motion covering:
1. How a hand interacts with the ${material.name} container and ${cap.name}.
2. How the content is dispensed from the ${cap.name}.
3. Where the content ends up (e.g., onto the palm of the other hand).

The output should be a single, descriptive sentence suitable for a video generation prompt.
Prefer single-hand operation if the design allows it.

Output ONLY the interaction prompt text. No preamble or meta-talk.
  `.trim();

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      thinkingConfig: {
        thinkingLevel: ThinkingLevel.LOW,
      },
    },
  });

  // The reference implementation uses .text property
  return (response as any).text;
}
