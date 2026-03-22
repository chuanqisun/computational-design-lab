import { studioReviseSceneXmlPresets } from "./prompt-template.presets";
import type { PromptTemplateModule } from "./prompt-template.types";
import { toTextBlock } from "./prompt-template.utils";

export interface StudioReviseSceneXmlVars {
  currentXml: string;
  editInstructions: string | string[];
}

const template: PromptTemplateModule<StudioReviseSceneXmlVars, "currentXml" | "editInstructions"> = {
  metadata: {
    title: "Revise Scene XML",
    sourceFiles: ["src/lib/studio-ai.ts", "src/studio-page.ts"],
    categories: ["studio", "text-to-xml", "revision"],
    inputType: "mixed",
    outputType: "xml",
    slots: {
      currentXml: {
        description: "Current scene XML to revise.",
        required: true,
        multiple: false,
        type: "xml",
      },
      editInstructions: {
        description: "Revision instructions applied to the provided scene XML.",
        required: true,
        multiple: true,
        type: "text",
      },
    },
  },
  presets: studioReviseSceneXmlPresets,
  template: ({ currentXml = "", editInstructions }) => ({
    user: `Revise the XML based on these instructions. Output only the updated XML, nothing else.

Current XML:
${currentXml}

${toTextBlock(editInstructions)}`,
  }),
};

export default template;
