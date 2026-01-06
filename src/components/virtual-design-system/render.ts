export interface ComponentInfo {
  name: string;
  description: string;
}

export type ViewType = "front" | "three-quarters" | "in-use";

export function getRenderPrompt(
  shape: ComponentInfo,
  material: ComponentInfo,
  cap: ComponentInfo,
  surface: ComponentInfo,
  view: ViewType,
  capColor: string = "#ffffff",
) {
  const perspectiveMap = {
    front: "Frontal eye-level perspective focusing on the primary silhouette.",
    "three-quarters": "Three-quarter view from a slightly elevated angle, revealing volume and top details.",
    "in-use":
      "The product is shown resting naturally in its environment, demonstrating its use-case and aesthetic integration. No people or hands are visible.",
  };

  const backdropMap = {
    front: "Professional studio shot with a plain white background.",
    "three-quarters": "Professional studio shot with a plain white background.",
    "in-use":
      "A realistic and appropriate lifestyle environment where the product would naturally be used. The scene is empty of people.",
  };

  return `
<scene_description>
  <subject>
    <object type="designed_product_bottle">
      <geometry>
        <shape>
          <name>${shape.name}</name>
          <description>${shape.description}</description>
        </shape>
        <cap>
          <name>${cap.name}</name>
          <description>${cap.description}</description>
          <color_hex_code>${capColor}</color_hex_code>
        </cap>
      </geometry>
      <appearance>
        <material>${material.name}: ${material.description}</material>
        <surface_finish>${surface.name}: ${surface.description}</surface_finish>
      </appearance>
    </object>
  </subject>
  <environment>
    <background>${backdropMap[view]}</background>
    <lighting>
      <type>Soft, diffuse studio lighting</type>
      <shadows>Soft, realistic contact shadows</shadows>
    </lighting>
  </environment>
  <composition>
    <framing>Centered</framing>
    <perspective>${perspectiveMap[view]}</perspective>
    <style>Minimalist, clean, professional product photography</style>
  </composition>
</scene_description>
`.trim();
}

export function getFullRenderPrompts(
  shape: ComponentInfo,
  material: ComponentInfo,
  cap: ComponentInfo,
  surface: ComponentInfo,
  capColor: string = "#ffffff",
) {
  return (["front", "three-quarters", "in-use"] as ViewType[]).map((view) => ({
    view,
    prompt: getRenderPrompt(shape, material, cap, surface, view, capColor),
  }));
}
