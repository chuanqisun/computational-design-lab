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
) {
  const perspectiveMap = {
    front: "Frontal eye-level perspective focusing on the primary silhouette.",
    "three-quarters": "Three-quarter view from a slightly elevated angle, revealing volume and top details.",
    "in-use": "A human hand is shown interacting with the product, demonstrating its use and scale.",
  };

  const backdropMap = {
    front: "Professional studio shot with a plain white background.",
    "three-quarters": "Professional studio shot with a plain white background.",
    "in-use": "An environment where the product is being used.",
  };

  return `
<scene_description>
  <subject>
    <object type="designed_product_bottle">
      <geometry>
        <shape>${shape.name}: ${shape.description}</shape>
        <cap>${cap.name}: ${cap.description}</cap>
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
) {
  return (["front", "three-quarters", "in-use"] as ViewType[]).map((view) => ({
    view,
    prompt: getRenderPrompt(shape, material, cap, surface, view),
  }));
}
