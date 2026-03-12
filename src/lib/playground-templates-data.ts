export interface PromptTemplate {
  id: string;
  title: string;
  description: string;
  promptTemplate: string;
  defaultVariables: Record<string, unknown>;
}

export const builtinTemplates: PromptTemplate[] = [
  {
    id: "packaging-concept",
    title: "Packaging Concept",
    description: "Generate a packaging design concept prompt",
    promptTemplate: `Design a {{productType}} package for {{brand}}.

Use these material cues: {{inlineList materials}}.

{{#if colorPalette}}Color palette: {{inlineList colorPalette}}.{{/if}}

{{#if designNotes}}Design notes:
{{bulletList designNotes}}{{/if}}

{{#if referenceImages}}Use these reference images: {{inlineList referenceImages}}.{{/if}}`,
    defaultVariables: {
      productType: "premium bottle",
      brand: "Luxe Spirits",
      materials: ["frosted glass", "brushed aluminum"],
      colorPalette: ["midnight blue", "gold"],
      designNotes: ["must be recyclable", "target shelf height 30cm"],
      referenceImages: ["Bottle A"],
    },
  },
  {
    id: "reference-analysis",
    title: "Reference Analysis",
    description: "Analyze design references for key patterns",
    promptTemplate: `Analyze the following design references: {{inlineList referenceImages}}.

{{#if focusAreas}}Focus on these areas:
{{bulletList focusAreas}}{{/if}}

{{#if brandContext}}Brand context: {{brandContext}}.{{/if}}

Provide a structured analysis of visual patterns, material choices, and compositional strategies.`,
    defaultVariables: {
      referenceImages: ["Reference Image 1", "Reference Image 2"],
      focusAreas: ["material texture", "color harmony", "form language"],
      brandContext: "premium consumer goods",
    },
  },
  {
    id: "prompt-revision",
    title: "Prompt Revision",
    description: "Refine and improve an existing prompt",
    promptTemplate: `Revise the following prompt to be more effective:

Original prompt:
{{originalPrompt}}

{{#if improvements}}Requested improvements:
{{bulletList improvements}}{{/if}}

{{#if targetAudience}}Target audience: {{targetAudience}}.{{/if}}

Rewrite the prompt to be clearer, more specific, and better structured.`,
    defaultVariables: {
      originalPrompt: "Make a nice package design",
      improvements: ["add specific material constraints", "include brand guidelines"],
      targetAudience: "packaging designers",
    },
  },
  {
    id: "blank",
    title: "Blank Template",
    description: "Start from scratch with an empty template",
    promptTemplate: `{{prompt}}`,
    defaultVariables: {
      prompt: "",
    },
  },
];
