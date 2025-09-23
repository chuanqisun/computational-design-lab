import { html } from "lit-html";
import { BehaviorSubject, map } from "rxjs";
import { createComponent } from "../../sdk/create-component";
import type { Property } from "../spectro-alignment/scan-properites";
import "./property-slider.component.css";

// Re-export for convenience
export type { Property };

interface PropertySliderProps {
  property: Property;
  onPropertyChange: (property: Property) => void;
  onRemove?: () => void;
}

export const PropertySlider = createComponent((props: PropertySliderProps) => {
  // Internal state for the current value
  const value$ = new BehaviorSubject<number>(props.property.value || 3);

  const updateName = (name: string) => {
    props.onPropertyChange({ ...props.property, name });
  };

  const updateLowEnd = (lowEnd: string) => {
    props.onPropertyChange({ ...props.property, lowEnd });
  };

  const updateHighEnd = (highEnd: string) => {
    props.onPropertyChange({ ...props.property, highEnd });
  };

  const updateValue = (value: number) => {
    value$.next(value);
    props.onPropertyChange({ ...props.property, value });
  };

  const template$ = value$.pipe(
    map(
      (value) => html`
        <div class="property-slider">
          <div class="property-slider__header">
            <input
              type="text"
              class="property-slider__name"
              .value=${props.property.name}
              placeholder="Property name"
              @input=${(e: Event) => updateName((e.target as HTMLInputElement).value)}
              @click=${(e: Event) => (e.target as HTMLInputElement).focus()}
            />
            ${props.onRemove ? html`<button class="property-slider__remove" @click=${props.onRemove}>×</button>` : ""}
          </div>
          <div class="property-slider__control">
            <input
              type="text"
              class="property-slider__label property-slider__label--left"
              .value=${props.property.lowEnd}
              placeholder="Low"
              @input=${(e: Event) => updateLowEnd((e.target as HTMLInputElement).value)}
              @click=${(e: Event) => (e.target as HTMLInputElement).focus()}
            />
            <input
              type="range"
              class="property-slider__slider"
              min="1"
              max="5"
              step="1"
              .value=${value.toString()}
              @input=${(e: Event) => updateValue(parseInt((e.target as HTMLInputElement).value))}
            />
            <input
              type="text"
              class="property-slider__label property-slider__label--right"
              .value=${props.property.highEnd}
              placeholder="High"
              @input=${(e: Event) => updateHighEnd((e.target as HTMLInputElement).value)}
              @click=${(e: Event) => (e.target as HTMLInputElement).focus()}
            />
            <div class="property-slider__value">${value}</div>
          </div>
        </div>
      `,
    ),
  );

  return template$;
});
