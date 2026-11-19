import { html, svg } from "lit-html";
import { animationFrameScheduler, auditTime, combineLatest, map, type BehaviorSubject } from "rxjs";
import { createComponent } from "../../sdk/create-component";
import type { CanvasItem } from "./canvas.component";
import { itemsBounds, scrollToWorld, worldView$, type Rect } from "./canvas-viewport";
import { fitMinimap, mapToWorld, unionRects, worldToMap, type MinimapTransform } from "./minimap";
import "./minimap.css";

const WIDTH = 200;
const HEIGHT = 140;

/**
 * Overview of the whole board in the bottom-left corner. Drawn as SVG in *device* pixels: every rect is snapped
 * to whole device pixels and the view frame is four filled bars (not a stroke), so edges render at equal
 * thickness at any devicePixelRatio. Re-rendered at most once per frame. Click or drag to move the view there.
 */
export const MinimapComponent = createComponent(({ items$ }: { items$: BehaviorSubject<CanvasItem[]> }) => {
  let transform: MinimapTransform | null = null;
  /** Frozen during a drag so the map doesn't rescale under the pointer as the view moves. */
  let dragging = false;

  const centerViewAt = (event: PointerEvent) => {
    if (!transform) return;
    const rect = (event.currentTarget as SVGSVGElement).getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const world = mapToWorld(transform, (event.clientX - rect.left) * dpr, (event.clientY - rect.top) * dpr);
    const view = worldView$.value;
    scrollToWorld(world.x - view.width / 2, world.y - view.height / 2);
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    dragging = true;
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    centerViewAt(event);
  };
  const onPointerMove = (event: PointerEvent) => {
    if (dragging) centerViewAt(event);
  };
  const onPointerUp = (event: PointerEvent) => {
    dragging = false;
    (event.currentTarget as Element).releasePointerCapture(event.pointerId);
  };

  /** Rect in device pixels, snapped to whole pixels (at least `min` so tiny cards stay visible). */
  const snap = (t: MinimapTransform, r: Rect, min: number) => {
    const p = worldToMap(t, r.x, r.y);
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    return {
      x,
      y,
      w: Math.max(min, Math.round(p.x + r.width * t.scale) - x),
      h: Math.max(min, Math.round(p.y + r.height * t.scale) - y),
    };
  };

  return combineLatest([items$, worldView$]).pipe(
    auditTime(0, animationFrameScheduler),
    map(([items, view]) => {
      if (!items.length) return html``;
      const dpr = window.devicePixelRatio || 1;
      const deviceW = Math.round(WIDTH * dpr);
      const deviceH = Math.round(HEIGHT * dpr);
      const line = Math.max(1, Math.round(dpr));
      const bounds = unionRects([itemsBounds(items)!, view])!;
      if (!dragging || !transform) transform = fitMinimap(bounds, deviceW, deviceH, Math.round(6 * dpr));
      const t = transform;
      const v = snap(t, view, line * 3);

      return html`<svg
        class="minimap"
        width=${WIDTH}
        height=${HEIGHT}
        viewBox="0 0 ${deviceW} ${deviceH}"
        shape-rendering="crispEdges"
        role="img"
        aria-label="Minimap: click or drag to navigate"
        @pointerdown=${onPointerDown}
        @pointermove=${onPointerMove}
        @pointerup=${onPointerUp}
        @pointercancel=${onPointerUp}
      >
        <title>Minimap: click or drag to navigate</title>
        ${items.map((item) => {
          const r = snap(t, item, line * 2);
          return svg`<rect class=${item.isSelected ? "minimap-card selected" : "minimap-card"} x=${r.x} y=${r.y} width=${r.w} height=${r.h}></rect>`;
        })}
        <g class="minimap-view">
          <rect x=${v.x} y=${v.y} width=${v.w} height=${line}></rect>
          <rect x=${v.x} y=${v.y + v.h - line} width=${v.w} height=${line}></rect>
          <rect x=${v.x} y=${v.y} width=${line} height=${v.h}></rect>
          <rect x=${v.x + v.w - line} y=${v.y} width=${line} height=${v.h}></rect>
        </g>
      </svg>`;
    }),
  );
});
