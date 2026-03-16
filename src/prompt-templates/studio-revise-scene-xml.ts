import type { PromptTemplateModule } from "./prompt-template.types";

export interface StudioReviseSceneXmlVars {
  editInstructions: string;
}

const template: PromptTemplateModule<StudioReviseSceneXmlVars, "editInstructions"> = {
  metadata: {
    title: "Revise Scene XML",
    sourceFiles: ["src/lib/studio-ai.ts", "src/studio-page.ts"],
    categories: ["studio", "text-to-xml", "revision"],
    inputType: "text",
    outputType: "xml",
    slots: {
      editInstructions: {
        description: "Revision instructions applied on top of prior XML conversation history.",
        required: true,
        multiple: true,
        type: "text",
      },
    },
  },
  template: ({ editInstructions = "" }) => ({
    user: `Revise the XML based on these instructions. Output only the updated XML, nothing else.

${editInstructions}`,
  }),
};

export default template;