import { html, render } from "lit-html";
import type { BehaviorSubject } from "rxjs";
import { ConnectionsComponent } from "./connections.component";
import type { ApiKeys } from "./storage";

export interface UseSetupDialogProps {
  dialogElement: HTMLDialogElement;
  apiKeys$: BehaviorSubject<ApiKeys>;
  providers?: Array<keyof ApiKeys>;
}
export function useSetupDialog(props: UseSetupDialogProps) {
  const { dialogElement, apiKeys$, providers } = props;
  const setupDialogContent = dialogElement.querySelector(".dialog-content") as HTMLElement;
  const template = html`
    <div class="dialog-header">
      <h2>Connections</h2>
      <button commandfor="${dialogElement.id}" command="close">Close</button>
    </div>
    <div class="setup-form">${ConnectionsComponent({ apiKeys$, providers })}</div>
  `;
  render(template, setupDialogContent);
}
