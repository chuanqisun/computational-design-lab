import type { MediaEncoders } from "../agent/observe";
import { boardActions } from "./defs/board";
import { generativeActions } from "./defs/generate";
import { mediaActions } from "./defs/media";
import { createPerceptionActions } from "./defs/perception";
import { createRegistry, type Registry } from "./registry";

export function createAppRegistry(encoders: MediaEncoders): Registry {
  return createRegistry([...createPerceptionActions(encoders), ...boardActions, ...generativeActions, ...mediaActions]);
}
