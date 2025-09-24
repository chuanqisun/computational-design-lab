import { html } from "lit-html";
import { BehaviorSubject, combineLatest, from, map, mergeMap } from "rxjs";
import { createComponent } from "../../sdk/create-component";
import type { ApiKeys } from "../connections/storage";
import { generateSpectrumImages$ } from "./generate-spectrum-images";
import "./semantic-scan.component.css";
import { bottleDesignSpectrum, type Spectrum } from "./spectrums";

interface SemanticScanProps {
  apiKeys$: BehaviorSubject<ApiKeys>;
}

export const SemanticScanComponent = createComponent((props: SemanticScanProps) => {
  // Internal state
  const image$ = new BehaviorSubject<string | null>(null);
  const generatedImages$ = new BehaviorSubject<Array<{ spectrum: Spectrum; leftImage: string; rightImage: string }>>(
    [],
  );

  const generateImages = () => {
    const currentImage = image$.value;
    if (!currentImage) return;

    const apiKeys = props.apiKeys$.value;
    const apiKey = apiKeys.gemini;
    if (!apiKey) {
      console.error("No Gemini API key");
      return;
    }

    generatedImages$.next(bottleDesignSpectrum.map((s) => ({ spectrum: s, leftImage: "", rightImage: "" })));

    from(bottleDesignSpectrum)
      .pipe(
        mergeMap((spectrum) =>
          generateSpectrumImages$({ image: currentImage, spectrum, apiKey }).pipe(
            map((result) => ({ spectrum, ...result })),
          ),
        ),
      )
      .subscribe({
        next: (item) => {
          const current = generatedImages$.value;
          const index = current.findIndex((e) => e.spectrum.name === item.spectrum.name);
          if (index !== -1) {
            current[index] = item;
            generatedImages$.next([...current]);
          }
        },
        error: (err) => {
          console.error(err);
        },
      });
  };

  const readClipboard = async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        for (const type of item.types) {
          if (type.startsWith("image/")) {
            const blob = await item.getType(type);
            const reader = new FileReader();
            reader.onload = () => {
              image$.next(reader.result as string);
              generateImages();
            };
            reader.readAsDataURL(blob);
            return;
          }
        }
      }
    } catch (err) {
      console.error("Failed to read clipboard:", err);
    }
  };

  // Template
  const template$ = combineLatest([image$, generatedImages$]).pipe(
    map(([image, generatedImages]) => {
      return html`
        <div class="semantic-scan">
          <div class="actions">
            <button @click=${readClipboard}>Paste Image</button>
          </div>

          ${image ? html`<img src=${image} alt="Loaded image" />` : ""}
          ${generatedImages.length > 0
            ? html`
                <div class="generated">
                  ${generatedImages.map(
                    (item) => html`
                      <div class="spectrum">
                        <h4>${item.spectrum.name}</h4>
                        <div class="end">
                          <span>${item.spectrum.leftEndName}:</span>
                          <img src=${item.leftImage} alt=${item.spectrum.leftEndName} />
                        </div>
                        <div class="end">
                          <span>${item.spectrum.rightEndName}:</span>
                          <img src=${item.rightImage} alt=${item.spectrum.rightEndName} />
                        </div>
                      </div>
                    `,
                  )}
                </div>
              `
            : ""}
        </div>
      `;
    }),
  );

  return template$;
});
