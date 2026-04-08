import type { PromptTemplateModule } from "./prompt-template.types";
import { toTextBlock } from "./prompt-template.utils";

export interface StudioGenerateSoundDescriptionVars {
  sceneXml: string;
  animationPrompt: string | string[];
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

const studioGenerateSoundDescriptionPresets = [
  {
    title: "Shampoo Cap Flip Sound",
    description: "Describe sound for a shampoo product interaction.",
    values: {
      sceneXml: shampooSceneXml,
      animationPrompt: [
        "The hand flips open the cap, squeezes a small ribbon of shampoo, and closes the bottle with a soft snap.",
      ],
    },
  },
  {
    title: "Mouthwash Pour Sound",
    description: "Describe sound for a mouthwash dosage motion.",
    values: {
      sceneXml: mouthwashSceneXml,
      animationPrompt: [
        "The bottle tilts into the dosage cap, the liquid glugs once, then the cap clicks back onto the bottle.",
      ],
    },
  },
  {
    title: "Refill Pouch Decant Sound",
    description: "Describe sound for a refill pouch transfer.",
    values: {
      sceneXml: refillSceneXml,
      animationPrompt: [
        "A refill pouch unscrews, softly flexes, and pours product into a reusable bottle before being sealed again.",
      ],
    },
  },
];

const template: PromptTemplateModule<StudioGenerateSoundDescriptionVars, "sceneXml" | "animationPrompt"> = {
  metadata: {
    title: "Generate Sound Description",
    purpose:
      "Generate a natural-language sound description for a product animation based on scene XML and motion instructions.",
    sourceFiles: ["src/lib/studio-ai.ts"],
    categories: ["studio", "mixed-to-text", "sound-design"],
    inputType: "mixed",
    outputType: "text",
    model: "gemini-3-flash-preview",
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
