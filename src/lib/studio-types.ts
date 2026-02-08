import type { Content } from "@google/genai";
import type { BehaviorSubject, Subject } from "rxjs";

export interface PhotoCard {
  id: string;
  scene: string;
  prompt: string;
  animationPrompt: string;
  soundDescription: string;
  sourceXml: string;
  isGenerating: boolean;
  imageReady?: boolean;
  isVideo?: boolean;
  startFrameUrl?: string;
}

export interface ScannedPhoto {
  id: string;
  thumbnailUrl: string;
  fullDataUrl: string;
  label: string;
  isScanning: boolean;
}

export interface ScanResult {
  photoId: string;
  shapes: string[];
  materials: string[];
  mechanisms: string[];
  colors: string[];
}

export interface PendingPhoto {
  id: string;
  thumbnailUrl: string;
  fullDataUrl: string;
}

export interface StudioState {
  pickedColors$: BehaviorSubject<string[]>;
  pickedMaterials$: BehaviorSubject<string[]>;
  pickedSurfaceOptions$: BehaviorSubject<string[]>;
  pickedMechanisms$: BehaviorSubject<string[]>;
  pickedShapes$: BehaviorSubject<string[]>;
  filterText$: BehaviorSubject<string>;
  customInstructions$: BehaviorSubject<string>;
  synthesisOutput$: BehaviorSubject<string>;
  isSynthesizing$: BehaviorSubject<boolean>;
  editInstructions$: BehaviorSubject<string>;
  conversationHistory$: BehaviorSubject<Content[]>;
  photoScene$: BehaviorSubject<string>;
  photoGallery$: BehaviorSubject<PhotoCard[]>;
  scannedPhotos$: BehaviorSubject<ScannedPhoto[]>;
  scanTrigger$: Subject<ScannedPhoto>;
}
