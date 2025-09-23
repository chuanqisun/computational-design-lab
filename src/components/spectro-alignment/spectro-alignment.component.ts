import { html } from "lit-html";
import { BehaviorSubject, combineLatest, map } from "rxjs";
import { createComponent } from "../../sdk/create-component";
import type { ApiKeys } from "../connections/storage";
import { streamProperties$, type Property } from "./scan-properites";
import "./sepctro-alignment.component.css";

interface SpectroAlignmentProps {
  apiKeys$: BehaviorSubject<ApiKeys>;
}

export const SpectroAlignmentComponent = createComponent((props: SpectroAlignmentProps) => {
  // Internal state
  const image$ = new BehaviorSubject<string | null>(null);
  const properties$ = new BehaviorSubject<Property[]>([]);

  const readClipboard = async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        for (const type of item.types) {
          if (type.startsWith("image/")) {
            const blob = await item.getType(type);
            const reader = new FileReader();
            reader.onload = () => image$.next(reader.result as string);
            reader.readAsDataURL(blob);
            return;
          }
        }
      }
    } catch (err) {
      console.error("Failed to read clipboard:", err);
    }
  };

  const scanImage = () => {
    const currentImage = image$.value;
    if (!currentImage) return;
    const apiKeys = props.apiKeys$.value;
    const apiKey = apiKeys.openai;
    if (!apiKey) {
      console.error("No OpenAI API key");
      return;
    }
    streamProperties$({ image: currentImage, apiKey }).subscribe({
      next: (prop) => {
        properties$.next([...properties$.value, prop]);
      },
      complete: () => {},
      error: (err) => console.error(err),
    });
  };

  const addProperty = () => {
    properties$.next([...properties$.value, { name: "", lowEnd: "", highEnd: "" }]);
  };

  const updateProp = (prop: Property, key: keyof Property, value: string) => {
    const newProps = properties$.value.map((p) => (p === prop ? { ...p, [key]: value } : p));
    properties$.next(newProps);
  };

  // Template
  const template$ = combineLatest([image$, properties$]).pipe(
    map(([image, properties]) => {
      return html`
        <div class="spectro-alignment">
          <button @click=${readClipboard}>Load Image</button>
          <button @click=${scanImage}>Scan</button>
          <button @click=${addProperty}>Add Property</button>
          ${image ? html`<img src=${image} alt="Loaded image" />` : ""}
          ${properties.map(
            (prop) => html`
              <div class="property">
                <input
                  type="text"
                  .value=${prop.name}
                  @input=${(e: Event) => updateProp(prop, "name", (e.target as HTMLInputElement).value)}
                />
                <input
                  type="text"
                  .value=${prop.lowEnd}
                  @input=${(e: Event) => updateProp(prop, "lowEnd", (e.target as HTMLInputElement).value)}
                />
                <input type="range" min="1" max="5" value="3" />
                <input
                  type="text"
                  .value=${prop.highEnd}
                  @input=${(e: Event) => updateProp(prop, "highEnd", (e.target as HTMLInputElement).value)}
                />
              </div>
            `,
          )}
        </div>
      `;
    }),
  );

  return template$;
});
