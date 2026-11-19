import { BehaviorSubject, NEVER, of, Subject, delay, lastValueFrom, map } from "rxjs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CanvasItem } from "../../components/canvas/canvas.component";
import { ActionLog } from "../workflows/action-log";
import { createRegistry } from "./registry";
import { createActionRuntime } from "./runtime";
import type { ActionDef } from "./types";

const card = (id: string, extra: Partial<CanvasItem> = {}): CanvasItem => ({
  id,
  x: 0,
  y: 0,
  width: 200,
  height: 300,
  title: id,
  body: `${id} body`,
  imageSrc: `data:image/png;base64,${id}`,
  ...extra,
});

const echo: ActionDef = {
  name: "echo",
  description: "Adds one card per target",
  parameters: { type: "object", properties: { cardIds: { type: "array", items: { type: "string" } }, label: { type: "string" } }, required: ["label"] },
  isAvailable: ({ targets }) => (targets.length > 0 ? true : { reason: "Select at least one card" }),
  run: (args, ctx) =>
    of(null).pipe(
      map(() => {
        const [pos] = ctx.place(1, ctx.targets.map((t) => t.id));
        const id = ctx.newId("echo");
        ctx.addCards([{ id, x: pos.x, y: pos.y, width: 200, height: 300, zIndex: pos.z, title: args.label }]);
        return { summary: `echo ${args.label}`, created: [id] };
      }),
    ),
  log: "record",
  humanEntry: "tray:Echo",
  agent: "native",
};

const select: ActionDef = {
  name: "select_cards",
  description: "select",
  parameters: { type: "object", properties: { cardIds: { type: "array", items: { type: "string" } } } },
  isAvailable: () => true,
  run: (args, ctx) =>
    of(null).pipe(
      map(() => {
        ctx.items$.next(ctx.items$.value.map((i) => ({ ...i, isSelected: args.cardIds.includes(i.id) })));
        return { summary: "selected" };
      }),
    ),
  log: "coalesce",
  humanEntry: "canvas:click",
  agent: "native",
};

const humanOnly: ActionDef = {
  name: "export_cards",
  description: "export",
  parameters: { type: "object", properties: {} },
  isAvailable: () => true,
  run: () => of({ summary: "exported" }),
  log: "record",
  humanEntry: "tray:Export",
  agent: { unsupported: "Output is a file on the user's disk." },
};

const sketchy: ActionDef = {
  name: "edit_image",
  description: "edit",
  parameters: { type: "object", properties: { cardIds: { type: "array", items: { type: "string" } }, instruction: { type: "string" } } },
  humanArgs: ["_annotatedImage"],
  isAvailable: () => true,
  run: (args) => of({ summary: `edited ${args._annotatedImage ? "with drawing" : "no drawing"}` }),
  log: "record",
  humanEntry: "tray:Sketch",
  agent: "equivalent",
};

const slow: ActionDef = {
  name: "slow",
  description: "never finishes",
  parameters: { type: "object", properties: {} },
  isAvailable: () => true,
  run: () => NEVER,
  log: "record",
  humanEntry: "tray:Slow",
  agent: "native",
};

const failing: ActionDef = {
  name: "fail",
  description: "throws",
  parameters: { type: "object", properties: { cardIds: { type: "array", items: { type: "string" } } } },
  isAvailable: () => true,
  run: (_args, ctx) =>
    of(null).pipe(
      map(() => {
        ctx.cards(["missing"]);
        return { summary: "unreachable" };
      }),
    ),
  log: "record",
  humanEntry: "tray:Fail",
  agent: "native",
};

const peek: ActionDef = {
  name: "observe",
  description: "look",
  parameters: { type: "object", properties: {} },
  isAvailable: () => true,
  run: () => of({ summary: "looked" }),
  log: "skip",
  humanEntry: "perception",
  agent: "perception",
};

