import { BehaviorSubject, Observable } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CanvasItem } from "../../canvas/canvas.component";
import type { ApiKeys } from "../../connections/storage";
import type { LensScores } from "../llm/rate-lenses";
import { lensSuitability$, selectionContentKey, type SuitabilityState } from "./conceptual-scan.tool";

const card = (id: string, body: string, extra: Partial<CanvasItem> = {}): CanvasItem => ({
  id,
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  body,
  ...extra,
});

const scores = (v: number) => ({ probabilities: { emotions: v }, relative: { emotions: 1 } }) as unknown as LensScores;

/** Fake rater: records requests, lets the test resolve them, and tracks aborts (unsubscribes). */
function fakeRater() {
  const calls: { body: string; resolve: (s: LensScores) => void; aborted: boolean }[] = [];
  const rate = ({ items }: { items: CanvasItem[] }) =>
    new Observable<LensScores>((sub) => {
      const call = {
        body: items.map((i) => i.body).join(","),
        aborted: false,
        done: false,
        resolve: (s: LensScores) => {
          call.done = true;
          sub.next(s);
          sub.complete();
        },
      };
      calls.push(call);
      return () => {
        if (!call.done) call.aborted = true;
      };
    });
  return { calls, rate };
}

describe("selectionContentKey", () => {
  it("ignores ids, positions, and order", () => {
    const a = [card("1", "A"), card("2", "B")];
    const b = [card("9", "B", { x: 50 }), card("8", "A")];
    expect(selectionContentKey(a)).toBe(selectionContentKey(b));
  });

  it("distinguishes different images", () => {
    expect(selectionContentKey([card("1", "", { imageSrc: "data:image/png;base64,AAAA" })])).not.toBe(
      selectionContentKey([card("1", "", { imageSrc: "data:image/png;base64,BBBB" })]),
    );
  });
});

describe("lensSuitability$", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const setup = () => {
    const selected$ = new BehaviorSubject<CanvasItem[]>([]);
    const apiKeys$ = new BehaviorSubject<ApiKeys>({ gemini: "key" });
    const { calls, rate } = fakeRater();
    const states: SuitabilityState[] = [];
    const sub = lensSuitability$(selected$, apiKeys$, rate).subscribe((s) => states.push(s));
    return { selected$, apiKeys$, calls, states, sub };
  };

  it("debounces rapid selection changes into one request", () => {
    const { selected$, calls, sub } = setup();
    selected$.next([card("1", "A")]);
    selected$.next([card("2", "B")]);
    selected$.next([card("3", "C")]);
    vi.advanceTimersByTime(500);
    expect(calls.map((c) => c.body)).toEqual(["C"]);
    sub.unsubscribe();
  });

  it("aborts the outdated request when the selection changes", () => {
    const { selected$, calls, sub } = setup();
    selected$.next([card("1", "A")]);
    vi.advanceTimersByTime(500);
    selected$.next([card("2", "B")]);
    vi.advanceTimersByTime(500);
    expect(calls.map((c) => [c.body, c.aborted])).toEqual([
      ["A", true],
      ["B", false],
    ]);
    sub.unsubscribe();
    expect(calls[1].aborted).toBe(true);
  });

  it("does not re-request when the same content is re-emitted (e.g. card moved)", () => {
    const { selected$, calls, sub } = setup();
    selected$.next([card("1", "A")]);
    vi.advanceTimersByTime(500);
    selected$.next([card("1", "A", { x: 40 })]);
    vi.advanceTimersByTime(500);
    expect(calls).toHaveLength(1);
    expect(calls[0].aborted).toBe(false);
    sub.unsubscribe();
  });

  it("serves previously scored content from cache (A -> B -> A)", () => {
    const { selected$, calls, states, sub } = setup();
    selected$.next([card("1", "A")]);
    vi.advanceTimersByTime(500);
    calls[0].resolve(scores(0.8));
    selected$.next([card("2", "B")]);
    vi.advanceTimersByTime(500);
    calls[1].resolve(scores(0.2));
    selected$.next([card("1", "A")]);
    vi.advanceTimersByTime(500);
    expect(calls).toHaveLength(2);
    expect(states.at(-1)).toEqual({ scores: scores(0.8), loading: false });
    sub.unsubscribe();
  });

  it("keeps previous scores while loading so meters animate from old to new", () => {
    const { selected$, calls, states, sub } = setup();
    selected$.next([card("1", "A")]);
    vi.advanceTimersByTime(500);
    calls[0].resolve(scores(0.8));
    selected$.next([card("2", "B")]);
    vi.advanceTimersByTime(500);
    expect(states.at(-1)).toEqual({ scores: scores(0.8), loading: true });
    calls[1].resolve(scores(0.3));
    expect(states.at(-1)).toEqual({ scores: scores(0.3), loading: false });
    sub.unsubscribe();
  });

  it("stays idle without an API key or selection", () => {
    const { selected$, apiKeys$, calls, states, sub } = setup();
    apiKeys$.next({});
    selected$.next([card("1", "A")]);
    vi.advanceTimersByTime(500);
    expect(calls).toHaveLength(0);
    expect(states.at(-1)).toEqual({ scores: null, loading: false });
    sub.unsubscribe();
  });
});
