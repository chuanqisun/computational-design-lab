import type { PromptTemplateModule } from "./prompt-template.types";
import { toTextBlock } from "./prompt-template.utils";

export interface StudioReviseSceneXmlVars {
  editInstructions: string | string[];
  brandGuide?: string | string[];
}

const system = `You are a product visualization scene generator. Output valid XML and nothing else. Do not wrap the output in markdown code blocks. Do not include any explanation or commentary.

The XML must cover these scene slots:
- Subject: identity, object class, pose, expression
- Setting: environment, geography, era, background
- Camera: lens, angle, distance, depth-of-field, aspect ratio
- Lighting: source, direction, color temperature, contrast
- Style / Medium: art form, rendering method
- Color / Grade: palette, saturation, tonal curve

XML format rules:
- Be hierarchical and efficient. Add details when asked by user.
- Avoid nesting too much. Prefer simple, obvious tag names.
- Use arbitrary xml tags and attributes. Prefer tags over attributes.
  - Use tags to describe subjects, objects, environments, and entities.
  - Use attributes to describe un-materialized properties such as style, material, lighting.
- Use concise natural language where description is needed.
- Spatial relationships must be explicitly described.
- Include human-readable descriptions throughout.
- Use Studio keyshot on white Infinity cove for rendering style.

For picked materials: infer the most appropriate surface options and color options based on the other picked items (colors, shapes, mechanisms). When there are multiple colors and multiple surface materials, pick the most straightforward assignment.
For picked surface options: use the specified surface finishes in the scene. If surface options conflict with chosen materials, prefer the user-specified surface options.
For picked mechanisms: describe what the mechanism is, but do NOT render it in action.`;

const studioReviseSceneXmlPresets = [
  {
    title: "Revise For Softer Light",
    description: "Adjust a shampoo scene toward warmer, gentler presentation.",
    values: {
      brandGuide: ["Luma Vale: calm botanicals, matte restraint, soft green accents."],
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
      brandGuide: ["Northstar Care: clear, gentle, clinically calm, never flashy."],
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
      brandGuide: ["Morrow Loop: premium sustainability, muted tones, visible utility."],
      editInstructions: [
        "Make the refill pouch material feel more premium and mono-material.",
        "Introduce subtle cues that it belongs in a calm, sustainable bathroom ritual.",
      ],
    },
  },
];

const template: PromptTemplateModule<StudioReviseSceneXmlVars, "editInstructions" | "brandGuide"> = {
  metadata: {
    title: "Revise Scene XML",
    purpose:
      "Revise the synthesized scene XML in a multi-turn conversation: the prior synthesis turn (selections, reference photos, and model XML output) is sent as history, followed by this revision message.",
    sourceFiles: ["src/lib/studio-ai.ts", "src/components/center-panel/center-panel.component.ts"],
    categories: ["studio", "text-to-xml", "revision"],
    inputType: "mixed",
    outputType: "xml",
    model: "gemini-4-hydrogen",
    slots: {
      editInstructions: {
        description:
          "Revision instructions applied to the XML from the previous model turn in the conversation history.",
        required: true,
        multiple: true,
        type: "text",
      },
      brandGuide: {
        description: "Optional synthesis brand guide appended to the system prompt.",
        required: false,
        multiple: true,
        type: "text",
      },
    },
  },
  presets: studioReviseSceneXmlPresets,
  template: ({ editInstructions, brandGuide }) => ({
    developer: toTextBlock(brandGuide)
      ? `${system}\n\nFollow this brand guide when making design, styling, material, color, and scene decisions:\n${toTextBlock(brandGuide)}`
      : system,
    user: `Revise the XML based on these instructions. Output only the updated XML, nothing else.

${toTextBlock(editInstructions)}`,
  }),
};

export default template;
