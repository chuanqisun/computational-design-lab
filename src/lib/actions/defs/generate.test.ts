import { BehaviorSubject, NEVER, Subject, lastValueFrom, of, type Observable } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CanvasItem } from "../../../components/canvas/canvas.component";
import { createRegistry } from "../registry";
import { createActionRuntime } from "../runtime";

type Concept = { title: string; description: string };
const mock = vi.hoisted(() => ({ concepts$: null as unknown as Subject<Concept> }));
vi.mock("../../../components/context-tray/llm/scan-concepts", () => ({ scanConcepts$: () => mock.concepts$ }));

const { scanConcept } = await import("./generate");

const source: CanvasItem = { id: "src", x: 0, y: 0, width: 200, height: 300, title: "Chair", body: "A chair" };

function setup(settle: (ids: string[]) => Observable<undefined>) {
  const items$ = new BehaviorSubject<CanvasItem[]>([source]);
  const stop$ = new Subject<void>();
  let n = 0;
  const runtime = createActionRuntime({
    items$,
    apiKeys$: new BehaviorSubject({ gemini: "k" }),
    registry: createRegistry([scanConcept]),
    stop$,
    settle,
    newId: (prefix) => `${prefix}-${++n}`,
  });
  return { items$, stop$, runtime };
}

describe("scan_concept", () => {
  beforeEach(() => {
    mock.concepts$ = new Subject<Concept>();
  });

  it("marks streamed cards pending at creation and settles each as it arrives (no second render by the card view)", async () => {
    const settled: string[] = [];
    const { items$, runtime } = setup((ids) => {
      settled.push(...ids);
      return of(undefined);
    });
    const pendingAtCreation = new Map<string, unknown>();
    items$.subscribe((items) => {
      for (const item of items) if (!pendingAtCreation.has(item.id)) pendingAtCreation.set(item.id, item.metadata?.pending);
    });

    const done = lastValueFrom(runtime.dispatch$("scan_concept", { lens: "shape", cardIds: ["src"] }, "user"));
    mock.concepts$.next({ title: "Arc", description: "a curved arc" });
    expect(settled).toEqual(["scan-1"]); // settling starts before the stream completes
    mock.concepts$.next({ title: "Grid", description: "a square grid" });
    mock.concepts$.complete();
    const result = await done;

    expect(pendingAtCreation.get("scan-1")).toBe("image");
    expect(pendingAtCreation.get("scan-2")).toBe("image");
    expect(settled).toEqual(["scan-1", "scan-2"]);
    expect(result.created).toEqual(["scan-1", "scan-2"]);
  });

  it("clears pending on cards that were never settled when the action is stopped", async () => {
    const { items$, stop$, runtime } = setup(() => NEVER);
    const sub = runtime.dispatch$("scan_concept", { lens: "shape", cardIds: ["src"] }, "user").subscribe();
    for (let i = 0; i < 6; i++) mock.concepts$.next({ title: `C${i}`, description: `concept ${i}` }); // 4 settling, 2 queued
    expect(items$.value.filter((item) => item.metadata?.pending)).toHaveLength(6);

    stop$.next();
    sub.unsubscribe();
    expect(items$.value.filter((item) => item.metadata?.pending)).toHaveLength(0);
  });
});
