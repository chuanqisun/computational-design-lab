import { colors } from "../components/material-library/colors";
import { materials } from "../components/material-library/materials";
import { mechanisms } from "../components/material-library/mechanisms";
import { shapes } from "../components/material-library/shapes";

export const toggleItem = (items: string[], item: string): string[] =>
  items.includes(item) ? items.filter((i) => i !== item) : [...items, item];

export const colorsByName = new Map(colors.map((c) => [c.name, c]));
export const materialsById = new Map(materials.map((m) => [m.id, m]));
export const mechanismsById = new Map(mechanisms.map((m) => [m.id, m]));
export const shapesById = new Map(shapes.map((s) => [s.id, s]));
export const allSurfaceOptions = Array.from(new Set(materials.flatMap((m) => m.surfaceOptions))).sort();
