import type { PromptTemplateModule } from "./prompt-template.types";
import { toTextBlock } from "./prompt-template.utils";

export interface StudioReviseSceneXmlVars {
  currentXml: string;
  editInstructions: string | string[];
}

const shampooSceneXml = `<scene>
  <subject>
    <product category="shampoo bottle">Tall rounded bottle with a soft shoulder, wide flip-top cap, and subtle front label recess.</product>
    <finish>Warm white PET body with a satin eucalyptus green cap and soft-touch label.</finish>
  </subject>
  <setting>
    <environment>White infinity cove studio</environment>
    <background>Minimal, bright, and clean</background>
  </setting>
  <camera lens="85mm" angle="three-quarter front" distance="mid" depth-of-field="shallow" />
  <lighting source="large softbox" direction="front-left" contrast="soft" colorTemperature="neutral daylight" />
  <style medium="Studio keyshot" grade="clean commercial product render" />
</scene>`;

const mouthwashSceneXml = `<scene>
  <subject>
    <product category="mouthwash bottle">Clear rectangular bottle with beveled shoulders, integrated dosage cap, and a crisp front label panel.</product>
    <liquid>Cool aqua rinse visible through the transparent body.</liquid>
  </subject>
  <setting>
    <environment>White infinity cove studio</environment>
    <background>Clinical, bright, and slightly reflective</background>
  </setting>
  <camera lens="100mm" angle="straight-on hero" distance="mid-close" depth-of-field="moderate" />
  <lighting source="strip lights" direction="side and top" contrast="medium" colorTemperature="cool daylight" />
  <style medium="Studio keyshot" grade="clinical premium retail" />
</scene>`;

const refillSceneXml = `<scene>
  <subject>
    <product category="refill pouch">Flexible stand-up pouch for haircare with a compact screw cap and folded gusset base.</product>
    <finish>Matte pearl film with a translucent product window.</finish>
  </subject>
  <setting>
    <environment>White infinity cove studio</environment>
    <background>Quiet, sustainable, and editorial</background>
  </setting>
  <camera lens="70mm" angle="slightly elevated" distance="mid" depth-of-field="shallow" />
  <lighting source="soft overhead panel" direction="top-front" contrast="soft" colorTemperature="warm neutral" />
  <style medium="Studio keyshot" grade="sustainable premium packaging render" />
</scene>`;

const studioReviseSceneXmlPresets = [
  {
    title: "Revise For Softer Light",
    description: "Adjust a shampoo scene toward warmer, gentler presentation.",
    values: {
      currentXml: shampooSceneXml,
      editInstructions: [
        "Keep the bottle geometry unchanged.",
        "Soften the lighting, warm the color temperature slightly, and make the label feel more tactile and premium.",
      ],
    },
  },
  {
    title: "Revise For Dosage Demo",
    description: "Revise a mouthwash scene for clearer cap interaction cues.",
    values: {
      currentXml: mouthwashSceneXml,
      editInstructions: [
        "Update the subject description so the measured dosage cap reads more clearly in the scene.",
        "Preserve the clean studio environment and emphasize liquid visibility.",
      ],
    },
  },
  {
    title: "Revise For Sustainability",
    description: "Push a refill concept toward a more tactile sustainable mood.",
    values: {
      currentXml: refillSceneXml,
      editInstructions: [
        "Make the refill pouch material feel more premium and mono-material.",
        "Introduce subtle cues that it belongs in a calm, sustainable bathroom ritual.",
      ],
    },
  },
];

const template: PromptTemplateModule<StudioReviseSceneXmlVars, "currentXml" | "editInstructions"> = {
  metadata: {
    title: "Revise Scene XML",
    purpose: "Revise an existing scene XML document based on editing instructions.",
    sourceFiles: ["src/lib/studio-ai.ts", "src/studio-page.ts"],
    categories: ["studio", "text-to-xml", "revision"],
    inputType: "mixed",
    outputType: "xml",
    model: "gemini-3-flash-preview",
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
