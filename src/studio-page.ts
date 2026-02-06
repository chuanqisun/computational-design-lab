import { BehaviorSubject } from "rxjs";
import { loadApiKeys, type ApiKeys } from "./components/connections/storage";
import { useSetupDialog } from "./components/connections/use-setup-dialog";
import { GenerativeImageElement } from "./components/generative-image/generative-image";
import { GenerativeVideoElement } from "./components/generative-video/generative-video";
import "./studio-page.css";

// Register custom elements
GenerativeImageElement.define(() => ({
  flux: { apiKey: apiKeys$.value.together || "" },
  gemini: { apiKey: apiKeys$.value.gemini || "" },
}));

GenerativeVideoElement.define(() => ({
  gemini: { apiKey: apiKeys$.value.gemini || "" },
}));

// Shared state for API keys
const apiKeys$ = new BehaviorSubject<ApiKeys>(loadApiKeys());
const setupDialog = document.getElementById("setup-dialog") as HTMLDialogElement;

useSetupDialog({ dialogElement: setupDialog, apiKeys$ });
