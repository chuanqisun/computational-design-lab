export const materials = [
  {
    id: "clear-pet",
    name: "Clear PET",
    visual:
      "High optical clarity with a bright, glassy sheen and moderate reflectivity; allows for full, undistorted visibility of the product inside.",
    haptic:
      "Lightweight and smooth with low surface friction; the thin walls exhibit a noticeable flex or 'crinkle' when squeezed.",
    acoustic: "Produces a light, hollow, and somewhat sharp plastic 'tink' when tapped with a quick sound decay.",
    surfaceOptions: ["High gloss", "Ribbed texture", "Embossed", "Shrink-wrap matte", "Silk-screened"],
    colorOptions: ["clear"],
  },
  {
    id: "translucent-colored-pet",
    name: "Translucent Colored PET",
    visual:
      "A jewel-like, semi-transparent finish that diffuses light, creating a sophisticated silhouette of the contents with natural color gradients.",
    haptic:
      "Smooth and cool to the touch, often perceived as more premium when paired with velvety or satin surface treatments.",
    acoustic: "A thin, non-resonant plastic sound that crinkles under pressure and decays quickly upon contact.",
    surfaceOptions: ["Matte", "Satin", "Frosted", "High gloss", "Soft-touch", "Pearlescent"],
    colorOptions: ["custom"],
  },
  {
    id: "colored-hdpe",
    name: "Colored HDPE",
    visual:
      "A fully opaque, solid-colored material with a muted, utilitarian, and non-reflective appearance that hides internal contents.",
    haptic:
      "Features a characteristic waxy, warm feel with a sturdy, semi-rigid resistance to squeezing and moderate natural grip.",
    acoustic: "Emits a dull, dampened, and low-pitched 'thud' with almost no resonance or high-frequency ring.",
    surfaceOptions: ["Matte", "Semi-gloss", "Orange-peel texture", "Easy-grip texture", "Raised grain", "Soft-touch"],
    colorOptions: ["custom"],
  },
  {
    id: "aluminum",
    name: "Aluminum",
    visual:
      "A sleek, monolithic metallic surface that reflects light with industrial elegance; provides a high-end, modern aesthetic.",
    haptic:
      "Distinctly cold due to high thermal conductivity, feeling hard, dense, and completely unyielding in the hand.",
    acoustic: "Produces a bright, resonant metallic 'ping' or 'clank' with a clear sustain and high-pitched ring.",
    surfaceOptions: ["Brushed", "Polished mirror", "Anodized matte", "Powder coated", "Embossed", "Knurled texture"],
    colorOptions: ["metalic", "custom"],
  },
  {
    id: "glass",
    name: "Glass",
    visual:
      "Unmatched depth and lustrous gloss providing a timeless aesthetic with rich light refraction and high optical purity.",
    haptic:
      "Substantially heavy and perfectly rigid; feels exceptionally smooth and remains cold to the touch for an extended period.",
    acoustic: "A clear, high-pitched, and musical 'clink' that communicates purity, density, and fragility.",
    surfaceOptions: ["High gloss", "Acid-etched", "Sandblasted", "Frosted", "Embossed", "Debossed", "Coated matte"],
    colorOptions: ["clear", "custom"],
  },
];
