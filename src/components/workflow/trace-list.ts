import { html, nothing } from "lit-html";
import type { ActionRecord } from "../../lib/workflows/action-log";

export const timeOf = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export const actorBadge = (actor: ActionRecord["actor"]) =>
  html`<span class="actor-badge actor-${actor}" title=${actor === "ai" ? "Performed by the AI" : "Performed by you"}
    >${actor === "ai" ? "AI" : "You"}</span
  >`;

/** One trace row: actor · action · summary · time (+ optional checkbox and thumbnails). */
export function traceRow(
  record: ActionRecord,
  options: { checked?: boolean; onToggle?: () => void; thumbs?: boolean } = {},
) {
  const selectable = options.onToggle !== undefined;
  const content = html`
    ${selectable
      ? html`<input type="checkbox" .checked=${!!options.checked} @change=${options.onToggle} aria-label="Select step" />`
      : nothing}
    ${actorBadge(record.actor)}
    <code class="trace-action">${record.action}</code>
    <span class="trace-summary" title=${record.summary}>${record.status === "running" ? "In progress…" : record.summary}</span>
    <time>${timeOf(record.timestamp)}</time>
  `;
  return html`<li class="trace-row status-${record.status} ${selectable ? "selectable" : ""}">
    ${selectable ? html`<label>${content}</label>` : html`<div class="trace-line">${content}</div>`}
    ${options.thumbs && record.outputThumbs.length
      ? html`<div class="trace-thumbs">${record.outputThumbs.map((src) => html`<img src=${src} alt="" />`)}</div>`
      : nothing}
  </li>`;
}
