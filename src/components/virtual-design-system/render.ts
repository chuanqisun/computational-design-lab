export function getScenePrompt() {
  return `
<scene_description>
  <subject>
    <object type="material_sample_tile">
      <description>A thin, square material sample tile lying flat on the surface.</description>
      <dimensions>5cm x 5cm x 1cm</dimensions>
      <material>Solid Walnut Wood</material>
      <color>Deep Chocolate Brown</color>
      <texture>Fine, straight grain with a semi-gloss oil finish</texture>
      <orientation>Lying flat, rotated 45 degrees with a corner pointing toward the camera</orientation>
    </object>
  </subject>
  <environment>
    <surface>
      <material>Wood</material>
      <color>Light brown / Tan</color>
      <texture>Visible wood grain running horizontally</texture>
    </surface>
    <background>
      <color>White</color>
      <type>Plain wall or backdrop</type>
    </background>
    <lighting>
      <type>Soft, diffuse</type>
      <shadows>Minimal, soft shadows cast to the right of the blocks</shadows>
    </lighting>
  </environment>
  <composition>
    <framing>Centered subject</framing>
    <perspective>Eye-level, slightly angled showing the top face and two side edges</perspective>
    <style>Minimalist, clean, studio photography</style>
  </composition>
</scene_description>
`;
}
