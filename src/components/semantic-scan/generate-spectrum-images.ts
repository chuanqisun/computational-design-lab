import { forkJoin, map, Observable } from "rxjs";
import { imageToimage } from "./image-to-image";
import type { Spectrum } from "./spectrums";

export function generateSpectrumImages$(params: {
  image: string;
  spectrum: Spectrum;
  apiKey: string;
}): Observable<{ leftImage: string; rightImage: string }> {
  const leftInstruction = `Edit this image to represent the "${params.spectrum.leftEndName}" end of the spectrum "${params.spectrum.name}". Description: ${params.spectrum.description}. Make the image embody the qualities of "${params.spectrum.leftEndName}" while maintaining the overall composition and style.`;

  const rightInstruction = `Edit this image to represent the "${params.spectrum.rightEndName}" end of the spectrum "${params.spectrum.name}". Description: ${params.spectrum.description}. Make the image embody the qualities of "${params.spectrum.rightEndName}" while maintaining the overall composition and style.`;

  const leftObs = imageToimage({ instruction: leftInstruction, image: params.image, apiKey: params.apiKey });
  const rightObs = imageToimage({ instruction: rightInstruction, image: params.image, apiKey: params.apiKey });

  return forkJoin([leftObs, rightObs]).pipe(map(([leftImage, rightImage]) => ({ leftImage, rightImage })));
}
