// Import all assets as URLs using Vite's ?url suffix
// Body geometry / shape
import shape01 from "./shape-01.png?url";
import shape02 from "./shape-02.png?url";
import shape03 from "./shape-03.png?url";
import shape04 from "./shape-04.png?url";
import shape05 from "./shape-05.png?url";
import shape06 from "./shape-06.png?url";
import shape07 from "./shape-07.png?url";
import shape08 from "./shape-08.png?url";
import shape09 from "./shape-09.png?url";

// Dispensing mechanism / cap
import cap01 from "./cap-01.png?url";
import cap02 from "./cap-02.png?url";
import cap03 from "./cap-03.png?url";
import cap04 from "./cap-04.png?url";
import cap05 from "./cap-05.png?url";
import cap06 from "./cap-06.png?url";
import cap07 from "./cap-07.png?url";
import cap08 from "./cap-08.png?url";
import cap09 from "./cap-09.png?url";

// Main material
import material01 from "./material-01.png?url";
import material02 from "./material-02.png?url";
import material03 from "./material-03.png?url";
import material04 from "./material-04.png?url";
import material05 from "./material-05.png?url";
import material06 from "./material-06.png?url";
import material07 from "./material-07.png?url";
import material08 from "./material-08.png?url";
import material09 from "./material-09.png?url";
import material10 from "./material-10.png?url";

// Surface finish
import surface01 from "./surface-01.png?url";
import surface02 from "./surface-02.png?url";
import surface03 from "./surface-03.png?url";
import surface04 from "./surface-04.png?url";
import surface05 from "./surface-05.png?url";
import surface06 from "./surface-06.png?url";
import surface07 from "./surface-07.png?url";
import surface08 from "./surface-08.png?url";
import surface09 from "./surface-09.png?url";

export type ComponentType = "shape" | "cap" | "material" | "surface";

export interface LibraryItem {
  id: number;
  type: ComponentType;
  name: string;
  description: string;
  url: string;
}

