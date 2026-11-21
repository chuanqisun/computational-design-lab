export type StudioContent = { type: "text"; text: string } | { type: "image"; data: string; mime_type: string };

export interface StudioTurn {
  role: "user" | "model";
  content: StudioContent[];
}

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
