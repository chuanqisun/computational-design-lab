export type PromptContentType = "text" | "image" | "xml" | "json" | "mixed" | "audio" | "video";

export interface PromptSlotMetadata {
  description: string;
  required: boolean;
  multiple: boolean;
  type: PromptContentType | "number" | "boolean";
}

export interface PromptTemplateMetadata<Slots extends string> {
  title: string;
  sourceFiles: string[];
  categories: string[];
  inputType: PromptContentType;
  outputType: PromptContentType;
  slots: Record<Slots, PromptSlotMetadata>;
}

export interface RenderedPrompt {
  system?: string;
  developer?: string;
  user: string;
}

export interface PromptTemplateModule<Vars extends object, Slots extends keyof Vars & string> {
  metadata: PromptTemplateMetadata<Slots>;
  template: (vars: Partial<Vars>) => RenderedPrompt;
}