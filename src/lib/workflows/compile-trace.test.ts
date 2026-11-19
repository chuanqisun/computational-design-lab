import { describe, expect, it } from "vitest";
import type { ActionRecord } from "./action-log";
import { compileTrace } from "./compile-trace";

let n = 0;
const rec = (action: string, args: Record<string, unknown> = {}, extra: Partial<ActionRecord> = {}): ActionRecord => ({
  id: `r${++n}`,
  timestamp: n,
  actor: "user",
  action,
  args,
  inputIds: [],
  outputIds: [],
  outputThumbs: [],
  summary: action,
  status: "done",
  ...extra,
});

const names = (records: ActionRecord[]) => compileTrace(records).map((r) => r.action);

describe("compileTrace", () => {
  it("drops failed and unfinished actions", () => {
    expect(
      names([
        rec("add_card", { text: "a" }, { status: "error" }),
        rec("add_card", { text: "b" }, { status: "running" }),
        rec("add_card", { text: "c" }),
      ]),
    ).toEqual(["add_card"]);
  });

  it("drops empty selections (select 0)", () => {
    const records = [
      rec("select_cards", { cardIds: [], mode: "replace" }),
      rec("select_cards", { mode: "none" }),
      rec("add_card", { text: "x" }),
    ];
    expect(names(records)).toEqual(["add_card"]);
  });

  it("keeps only the last of consecutive selections, and only when a later action uses the selection", () => {
    const records = [
      rec("select_cards", { cardIds: ["a"], mode: "replace" }),
      rec("select_cards", { cardIds: ["a", "b"], mode: "replace" }),
      rec("blend_images", { instruction: "mix" }), // relies on the selection
    ];
    const compiled = compileTrace(records);
    expect(compiled.map((r) => r.action)).toEqual(["select_cards", "blend_images"]);
    expect(compiled[0].args).toEqual({ cardIds: ["a", "b"], mode: "replace" });
  });

  it("drops selections made redundant by explicit cardIds and trailing selections", () => {
    const records = [
      rec("select_cards", { cardIds: ["a", "b"], mode: "replace" }),
      rec("scan_concept", { lens: "material", cardIds: ["a", "b"] }),
      rec("select_cards", { cardIds: ["c"], mode: "replace" }),
    ];
    expect(names(records)).toEqual(["scan_concept"]);
  });

  it("collapses consecutive identical steps", () => {
    const records = [
      rec("scan_concept", { lens: "color", cardIds: ["a"] }),
      rec("scan_concept", { cardIds: ["a"], lens: "color" }),
      rec("scan_concept", { lens: "shape", cardIds: ["a"] }),
    ];
    expect(compileTrace(records).map((r) => r.args.lens)).toEqual(["color", "shape"]);
  });

  it("merges consecutive moves, last position per card wins", () => {
    const records = [
      rec("move_cards", { moves: [{ id: "a", x: 1, y: 1 }] }),
      rec("move_cards", {
        moves: [
          { id: "b", x: 2, y: 2 },
          { id: "a", x: 3, y: 3 },
        ],
      }),
    ];
    const [compiled] = compileTrace(records);
    expect(compileTrace(records)).toHaveLength(1);
    expect(compiled.args.moves).toEqual([
      { id: "a", x: 3, y: 3 },
      { id: "b", x: 2, y: 2 },
    ]);
  });

  it("merges consecutive edits of the same card", () => {
    const records = [
      rec("edit_card", { cardId: "a", title: "T" }),
      rec("edit_card", { cardId: "a", body: "B" }),
      rec("edit_card", { cardId: "b", title: "X" }),
    ];
    const compiled = compileTrace(records);
    expect(compiled.map((r) => r.args)).toEqual([
      { cardId: "a", title: "T", body: "B" },
      { cardId: "b", title: "X" },
    ]);
  });

  it("merges outputs and thumbnails of collapsed steps and keeps the original order otherwise", () => {
    const records = [
      rec("add_card", { text: "a" }, { outputIds: ["c1"], outputThumbs: ["t1"] }),
      rec("add_card", { text: "a" }, { outputIds: ["c2"], outputThumbs: ["t2"] }),
      rec("render_image", { prompt: "p" }),
    ];
    const compiled = compileTrace(records);
    expect(compiled.map((r) => r.action)).toEqual(["add_card", "render_image"]);
    expect(compiled[0].outputIds).toEqual(["c1", "c2"]);
    expect(compiled[0].outputThumbs).toEqual(["t1", "t2"]);
  });

  it("drops selections before actions that do not target cards", () => {
    const records = [rec("select_cards", { cardIds: ["a"], mode: "replace" }), rec("add_card", { text: "x" })];
    expect(compileTrace(records, (action) => action !== "add_card").map((r) => r.action)).toEqual(["add_card"]);
  });

  it("re-merges steps that become adjacent after selections are removed", () => {
    const records = [
      rec("scan_concept", { lens: "color", cardIds: ["a"] }),
      rec("select_cards", { cardIds: ["b"], mode: "replace" }),
      rec("scan_concept", { lens: "color", cardIds: ["a"] }),
    ];
    expect(names(records)).toEqual(["scan_concept"]);
  });
});
