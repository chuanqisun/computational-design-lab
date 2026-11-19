import { BehaviorSubject, NEVER, Subject, lastValueFrom, of, throwError } from "rxjs";
import { describe, expect, it, vi } from "vitest";
import type { CanvasItem } from "../../components/canvas/canvas.component";
import { settleCard$, settleCards$, type CardFillDeps } from "./card-fill";

const base = (extra: Partial<CanvasItem>): CanvasItem => ({ id: "c", x: 0, y: 0, width: 200, height: 300, ...extra });

describe("settleCard$", () => {
  it("fills missing text then renders the image, clearing pending at the end", async () => {
    const items$ = new BehaviorSubject<CanvasItem[]>([base({ body: "a red chair" })]);
    const pendingSeen: unknown[] = [];
    items$.subscribe((items) => pendingSeen.push(items[0]?.metadata?.pending));
    const deps: CardFillDeps = {
      fill: vi.fn(() => of({ title: "Red Chair", imagePrompt: "red chair photo" })),
      render: vi.fn(() => of("data:image/png;base64,IMG")),
    };

    await lastValueFrom(settleCard$("c", { items$, apiKey: "k" }, deps));

    expect(items$.value[0]).toMatchObject({ title: "Red Chair", body: "a red chair", imagePrompt: "red chair photo", imageSrc: "data:image/png;base64,IMG" });
    expect(items$.value[0].metadata?.pending).toBeUndefined();
    expect(pendingSeen).toContain("fill");
    expect(pendingSeen).toContain("image");
    expect(deps.render).toHaveBeenCalledWith("k", "red chair photo");
  });

  it("never overwrites fields the user filled while generation was running", async () => {
    const items$ = new BehaviorSubject<CanvasItem[]>([base({ body: "x" })]);
    const fill$ = new Subject<{ title: string }>();
    const deps: CardFillDeps = { fill: () => fill$, render: () => of("img") };
    const done = lastValueFrom(settleCard$("c", { items$, apiKey: "k" }, deps));
    items$.next([{ ...items$.value[0], title: "User Title" }]);
    fill$.next({ title: "AI Title" });
    fill$.complete();
    await done;
    expect(items$.value[0].title).toBe("User Title");
  });

  it("skips work without an api key or when the card is complete", async () => {
    const deps: CardFillDeps = { fill: vi.fn(() => of({})), render: vi.fn(() => of("x")) };
    const items$ = new BehaviorSubject<CanvasItem[]>([base({ title: "t", body: "b", imageSrc: "i" })]);
    await lastValueFrom(settleCard$("c", { items$, apiKey: "k" }, deps));
    await lastValueFrom(settleCard$("c", { items$, apiKey: "" }, deps));
    expect(deps.fill).not.toHaveBeenCalled();
    expect(deps.render).not.toHaveBeenCalled();
  });

  it("clears pending when generation fails or is cancelled", async () => {
    const items$ = new BehaviorSubject<CanvasItem[]>([base({ imagePrompt: "p", title: "t", body: "b" })]);
    await lastValueFrom(settleCard$("c", { items$, apiKey: "k" }, { fill: () => of({}), render: () => throwError(() => new Error("boom")) }));
    expect(items$.value[0].metadata?.pending).toBeUndefined();

    const sub = settleCard$("c", { items$, apiKey: "k" }, { fill: () => of({}), render: () => NEVER }).subscribe();
    expect(items$.value[0].metadata?.pending).toBe("image");
    sub.unsubscribe();
    expect(items$.value[0].metadata?.pending).toBeUndefined();
  });

  it("settleCards$ completes after all cards settle", async () => {
    const items$ = new BehaviorSubject<CanvasItem[]>([base({ id: "a", imagePrompt: "p", title: "t", body: "b" }), base({ id: "b", imagePrompt: "q", title: "t", body: "b" })]);
    await lastValueFrom(settleCards$(["a", "b"], { items$, apiKey: "k" }, { fill: () => of({}), render: (_k, p) => of(`img-${p}`) }));
    expect(items$.value.map((i) => i.imageSrc)).toEqual(["img-p", "img-q"]);
  });
});
