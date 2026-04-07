import { studioGenerateSoundDescriptionPresets } from "./prompt-template.presets";
import type { PromptTemplateModule } from "./prompt-template.types";
import { toTextBlock } from "./prompt-template.utils";

export interface StudioGenerateSoundDescriptionVars {
  sceneXml: string;
  animationPrompt: string | string[];
}

const template: PromptTemplateModule<StudioGenerateSoundDescriptionVars, "sceneXml" | "animationPrompt"> = {
  metadata: {
    title: "Generate Sound Description",
    purpose: "Generate a natural-language sound description for a product animation based on scene XML and motion instructions.",
    sourceFiles: ["src/lib/studio-ai.ts"],
    categories: ["studio", "mixed-to-text", "sound-design"],
    inputType: "mixed",
    outputType: "text",
    slots: {
      sceneXml: {
        description: "Scene XML used as the visual basis.",
        required: true,
        multiple: false,
        type: "xml",
      },
      animationPrompt: {
        description: "Motion prompt or animation description.",
        required: true,
        multiple: true,
        type: "text",
      },
    },
  },
  presets: studioGenerateSoundDescriptionPresets,
  template: ({ sceneXml = "", animationPrompt }) => ({
    user: `Given the following product scene XML and an animation prompt, generate a short sound description that would accompany this animation. Describe the sounds naturally (e.g., mechanical clicks, liquid pouring, material textures). Output ONLY the sound description text, nothing else.

Scene XML:
${sceneXml}

Animation prompt: ${toTextBlock(animationPrompt)}`,
  }),
};

export default template;
