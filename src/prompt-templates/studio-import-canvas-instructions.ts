import { studioImportCanvasInstructionsPresets } from "./prompt-template.presets";
import type { PromptTemplateModule } from "./prompt-template.types";

export interface StudioImportCanvasInstructionsVars {
  cardDescriptions: string[];
}

const template: PromptTemplateModule<StudioImportCanvasInstructionsVars, "cardDescriptions"> = {
  metadata: {
    title: "Canvas to Studio conversion",
    purpose: "Convert imported canvas concept card descriptions into studio-specific bottle design guidance.",
    sourceFiles: ["src/studio-page.ts"],
    categories: ["studio", "text-to-text", "input-prep"],
    inputType: "text",
    outputType: "text",
    slots: {
      cardDescriptions: {
        description: "Canvas card descriptions merged into studio custom instructions.",
        required: false,
        multiple: true,
        type: "text",
      },
    },
  },
  presets: studioImportCanvasInstructionsPresets,
  template: ({ cardDescriptions = [] }) => ({
    user: `Design a bottle inspired by the following design concept(s):

${cardDescriptions.join("\n\n")}

Use these concepts to guide the bottle's form, material, texture, color, and overall aesthetic.`,
  }),
};

export default template;
