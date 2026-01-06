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

export const library = {
  shape: [shape01, shape02, shape03, shape04, shape05, shape06, shape07, shape08],
  cap: [cap01, cap02, cap03, cap04, cap05, cap06, cap07, cap08, cap09],
  material: [
    material01,
    material02,
    material03,
    material04,
    material05,
    material06,
    material07,
    material08,
    material09,
    material10,
  ],
  surface: [surface01, surface02, surface03, surface04, surface05, surface06, surface07, surface08, surface09],
};

export type ComponentType = keyof typeof library;
