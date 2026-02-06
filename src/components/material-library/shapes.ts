export interface LibraryShape {
  id: string;
  name: string;
  description: string;
}

export const shapes = [
  {
    id: "boston-round",
    name: "Boston Round",
    description:
      "A classic cylindrical container characterized by a wide, flat base and short, curved shoulders that lead to a narrow neck. The profile is squat and sturdy, featuring smooth, vertical walls that provide a consistent diameter from the base to the start of the shoulder radius. This shape is designed for stability and is frequently paired with pump dispensers or screw caps for high-viscosity liquids.",
  },
  {
    id: "cosmo-round",
    name: "Cosmo Round (Bullet)",
    description:
      "A tall, slender cylindrical bottle featuring a narrow diameter and steeply sloped, rounded shoulders that taper smoothly into the neck. The vertical walls are straight and elongated, giving the bottle a sleek, aerodynamic appearance similar to a projectile. Its narrow footprint makes it highly space-efficient on shelves and ergonomic for one-handed use in wet environments.",
  },
  {
    id: "cosmo-oval",
    name: "Cosmo Oval",
    description:
      "An elongated container with an elliptical cross-section that features a narrow depth and wide front and back panels. The shoulders are gradually sloped and rounded, mirroring the oval footprint of the base. This profile is specifically engineered for ergonomics, fitting naturally into the palm of the hand while providing a large, flat surface area for branding and labeling.",
  },
  {
    id: "cylinder-round",
    name: "Cylinder Round",
    description:
      "A tall, straight-sided bottle with a circular base and near-horizontal, sharp shoulders that meet the neck at a distinct angle. Unlike the rounded shoulders of the Boston Round, this shape maintains a consistent width almost entirely to the top, maximizing the vertical label area. The design is minimalist and architectural, often used for professional or industrial-grade liquid products.",
  },
  {
    id: "oval-oblong",
    name: "Oval / Oblong",
    description:
      "A container with a flattened, rectangular-to-oval base and straight vertical sides that transition into a wide, shallow shoulder area. The depth of the bottle is significantly smaller than its width, creating a thin profile that is easy to squeeze. This shape is designed to minimize shelf depth while maximizing the front-facing visual presence of the product.",
  },
  {
    id: "square",
    name: "Square",
    description:
      "A geometric container featuring four flat vertical panels of equal width and sharp or slightly radiused 90-degree corners. The shoulders are typically flat or very briefly sloped, leading to a centered neck. This shape is highly space-efficient for packing and shipping, offering a modern, structured aesthetic that stands out against traditional rounded packaging.",
  },
  {
    id: "tottle",
    name: "Tottle",
    description:
      "An inverted container designed to stand on its closure rather than its base, typically featuring an oval or teardrop cross-section. The body tapers from a wider, rounded top (the traditional base) down to a narrower neck finished with a flat-surfaced flip-top cap. This gravity-fed design ensures that high-viscosity contents remain at the opening for immediate dispensing.",
  },
  {
    id: "trigger-spray-bottle",
    name: "Trigger Spray Bottle",
    description:
      "A specialized container featuring a wide, stable base and an asymmetrical, ergonomic neck designed to accommodate a mechanical spray head. The body often includes an offset neck and a recessed 'grip' area or finger molds to provide leverage when operating a trigger. The profile is typically flat-fronted or oblong to prevent the bottle from rotating in the hand during use.",
  },
  {
    id: "f-style",
    name: "F-Style (Rectangular Jug)",
    description:
      "A heavy-duty rectangular container characterized by a flat, wide body and an integrated handle molded into the top corner or side. The neck is usually offset to one side to facilitate controlled pouring of bulk liquids. The flat, planar surfaces are designed for high-volume storage and provide ample space for large industrial or chemical warning labels.",
  },
  {
    id: "modern-round",
    name: "Modern Round",
    description:
      "A variation of the cylindrical bottle that features a recessed label panel set between raised ridges at the top and bottom of the body. The shoulders are sloped and often feature decorative or functional ribbing. This design protects the label from scuffing during transit and provides a distinct, tiered silhouette often associated with pharmaceutical or chemical solutions.",
  },
  {
    id: "industrial-round",
    name: "Industrial Round (Handled Jug)",
    description:
      "A large-capacity cylindrical jug featuring a wide, circular base and a built-in loop handle molded near the neck for easy transport. The shoulders are broad and rounded, tapering into a narrow pouring spout. This shape is engineered for structural integrity and weight distribution when carrying large volumes of liquid, such as detergents or chemicals.",
  },
  {
    id: "dundee-oval",
    name: "Dundee Oval",
    description:
      "A bold, wide-profile container with an elliptical base and a flared body that reaches its maximum width at the shoulders. The silhouette is more aggressive and substantial than a standard oval, featuring a broad front face that tapers sharply toward the sides. This shape is designed for high visual impact on retail shelves, providing a 'billboard' effect for the brand.",
  },
  {
    id: "pinch-grip",
    name: "Pinch Grip",
    description:
      "A large-format square or rectangular bottle featuring deep, molded-in recesses on opposite sides of the body to create an integrated handle. These 'pinched' areas allow the user to securely grasp and tip the heavy container without the need for a separate protruding handle. The design maintains a clean, blocky exterior profile that is highly efficient for palletization.",
  },
  {
    id: "teardrop",
    name: "Teardrop (Pear Body)",
    description:
      "An organic, curvilinear container featuring a very wide, stable, and rounded base that tapers continuously upward into a narrow neck. The profile lacks any hard angles or distinct shoulder lines, creating a smooth, pear-like silhouette. This shape is designed to communicate gentleness and safety through its soft geometry while providing a low center of gravity to prevent tipping.",
  },
  {
    id: "beveled-rectangle",
    name: "Beveled Rectangle",
    description:
      "A tall, structured container with a rectangular footprint where the four vertical corners are replaced by flat, angled facets or chamfers. This creates an eight-sided cross-section that resembles a stylized capital letter 'I' when viewed from the front. The broad front and back panels are flat, while the beveled edges provide ergonomic grip points and structural reinforcement, evoking a traditional apothecary or clinical aesthetic.",
  },
];
