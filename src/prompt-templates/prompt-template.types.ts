export type PromptContentType = "text" | "image" | "xml" | "json" | "mixed" | "audio" | "video";

export interface PromptSlotMetadata {
  description: string;
  required: boolean;
  multiple: boolean;
  type: PromptContentType | "number" | "boolean";
}

export interface PromptTemplateMetadata<Slots extends string> {
  title: string;
  purpose: string;
  sourceFiles: string[];
  categories: string[];
  inputType: PromptContentType;
  outputType: PromptContentType;
  model: string;
  outputSchema?: Record<string, unknown>;
  slots: Record<Slots, PromptSlotMetadata>;
}

export interface RenderedPrompt {
  system?: string;
  developer?: string;
  user: string;
}

export interface PromptTemplatePreset<Vars extends object> {
  title: string;
  description?: string;
  values: Partial<Vars>;
}

export interface PromptTemplateModule<Vars extends object, Slots extends keyof Vars & string> {
  metadata: PromptTemplateMetadata<Slots>;
  presets: PromptTemplatePreset<Vars>[];
  template: (vars: Partial<Vars>) => RenderedPrompt;
}