export const library: LibraryItem[] = [
  {
    id: 1,
    type: "cap",
    name: "Top-press pump dispenser",
    description:
      "Top-mounted circular button activates an internal manual pump to eject fluid through a prominent horizontal cylindrical spout.",
    url: cap01,
  },
  {
    id: 2,
    type: "cap",
    name: "Push-button dropper",
    description:
      "Features a rounded compressible dome atop a cylindrical collar that utilizes air displacement to suction and dispense liquid through an internal pipette when pressed.",
    url: cap02,
  },
  {
    id: 3,
    type: "cap",
    name: "Flip-top cap",
    description:
      "Features a hinged lid with a recessed thumb tab that flips upward to expose a central dispensing aperture.",
    url: cap03,
  },
  {
    id: 4,
    type: "cap",
    name: "Child-resistant squeeze-and-turn cap",
    description:
      "Tall plastic cap featuring a vertically ribbed exterior and a child-resistant mechanism that requires lateral pressure on the smooth base collar to disengage internal locking tabs before it can be unscrewed.",
    url: cap04,
  },
  {
    id: 5,
    type: "cap",
    name: "Screw cap",
    description:
      "Features a smooth-topped cylindrical lid that unscrews from a vertically ribbed base to provide wide-mouth access to internal contents.",
    url: cap05,
  },
  {
    id: 6,
    type: "cap",
    name: "Flip-top lid",
    description:
      "Hinged circular cover with a protruding thumb tab that flips upward to reveal a wide-mouth opening for accessing the jar's contents.",
    url: cap06,
  },
  {
    id: 7,
    type: "cap",
    name: "Cross-slit valve cap",
    description:
      "Features a flexible, cross-slit membrane recessed within a cylindrical body that opens under internal pressure to dispense liquid and automatically reseals upon pressure release.",
    url: cap07,
  },
  {
    id: 8,
    type: "cap",
    name: "Thumb-press pump dispenser",
    description:
      "A circular button integrated into the flat top surface activates an internal pressure mechanism to discharge liquid through a small, horizontal side spout.",
    url: cap08,
  },
  {
    id: 9,
    type: "cap",
    name: "thumb-press pressure pump cap",
    description:
      "A cylindrical cap featuring a recessed circular pressure pump on the top surface that forces contents through a rectangular side aperture.",
    url: cap09,
  },
  {
    id: 10,
    type: "shape",
    name: "Cylindrical body",
    description: "An elongated vertical cylinder featuring a flat circular top and a base with subtly rounded edges.",
    url: shape01,
  },
  {
    id: 11,
    type: "shape",
    name: "Rounded rectangular prism",
    description: "Tall vertical cuboid featuring uniformly rounded edges and corners on all its faces.",
    url: shape02,
  },
  {
    id: 12,
    type: "shape",
    name: "Truncated Cone",
    description:
      "A conical frustum featuring a circular base and straight sides that taper uniformly to a smaller circular top surface.",
    url: shape03,
  },
  {
    id: 13,
    type: "shape",
    name: "Elongated ovoid vessel",
    description:
      "Elongated ovoid body with a flat base, tapering into a short cylindrical neck that terminates in a shallow, flat-topped disc.",
    url: shape04,
  },
  {
    id: 14,
    type: "shape",
    name: "Low-profile rounded cylinder",
    description:
      "Short cylindrical structure composed of a base with rounded bottom edges and a flush-fitting flat-topped lid separated by a horizontal seam.",
    url: shape05,
  },
  {
    id: 15,
    type: "shape",
    name: "Domed cylinder",
    description: "Vertically oriented cylindrical body with a circular base and a hemispherical top cap.",
    url: shape06,
  },
  {
    id: 16,
    type: "shape",
    name: "Tapered tube with cylindrical top",
    description:
      "Vertical structure consisting of a short cylindrical top above a body that transitions from a circular cross-section to a flattened, wide rectangular seal at the bottom.",
    url: shape07,
  },
  {
    id: 17,
    type: "shape",
    name: "Stand-up gusseted pouch",
    description:
      "Rectangular vertical volume featuring sealed side margins, a top horizontal seal with small corner notches, an internal resealable track, and a curved bottom gusset that forms a self-standing base.",
    url: shape08,
  },
  {
    id: 18,
    type: "shape",
    name: "Faceted rectangular container body",
    description:
      "Symmetrical vertically oriented vessel with a rectangular profile, featuring beveled vertical corners, sloped upper and lower transitions, and a recessed central midsection.",
    url: shape09,
  },
  {
    id: 19,
    type: "surface",
    name: "Concentric Circular Ripple",
    description:
      "Features a series of raised concentric circular ridges alternating with recessed valleys that radiate from a central point, creating a rhythmic ripple effect across a matte, finely granular plane.",
    url: surface01,
  },
  {
    id: 20,
    type: "surface",
    name: "Pyramidal Studded Grid",
    description:
      "Uniform array of elevated, four-sided pyramids arranged in a repeating grid pattern with precise geometric peaks.",
    url: surface02,
  },
  {
    id: 21,
    type: "surface",
    name: "Recessed cellular texture",
    description:
      "Clustered arrangement of shallow, irregular concave cells of varying sizes forming a recessed geometric pattern with a fine, matte granular finish.",
    url: surface03,
  },
  {
    id: 22,
    type: "surface",
    name: "Woven Braid Relief",
    description:
      "Consists of a repeating three-dimensional pattern of smooth, interlocking strands that create a continuous over-and-under woven effect across the surface.",
    url: surface04,
  },
  {
    id: 23,
    type: "surface",
    name: "Fragmented angular topography",
    description:
      "An irregular arrangement of sharply angled, flat-faced geometric shards of varying heights creating a deeply textured, jagged relief.",
    url: surface05,
  },
  {
    id: 24,
    type: "surface",
    name: "Sinusoidal Wave Texture",
    description:
      "Parallel sinusoidal ridges and grooves create an undulating, rhythmic pattern across a planar surface.",
    url: surface06,
  },
  {
    id: 25,
    type: "surface",
    name: "Hemispherical studded texture",
    description:
      "A grid of uniformly spaced, smooth hemispherical nodules creates a repetitive raised texture across the entire flat expanse.",
    url: surface07,
  },
  {
    id: 26,
    type: "surface",
    name: "Topographic Contouring",
    description:
      "Consists of multiple stepped elevations forming undulating, wavy ridges and valleys that replicate topographical contour lines.",
    url: surface08,
  },
  {
    id: 27,
    type: "surface",
    name: "Sloped Diamond Grid",
    description:
      "Repeating grid of raised, diamond-shaped blocks with sloped faces formed by intersecting diagonal channels.",
    url: surface09,
  },
  {
    id: 28,
    type: "material",
    name: "Frosted blue translucent acrylic",
    description:
      "Semi-transparent blue polymer characterized by a fine, light-scattering grain and soft, diffuse visual properties.",
    url: material01,
  },
  {
    id: 29,
    type: "material",
    name: "White Veined Marble",
    description:
      "Metamorphic stone featuring a bright white, crystalline ground intersected by soft, feathered veins of smoky grey.",
    url: material02,
  },
  {
    id: 30,
    type: "material",
    name: "Green Terrazzo",
    description:
      "Sage green cementitious matrix densely embedded with small, variegated mineral aggregates in shades of terracotta, white, and dark charcoal.",
    url: material03,
  },
  {
    id: 31,
    type: "material",
    name: "Perforated Charcoal Aluminum",
    description:
      "Opaque, dark grey metallic substance featuring a dense and uniform grid of minute circular apertures.",
    url: material04,
  },
  {
    id: 32,
    type: "material",
    name: "Royal blue velvet",
    description:
      "Vibrant royal blue textile characterized by a dense, plush pile with a soft, velvety hand and light-absorbing matte quality.",
    url: material05,
  },
  {
    id: 33,
    type: "material",
    name: "Porous Gray Concrete",
    description:
      "Uniform light gray mineral composite with a dense, granular matrix containing numerous small, irregular air pockets throughout its surface.",
    url: material06,
  },
  {
    id: 34,
    type: "material",
    name: "Fluted glass",
    description:
      "Translucent, rigid mineral-based material with a subtle aquatic green tint and a light-refracting series of parallel linear ridges.",
    url: material07,
  },
  {
    id: 35,
    type: "material",
    name: "Anodized aluminum",
    description:
      "Uniformly light-gray metal with a micro-granular, non-reflective appearance and a smooth, solid texture that softly diffuses light.",
    url: material08,
  },
  {
    id: 36,
    type: "material",
    name: "Blue Opaque Acrylic",
    description:
      "Uniformly pigmented, opaque blue synthetic polymer with a dense, non-porous texture and solid color saturation.",
    url: material09,
  },
  {
    id: 37,
    type: "material",
    name: "Iridescent metallic material",
    description:
      "Features an opaque surface that reflects a shifting, prismatic spectrum of rainbow colors depending on the angle of illumination and observation.",
    url: material10,
  },
];