function setup(items: CanvasItem[] = [card("a"), card("b")]) {
  const items$ = new BehaviorSubject<CanvasItem[]>(items);
  const apiKeys$ = new BehaviorSubject({ gemini: "key" });
  const stop$ = new Subject<void>();
  let t = 1000;
  const log = new ActionLog([], () => (t += 10));
  let n = 0;
  const runtime = createActionRuntime({
    items$,
    apiKeys$,
    stop$,
    log,
    registry: createRegistry([echo, select, humanOnly, sketchy, slow, failing, peek]),
    settle: () => of(undefined),
    makeThumb: async () => undefined,
    newId: (prefix) => `${prefix}-${++n}`,
  });
  return { items$, runtime, stop$, log };
}

afterEach(() => vi.restoreAllMocks());

describe("dispatch$", () => {
  it("returns unknown_action for unregistered names", async () => {
    const { runtime } = setup();
    const result = await lastValueFrom(runtime.dispatch$("nope", {}, "ai"));
    expect(result.error).toBe("unknown_action");
  });

  it("returns invalid_args with a reason when args fail the schema", async () => {
    const { runtime, log } = setup();
    const result = await lastValueFrom(runtime.dispatch$("echo", { label: 3 }, "ai"));
    expect(result.error).toBe("invalid_args");
    expect(result.reason).toContain("args.label must be a string");
    expect(log.records).toHaveLength(0);
  });

  it("refuses unsupported actions for the agent but runs them for the user", async () => {
    const { runtime } = setup();
    const ai = await lastValueFrom(runtime.dispatch$("export_cards", {}, "ai"));
    expect(ai.error).toBe("unsupported_for_agent");
    expect(ai.reason).toContain("file");
    const user = await lastValueFrom(runtime.dispatch$("export_cards", {}, "user"));
    expect(user.error).toBeUndefined();
  });

  it("accepts human-only args from the user and rejects them from the agent", async () => {
    const { runtime, log } = setup();
    const user = await lastValueFrom(runtime.dispatch$("edit_image", { instruction: "x", _annotatedImage: "data:..." }, "user"));
    expect(user.summary).toBe("edited with drawing");
    expect(log.records[0].args).not.toHaveProperty("_annotatedImage");

    const ai = await lastValueFrom(runtime.dispatch$("edit_image", { instruction: "x", _annotatedImage: "data:..." }, "ai"));
    expect(ai.error).toBe("invalid_args");
  });

  it("checks availability against explicit cardIds, else the selection", async () => {
    const { runtime } = setup();
    const none = await lastValueFrom(runtime.dispatch$("echo", { label: "x" }, "user"));
    expect(none.error).toBe("unavailable");
    expect(none.reason).toBe("Select at least one card");

    const explicit = await lastValueFrom(runtime.dispatch$("echo", { label: "x", cardIds: ["a"] }, "ai"));
    expect(explicit.error).toBeUndefined();
  });

  it("returns card_not_found for unknown card ids", async () => {
    const { runtime, log } = setup();
    const result = await lastValueFrom(runtime.dispatch$("echo", { label: "x", cardIds: ["zzz"] }, "ai"));
    expect(result.error).toBe("card_not_found");
    const thrown = await lastValueFrom(runtime.dispatch$("fail", {}, "ai"));
    expect(thrown.error).toBe("card_not_found");
    expect(log.records.at(-1)?.status).toBe("error");
  });

  it("records the log lifecycle with inputs, outputs and duration", async () => {
    const { runtime, log } = setup();
    const result = await lastValueFrom(runtime.dispatch$("echo", { label: "hi", cardIds: ["a"] }, "ai"));
    expect(result.created).toEqual(["echo-1"]);
    const [record] = log.records;
    expect(record).toMatchObject({
      actor: "ai",
      action: "echo",
      args: { label: "hi", cardIds: ["a"] },
      inputIds: ["a"],
      outputIds: ["echo-1"],
      status: "done",
      summary: "echo hi",
    });
    expect(record.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("coalesces consecutive coalescing actions and skips perception actions", async () => {
    const { runtime, log } = setup();
    await lastValueFrom(runtime.dispatch$("select_cards", { cardIds: ["a"] }, "user"));
    await lastValueFrom(runtime.dispatch$("select_cards", { cardIds: ["a", "b"] }, "user"));
    await lastValueFrom(runtime.dispatch$("observe", {}, "ai"));
    expect(log.records).toHaveLength(1);
    expect(log.records[0].args).toEqual({ cardIds: ["a", "b"] });
  });

  it("stop$ cancels running actions, aborts the signal and records the stop", async () => {
    const { runtime, stop$, log } = setup();
    const pending = lastValueFrom(runtime.dispatch$("slow", {}, "ai"));
    expect(runtime.running$.value).toHaveLength(1);
    stop$.next();
    const result = await pending;
    expect(result.error).toBe("stopped");
    expect(log.records[0].status).toBe("error");
    expect(runtime.running$.value).toHaveLength(0);
  });

  it("never calls alert on the AI path", async () => {
    const alertSpy = vi.fn();
    vi.stubGlobal("alert", alertSpy);
    const { runtime } = setup();
    await lastValueFrom(runtime.dispatch$("fail", {}, "ai"));
    await lastValueFrom(runtime.dispatch$("nope", {}, "ai"));
    expect(alertSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("parity: the same action and args yield the same board diff for user and ai", async () => {
    // Provenance (who/when/which run) legitimately differs; the board effect must not.
    const strip = (items: CanvasItem[]) =>
      items.map(({ id: _id, metadata, ...rest }) => {
        const { createdAt: _at, createdBy: _by, ...meta } = metadata ?? {};
        return { ...rest, metadata: meta };
      });

    const userRun = setup();
    await lastValueFrom(userRun.runtime.dispatch$("echo", { label: "p", cardIds: ["a", "b"] }, "user"));

    const aiRun = setup();
    await lastValueFrom(aiRun.runtime.dispatch$("echo", { label: "p", cardIds: ["a", "b"] }, "ai"));

    expect(strip(userRun.items$.value)).toEqual(strip(aiRun.items$.value));
    expect(userRun.items$.value.length).toBe(3);
  });

  it("stamps created cards with creation time and the run that made them", async () => {
    const { runtime, items$ } = setup();
    const before = Date.now();
    await lastValueFrom(runtime.dispatch$("echo", { label: "x", cardIds: ["a"] }, "user"));
    await lastValueFrom(runtime.dispatch$("echo", { label: "y", cardIds: ["a"] }, "ai"));
    const [first, second] = items$.value.slice(-2);
    expect(first.metadata?.createdAt).toBeGreaterThanOrEqual(before);
    expect(first.metadata?.createdBy).toMatchObject({ action: "echo", actor: "user" });
    expect(second.metadata?.createdBy).toMatchObject({ action: "echo", actor: "ai" });
    expect(first.metadata?.createdBy?.runId).not.toBe(second.metadata?.createdBy?.runId);
  });

  it("emits created ids for the reveal hook", async () => {
    const { runtime } = setup();
    const created: string[][] = [];
    runtime.created$.subscribe((event) => created.push(event.ids));
    await lastValueFrom(runtime.dispatch$("echo", { label: "x", cardIds: ["a"] }, "user"));
    expect(created).toEqual([["echo-1"]]);
  });

  it("availability() evaluates against the selection or the whole board", () => {
    const { runtime, items$ } = setup();
    expect(runtime.availability("echo", "selection")).toEqual({ reason: "Select at least one card" });
    expect(runtime.availability("echo", "board")).toBe(true);
    items$.next(items$.value.map((i) => ({ ...i, isSelected: i.id === "a" })));
    expect(runtime.availability("echo", "selection")).toBe(true);
  });

  it("works with async inner observables", async () => {
    const delayed: ActionDef = { ...echo, name: "delayed", run: (args, ctx) => echo.run(args, ctx).pipe(delay(5)) };
    const items$ = new BehaviorSubject<CanvasItem[]>([card("a")]);
    const runtime = createActionRuntime({
      items$,
      apiKeys$: new BehaviorSubject({ gemini: "k" }),
      registry: createRegistry([delayed]),
      settle: () => of(undefined),
      makeThumb: async () => undefined,
    });
    const result = await lastValueFrom(runtime.dispatch$("delayed", { label: "d", cardIds: ["a"] }, "ai"));
    expect(result.created).toHaveLength(1);
  });
});
