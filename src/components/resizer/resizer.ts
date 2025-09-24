import { html } from "lit-html";
import { BehaviorSubject } from "rxjs";
import "./resizer.css";

export const ResizerComponent = ({ trayWidth$ }: { trayWidth$: BehaviorSubject<number> }) => {
  const startResize = (e: PointerEvent) => {
    e.preventDefault();
    const target = e.target as HTMLElement;
    target.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startWidth = trayWidth$.value;
    const handlePointerMove = (e: PointerEvent) => {
      const delta = -e.clientX + startX; // the tray is on the right, so invert the delta
      trayWidth$.next(Math.max(100, startWidth + delta));
    };
    const handlePointerUp = () => {
      target.releasePointerCapture(e.pointerId);
      target.removeEventListener("pointermove", handlePointerMove);
      target.removeEventListener("pointerup", handlePointerUp);
    };
    target.addEventListener("pointermove", handlePointerMove);
    target.addEventListener("pointerup", handlePointerUp);
  };

  return html`<div class="resizer" @pointerdown=${startResize}></div>`;
};
