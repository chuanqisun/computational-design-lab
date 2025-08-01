import { render } from "lit-html";
import { BehaviorSubject } from "rxjs";
import { ConceptualizeComponent, type ConceptWithId } from "./components/conceptualize/conceptualize.component";
import { ConnectionsComponent } from "./components/connections/connections.component";
import { loadApiKeys, type ApiKeys } from "./components/connections/storage";
import { DesignComponent, type DesignWithId, type MockupWithId } from "./components/design/design.component";
import { FluxImageElement } from "./components/generative-image/generative-image";
import { MoodboardComponent, type ArtifactWithId } from "./components/moodboard/moodboard.component";
import { ParameterizeComponent, type ParameterWithId } from "./components/parameterize/parameterize.component";
import { PartiComponent } from "./components/parti/parti.component";
import "./main.css";

// Register custom elements
FluxImageElement.define(() => ({
  apiKey: loadApiKeys().together || "",
}));

// 1. Global DOM references
const connectionsContent = document.querySelector(".connections-content") as HTMLElement;
const partiContent = document.querySelector("#parti-content") as HTMLElement;
const conceptualContent = document.querySelector("#conceptual-content") as HTMLElement;
const artifactsContent = document.querySelector("#artifacts-content") as HTMLElement;
const parametersContent = document.querySelector("#parameters-content") as HTMLElement;
const fitContent = document.querySelector("#renderings-content") as HTMLElement;

// 2. States shared by components
const apiKeys$ = new BehaviorSubject<ApiKeys>(loadApiKeys());
const partiText$ = new BehaviorSubject<string>("");
const concepts$ = new BehaviorSubject<ConceptWithId[]>([]);
const artifacts$ = new BehaviorSubject<ArtifactWithId[]>([]);
const parameters$ = new BehaviorSubject<ParameterWithId[]>([]);
const domain$ = new BehaviorSubject<string>("");
const designs$ = new BehaviorSubject<DesignWithId[]>([]);
const mockups$ = new BehaviorSubject<MockupWithId[]>([]);

// 3. Components
const connectionsTemplate = ConnectionsComponent({ apiKeys$ });
const partiTemplate = PartiComponent({ partiText$ });
const conceptualTemplate = ConceptualizeComponent({ apiKeys$, partiText$, concepts$ });
const moodboardTemplate = MoodboardComponent({ apiKeys$, concepts$, partiText$, artifacts$ });
const parameterizeTemplate = ParameterizeComponent({
  apiKeys$,
  concepts$,
  artifacts$,
  partiText$,
  parameters$,
  domain$,
});
const designTemplate = DesignComponent({
  apiKeys$,
  concepts$,
  artifacts$,
  parameters$,
  partiText$,
  domain$,
  designs$,
  mockups$,
});

// 4. Effects: subscribe and render
render(connectionsTemplate, connectionsContent);
render(partiTemplate, partiContent);
render(conceptualTemplate, conceptualContent);
render(moodboardTemplate, artifactsContent);
render(parameterizeTemplate, parametersContent);
render(designTemplate, fitContent);
