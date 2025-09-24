import { html } from "lit-html";
import { BehaviorSubject, combineLatest, from, map, mergeMap } from "rxjs";
import { createComponent } from "../../sdk/create-component";
import type { ApiKeys } from "../connections/storage";
import { extrapolateSpectrum$ } from "./extrapolate-spectrum";
import { generateDescription$ } from "./generate-description";
import "./semantic-scan.component.css";
import { bottleDesignSpectrum, type Spectrum } from "./spectrums";

interface SemanticScanProps {
  apiKeys$: BehaviorSubject<ApiKeys>;
}

export const SemanticScanComponent = createComponent((props: SemanticScanProps) => {
  // Internal state
  const image$ = new BehaviorSubject<string | null>(null);
  const description$ = new BehaviorSubject<string>("");
  const isGenerating$ = new BehaviorSubject<boolean>(false);
  const extrapolated$ = new BehaviorSubject<Array<{ spectrum: Spectrum; leftEnd: string; rightEnd: string }>>([]);

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
              description$.next(""); // Clear previous description
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

  const generateDescription = () => {
    const currentImage = image$.value;
    if (!currentImage) return;

    const apiKeys = props.apiKeys$.value;
    const apiKey = apiKeys.openai;
    if (!apiKey) {
      console.error("No OpenAI API key");
      return;
    }

    isGenerating$.next(true);
    generateDescription$({ image: currentImage, apiKey }).subscribe({
      next: (desc) => {
        description$.next(desc);
      },
      complete: () => {
        isGenerating$.next(false);
      },
      error: (err) => {
        console.error(err);
        isGenerating$.next(false);
      },
    });
  };

  const updateDescription = (event: Event) => {
    const target = event.target as HTMLTextAreaElement;
    description$.next(target.value);
  };

  const copyDescription = () => {
    const desc = description$.value;
    if (desc) {
      navigator.clipboard.writeText(desc);
    }
  };

  const extrapolate = () => {
    const currentDescription = description$.value;
    if (!currentDescription) return;

    const apiKeys = props.apiKeys$.value;
    const apiKey = apiKeys.openai;
    if (!apiKey) {
      console.error("No OpenAI API key");
      return;
    }

    extrapolated$.next(bottleDesignSpectrum.map((s) => ({ spectrum: s, leftEnd: "", rightEnd: "" })));

    from(bottleDesignSpectrum)
      .pipe(
        mergeMap((spectrum) =>
          extrapolateSpectrum$({ prompt: currentDescription, spectrum, apiKey }).pipe(
            map((result) => ({ spectrum, ...result })),
          ),
        ),
      )
      .subscribe({
        next: (item) => {
          const current = extrapolated$.value;
          const index = current.findIndex((e) => e.spectrum.name === item.spectrum.name);
          if (index !== -1) {
            current[index] = item;
            extrapolated$.next([...current]);
          }
        },
        error: (err) => {
          console.error(err);
        },
      });
  };

  // Template
  const template$ = combineLatest([image$, description$, isGenerating$, extrapolated$]).pipe(
    map(([image, description, isGenerating, extrapolated]) => {
      return html`
        <div class="semantic-scan">
          <div class="actions">
            <button @click=${readClipboard}>Paste Image</button>
            <button @click=${generateDescription} ?disabled=${!image || isGenerating}>
              ${isGenerating ? "Generating..." : "Generate Description"}
            </button>
            ${description ? html`<button @click=${copyDescription}>Copy Description</button>` : ""}
            ${description ? html`<button @click=${extrapolate}>Extrapolate</button>` : ""}
          </div>

          ${image ? html`<img src=${image} alt="Loaded image" />` : ""}
          ${description || isGenerating
            ? html`
                <textarea
                  placeholder="Generated description will appear here..."
                  .value=${description}
                  @input=${updateDescription}
                  ?disabled=${isGenerating}
                ></textarea>
              `
            : ""}
          ${extrapolated.length > 0
            ? html`
                <div class="extrapolated">
                  ${extrapolated.map(
                    (item) => html`
                      <div class="spectrum">
                        <h4>${item.spectrum.name}</h4>
                        <div class="end">
                          <span>${item.spectrum.leftEndName}:</span>
                          <generative-image prompt=${item.leftEnd}></generative-image>
                        </div>
                        <div class="end">
                          <span>${item.spectrum.rightEndName}:</span>
                          <generative-image prompt=${item.rightEnd}></generative-image>
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
