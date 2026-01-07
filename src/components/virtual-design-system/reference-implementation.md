Gemini AI reference implementation

```js
async function generateContentFromVertexAI() {
  const ai = new GoogleGenAI({
    vertexai: true,
    project: GOOGLE_CLOUD_PROJECT,
    location: GOOGLE_CLOUD_LOCATION,
  });
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: "why is the sky blue?",
  });
  console.debug(response.text);
}
```
