import canvasBlendImagesTemplate from "./canvas-blend-images";
import canvasDesignConceptsTemplate from "./canvas-design-concepts";
import canvasEnhanceImagePromptTemplate from "./canvas-enhance-image-prompt";
import canvasFillCardTemplate from "./canvas-fill-card";
import canvasGeneratePersonasTemplate from "./canvas-generate-personas";
import canvasRankDesignsTemplate from "./canvas-rank-designs";
import canvasScanConceptsTemplate from "./canvas-scan-concepts";
import canvasVisualizeConceptTemplate from "./canvas-visualize-concept";
import canvasAnimateTemplate from "./canvas-animate";
import canvasAutoIterateAgentTemplate from "./canvas-auto-iterate-agent";
import canvasEditImageTemplate from "./canvas-edit-image";
import canvasInterviewLiveTemplate from "./canvas-interview-live";
import canvasInterviewTextTemplate from "./canvas-interview-text";
import canvasRateLensesTemplate from "./canvas-rate-lenses";
import canvasRefineCardTextTemplate from "./canvas-refine-card-text";
import canvasSearchReferenceImageTemplate from "./canvas-search-reference-image";
import canvasSearchReferencesTemplate from "./canvas-search-references";
import canvasSummarizeInterviewTemplate from "./canvas-summarize-interview";
import canvasSummarizeWorkflowTemplate from "./canvas-summarize-workflow";
import studioAnimatePhotoTemplate from "./studio-animate-photo";
import type { PromptTemplateModule } from "./prompt-template.types";
import studioGenerateSoundDescriptionTemplate from "./studio-generate-sound-description";
import studioImportCanvasInstructionsTemplate from "./studio-import-canvas-instructions";
import studioReviseSceneXmlTemplate from "./studio-revise-scene-xml";
import studioScanProductFeaturesTemplate from "./studio-scan-product-features";
import studioStagePhotoSceneTemplate from "./studio-stage-photo-scene";
import studioSynthesizeSceneXmlTemplate from "./studio-synthesize-scene-xml";

export type TemplateRecord = PromptTemplateModule<Record<string, unknown>, string>;

export interface TemplateItem {
  /** Matches the module's file name. */
  id: string;
  module: TemplateRecord;
}

/**
 * Every prompt the canvas and photo/video studio apps send. Only prompts reachable from those apps belong
 * here.
 */
export const promptTemplates: TemplateItem[] = [
  // Canvas
  { id: "canvas-enhance-image-prompt", module: canvasEnhanceImagePromptTemplate as TemplateRecord },
  { id: "canvas-blend-images", module: canvasBlendImagesTemplate as TemplateRecord },
  { id: "canvas-design-concepts", module: canvasDesignConceptsTemplate as TemplateRecord },
  { id: "canvas-fill-card", module: canvasFillCardTemplate as TemplateRecord },
  { id: "canvas-generate-personas", module: canvasGeneratePersonasTemplate as TemplateRecord },
  { id: "canvas-rank-designs", module: canvasRankDesignsTemplate as TemplateRecord },
  { id: "canvas-scan-concepts", module: canvasScanConceptsTemplate as TemplateRecord },
  { id: "canvas-visualize-concept", module: canvasVisualizeConceptTemplate as TemplateRecord },
  { id: "canvas-animate", module: canvasAnimateTemplate as TemplateRecord },
  { id: "canvas-auto-iterate-agent", module: canvasAutoIterateAgentTemplate as TemplateRecord },
  { id: "canvas-edit-image", module: canvasEditImageTemplate as TemplateRecord },
  { id: "canvas-interview-live", module: canvasInterviewLiveTemplate as TemplateRecord },
  { id: "canvas-interview-text", module: canvasInterviewTextTemplate as TemplateRecord },
  { id: "canvas-rate-lenses", module: canvasRateLensesTemplate as TemplateRecord },
  { id: "canvas-refine-card-text", module: canvasRefineCardTextTemplate as TemplateRecord },
  { id: "canvas-search-reference-image", module: canvasSearchReferenceImageTemplate as TemplateRecord },
  { id: "canvas-search-references", module: canvasSearchReferencesTemplate as TemplateRecord },
  { id: "canvas-summarize-interview", module: canvasSummarizeInterviewTemplate as TemplateRecord },
  { id: "canvas-summarize-workflow", module: canvasSummarizeWorkflowTemplate as TemplateRecord },
  // Studio
  { id: "studio-import-canvas-instructions", module: studioImportCanvasInstructionsTemplate as TemplateRecord },
  { id: "studio-scan-product-features", module: studioScanProductFeaturesTemplate as TemplateRecord },
  { id: "studio-synthesize-scene-xml", module: studioSynthesizeSceneXmlTemplate as TemplateRecord },
  { id: "studio-revise-scene-xml", module: studioReviseSceneXmlTemplate as TemplateRecord },
  { id: "studio-generate-sound-description", module: studioGenerateSoundDescriptionTemplate as TemplateRecord },
  { id: "studio-stage-photo-scene", module: studioStagePhotoSceneTemplate as TemplateRecord },
  { id: "studio-animate-photo", module: studioAnimatePhotoTemplate as TemplateRecord },
];
