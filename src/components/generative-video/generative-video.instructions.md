---
applyTo: "generative-video/**"
---

# Veo 3.1 Documentation

[Veo 3.1](https://deepmind.google/models/veo/) is Google's state-of-the-art model for generating high-fidelity, 8-second 720p or 1080p videos featuring stunning realism and natively generated audio.

## Key Capabilities

- **Video extension**: Extend videos previously generated using Veo.
- **Frame-specific generation**: Generate a video by specifying the first and last frames.
- **Image-based direction**: Use up to three reference images to guide content.

---

## Text to Video Generation

The following example demonstrates how to generate a video with dialogue and sound effects using JavaScript.

### JavaScript Example

```javascript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({});

const prompt = `A close up of two people staring at a cryptic drawing on a wall, torchlight flickering.
A man murmurs, 'This must be it. That's the secret code.' The woman looks at him and whispering excitedly, 'What did you find?'`;

let operation = await ai.models.generateVideos({
  model: "veo-3.1-generate-preview",
  prompt: prompt,
});

// Poll the operation status until the video is ready.
while (!operation.done) {
  console.log("Waiting for video generation to complete...");
  await new Promise((resolve) => setTimeout(resolve, 10000));
  operation = await ai.operations.getVideosOperation({
    operation: operation,
  });
}

// Download the generated video.
ai.files.download({
  file: operation.response.generatedVideos[0].video,
  downloadPath: "dialogue_example.mp4",
});
console.log(`Generated video saved to dialogue_example.mp4`);
```

---

## Image to Video Generation

This example shows how to generate an image using Gemini and then use that image as the starting frame for a Veo 3.1 video.

### JavaScript Example

```javascript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({});

const prompt = "Panning wide shot of a calico kitten sleeping in the sunshine";

// Step 1: Generate an image.
const imageResponse = await ai.models.generateContent({
  model: "gemini-2.5-flash-image",
  prompt: prompt,
});

// Step 2: Generate video with Veo 3.1 using the image.
let operation = await ai.models.generateVideos({
  model: "veo-3.1-generate-preview",
  prompt: prompt,
  image: {
    imageBytes: imageResponse.generatedImages[0].image.imageBytes,
    mimeType: "image/png",
  },
});

// Poll the operation status until the video is ready.
while (!operation.done) {
  console.log("Waiting for video generation to complete...");
  await new Promise((resolve) => setTimeout(resolve, 10000));
  operation = await ai.operations.getVideosOperation({
    operation: operation,
  });
}

// Download the video.
ai.files.download({
  file: operation.response.generatedVideos[0].video,
  downloadPath: "veo3_with_image_input.mp4",
});
console.log(`Generated video saved to veo3_with_image_input.mp4`);
```

---

## Handling Asynchronous Operations

Video generation is a long-running task. You must poll the operation object until the `done` status is true.

### JavaScript Example

```javascript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({});

// Start the job
let operation = await ai.models.generateVideos({
  model: "veo-3.1-generate-preview",
  prompt: "A cinematic shot of a majestic lion in the savannah.",
});

// Polling loop
while (!operation.done) {
  await new Promise((resolve) => setTimeout(resolve, 10000));
  // Refresh the operation object
  operation = await ai.operations.getVideosOperation({ operation });
}

// Process result
console.log("Video generation complete", operation.response);
```

---

## Customizing Parameters

You can guide the model by setting specific configuration parameters such as `aspectRatio` and `negativePrompt`.

### JavaScript Example

```javascript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({});

let operation = await ai.models.generateVideos({
  model: "veo-3.1-generate-preview",
  prompt: "A cinematic shot of a majestic lion in the savannah.",
  config: {
    aspectRatio: "16:9",
    negativePrompt: "cartoon, drawing, low quality",
  },
});

// Poll the operation status
while (!operation.done) {
  console.log("Waiting for video generation to complete...");
  await new Promise((resolve) => setTimeout(resolve, 10000));
  operation = await ai.operations.getVideosOperation({
    operation: operation,
  });
}

// Download the result
ai.files.download({
  file: operation.response.generatedVideos[0].video,
  downloadPath: "parameters_example.mp4",
});
```

---

## Veo API Parameters

| Parameter         | Description                     | Veo 3.1             |
| :---------------- | :------------------------------ | :------------------ |
| `prompt`          | Text description for the video. | `string`            |
| `negativePrompt`  | Description of what to exclude. | `string`            |
| `image`           | Initial image to animate.       | `Image` object      |
| `lastFrame`       | Final image for interpolation.  | `Image` object      |
| `aspectRatio`     | The video's aspect ratio.       | `"16:9"`, `"9:16"`  |
| `resolution`      | Output resolution.              | `"720p"`, `"1080p"` |
| `durationSeconds` | Length of the video.            | `"4"`, `"6"`, `"8"` |

---

## Limitations

- **Latency**: 11 seconds to 6 minutes depending on load.
- **Retention**: Generated videos are stored for **2 days**. You must download them within this window.
- **Watermarking**: All videos include [SynthID](https://deepmind.google/technologies/synthid/) digital watermarks.
- **Regional Restrictions**: Specific `personGeneration` settings apply in the EU, UK, CH, and MENA regions.
