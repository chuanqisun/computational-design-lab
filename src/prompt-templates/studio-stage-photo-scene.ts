import type { PromptTemplateModule } from "./prompt-template.types";
import { toTextBlock } from "./prompt-template.utils";

export interface StudioStagePhotoSceneVars {
  currentXml: string;
  scene: string | string[];
  brandGuide?: string | string[];
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

const studioStagePhotoScenePresets = [
  {
    title: "Bathroom Shelf Shampoo",
    description: "Place the shampoo bottle in a calm bathroom shelf scene.",
    values: {
      currentXml: shampooSceneXml,
      brandGuide: ["Luma Vale: calm botanicals, matte restraint, soft green accents."],
      scene: [
        "Stage the bottle on a premium bathroom shelf with folded towels, pale stone, and diffused morning light.",
      ],
    },
  },
  {
    title: "Sinkside Mouthwash",
    description: "Place the mouthwash bottle near a sink for a usage-oriented photo scene.",
    values: {
      currentXml: mouthwashSceneXml,
      brandGuide: ["Northstar Care: clear, gentle, clinically calm, never flashy."],
      scene: [
        "Place the bottle beside a clean sink with white tile, chrome reflections, and a subtle dental-care context.",
      ],
    },
  },
  {
    title: "Editorial Refill Scene",
    description: "Stage a refill pouch in a restrained sustainable editorial environment.",
    values: {
      currentXml: refillSceneXml,
      brandGuide: ["Morrow Loop: premium sustainability, muted tones, visible utility."],
      scene: ["Place the refill pouch on a pale stone counter with recycled paper props and soft side lighting."],
    },
  },
];

const template: PromptTemplateModule<StudioStagePhotoSceneVars, "currentXml" | "scene" | "brandGuide"> = {
  metadata: {
    title: "Stage Photo Scene",
    purpose: "Re-stage an existing product XML scene into a specific photo context.",
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
