import { html } from "lit-html";
import { BehaviorSubject, map, mergeWith } from "rxjs";
import { createComponent } from "../../sdk/create-component";
import type { ApiKeys } from "../connections/storage";
import "./sepctro-alignment.component.css";

interface Property {
  name: string;
  lowEnd: string;
  highEnd: string;
  value: number; // 1-5
}

interface SpectroAlignmentProps {
  apiKeys$: BehaviorSubject<ApiKeys>;
}

export const SpectroAlignmentComponent = createComponent((props: SpectroAlignmentProps) => {
  // Internal state
  const image$ = new BehaviorSubject<string | null>(null);
  const properties$ = new BehaviorSubject<Property[]>([]);
  // Template
  const template$ = properties$.pipe(
    map((properties) => {
      return html` <div class="spectro-alignment"></div> `;
    }),
    mergeWith(),
  );

  return template$;
});
