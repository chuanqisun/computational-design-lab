import { studioStagePhotoScenePresets } from "./prompt-template.presets";
import type { PromptTemplateModule } from "./prompt-template.types";
import { toTextBlock } from "./prompt-template.utils";

export interface StudioStagePhotoSceneVars {
  currentXml: string;
  scene: string | string[];
  brandGuide?: string | string[];
}

const template: PromptTemplateModule<StudioStagePhotoSceneVars, "currentXml" | "scene" | "brandGuide"> = {
  metadata: {
    title: "Stage Photo Scene",
    sourceFiles: ["src/lib/studio-ai.ts", "src/studio-page.ts"],
    categories: ["studio", "text-to-xml", "photo-staging"],
    inputType: "text",
    outputType: "xml",
    slots: {
      currentXml: {
        description: "Current synthesized product scene XML.",
        required: true,
        multiple: false,
        type: "xml",
      },
      scene: {
        description: "Desired photo scene or scenario.",
        required: true,
        multiple: true,
        type: "text",
      },
      brandGuide: {
        description: "Optional brand guidelines to follow while staging the photo scene.",
        required: false,
        multiple: true,
        type: "text",
      },
    },
  },
  presets: studioStagePhotoScenePresets,
  template: ({ currentXml = "", scene, brandGuide }) => ({
    system: toTextBlock(brandGuide)
      ? `You stage product photo scenes as XML. Follow the provided brand guide when choosing styling, materials, atmosphere, prop language, and visual tone. Output only XML, nothing else.\n\nBrand guide:\n${toTextBlock(brandGuide)}`
      : undefined,
    user: `Given this product XML and a desired photo scene, generate a new XML that places the product in the specified scene. In the <subject>, make sure <product> and <hand> and their relationship is clearly specified. Output only the updated XML, nothing else.

Current XML:
${currentXml}

Photo scene: ${toTextBlock(scene)}`,
  }),
};

export default template;
