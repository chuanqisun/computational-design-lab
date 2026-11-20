import { html, render } from "lit-html";
import { repeat } from "lit-html/directives/repeat.js";
import { BehaviorSubject, fromEvent, map } from "rxjs";
import "./canvas-guide-page.css";

interface GuideEntry {
  id: string;
  section: string;
  title: string;
  /** Selection or input required before the tool appears / enables. */
  needs: string;
  what: string;
  how: string;
  /** File in src/canvas-guide-clips/ (without extension). Omitted when the feature cannot be recorded. */
  clip?: string;
  note?: string;
}

const entries: GuideEntry[] = [
  {
    id: "upload",
    section: "New",
    title: "Upload",
    needs: "Nothing. Always available.",
    what: "Brings images or videos from your computer onto the board, one card per file.",
    how: "Opens the system file picker (images and videos, multiple files at once). Each file becomes a card, then Gemini looks at the media and writes the card's title and description.",
    clip: "upload",
  },
  {
    id: "capture",
    section: "New",
    title: "Capture",
    needs: "A webcam, and permission to use it.",
    what: "Takes photos or short video clips with your webcam and adds them as cards.",
    how: "Opens a camera dialog with Photo and Video modes and a camera picker. You review the shots, then click Confirm to place them on the board. Gemini then captions each card, as it does for uploads.",
    clip: "capture",
    note: "Recorded with a simulated camera feed.",
  },
  {
    id: "render",
    section: "New",
    title: "Render",
    needs: "A prompt in the New text box. Selected cards are optional context.",
    what: "Generates a new image from a text description.",
    how: "Sends the prompt to the Gemini image model. The text and images of any selected cards are added as extra context. The image lands as a new card, and Gemini then writes its title and description.",
    clip: "render",
  },
  {
    id: "write",
    section: "New",
    title: "Write",
    needs: "Text in the New text box.",
    what: "Adds a note to the board as a card.",
    how: "Places your text as the card body. Gemini then fills in a short title and an image prompt, and renders an illustration so the note reads like any other card.",
    clip: "write",
  },
  {
    id: "search",
    section: "New",
    title: "Search",
    needs: "A topic in the New text box. Selected cards are optional context.",
    what: "Finds real-world visual references on a topic.",
    how: "Gemini with Google Search grounding streams up to 9 results, each with a title and details. Each result is placed on the board as soon as it arrives. A grounded image search then fills in each card's reference image in parallel.",
    clip: "search",
  },
  {
    id: "visualize",
    section: "Visualize",
    title: "Abstract / Concrete",
    needs: "At least one selected card with text.",
    what: "Turns written ideas into images. Abstract gives symbolic imagery; Concrete gives realistic scenes.",
    how: "Combines the text of the selected cards into one concept. Gemini writes several diverse render prompts in the chosen style, and each prompt is rendered into its own image card.",
    clip: "visualize",
  },
  {
    id: "scan",
    section: "Scan",
    title: "Scan lenses",
    needs: "At least one selected card.",
    what: "Analyzes the selection through one of ten lenses (Emotions, Associations, Symbolism, Shape, Material, Color, Tactility, Acoustics, Interactions, Narrative) and extracts new concepts.",
    how: "When you select cards, a decision model scores how well each lens fits the selection. Each lens button shows its score as a meter. Clicking a lens makes Gemini read the cards' images and text through that lens and stream back concept cards, each with a title, a description and a rendered image.",
    clip: "scan",
  },
  {
    id: "blend",
    section: "Blend",
    title: "Blend",
    needs: "Two or more selected cards and a blending instruction.",
    what: "Combines several cards into one new image, following your instruction.",
    how: "Sends every selected card's image and text, plus your instruction, to the Gemini image model in one request. The result becomes a single new card.",
    clip: "blend",
  },
  {
    id: "design-create",
    section: "Design",
    title: "Create",
    needs: "At least one selected card for inspiration. Requirements and a brand guide are optional.",
    what: "Generates new design concepts (up to 4) inspired by the selected cards.",
    how: "Gemini reads the selection, your requirements and the optional brand guide, then proposes the number of concepts set in Count. Each concept streams in as a card with a title and description, and its image prompt is rendered.",
    clip: "create",
  },
  {
    id: "design-iterate",
    section: "Design",
    title: "Iterate",
    needs: "At least one selected design. Feedback is optional.",
    what: "Produces improved variants (up to 5) of the selected designs.",
    how: "Uses the same box as Create, but treats its text as feedback or a direction. Gemini revises the selected designs to address it and renders each variant as a new card.",
    clip: "iterate",
  },
  {
    id: "user-testing",
    section: "User testing",
    title: "Start",
    needs: "Selected design cards and a trait to judge (e.g. coziness). Segment and number of users are optional.",
    what: "Runs synthetic user testing: AI personas rank your designs on a trait and explain why.",
    how: "Gemini generates 1–5 personas for the target segment. Each persona ranks the selected designs on the trait. The board then shows a grid with one row per persona: their profile card, the designs in their ranked order and a feedback card.",
    clip: "usertest",
  },
  {
    id: "interview",
    section: "User testing",
    title: "Interview",
    needs: "Exactly one synthetic user card selected (plus any cards to discuss), and a microphone.",
    what: "Holds a live voice conversation with a synthetic user about the selected cards.",
    how: "Opens a Gemini Live voice session in the persona's matching voice, with the selected cards' images and text as context. Clicking Stop summarizes the transcript into a new findings card.",
    note: "Not recorded: this feature needs a live microphone conversation.",
  },
  {
    id: "sketch",
    section: "Media",
    title: "Sketch",
    needs: "A selected card with an image.",
    what: "Edits an image by drawing on it and describing the change.",
    how: "Opens the image in a drawing dialog. Mark the area to change and add written feedback. The annotated image and your notes go to the Gemini image-edit model, and the edited result is added as a new card next to the original.",
    clip: "sketch",
  },
  {
    id: "animate",
    section: "Media",
    title: "Animate",
    needs: "A selected card with an image, video or text.",
    what: "Generates a short video clip from the selected cards.",
    how: "The dialog lets you describe motion, camera and pacing, pick an aspect ratio and duration, and give each image a role (starting frame or reference). The request goes to the Gemini video model. A placeholder card appears right away and turns into a playable video card when the clip is ready.",
    clip: "animate",
    note: "The wait for the video has been cut from the clip.",
  },
  {
    id: "gather",
    section: "Canvas",
    title: "Gather",
    needs: "Cards on the board.",
    what: "Pulls cards that are off-screen into the current view.",
    how: "Finds every card outside the visible area and lays it out within the view. The minimap shows where everything went.",
    clip: "gather",
  },
  {
    id: "organize",
    section: "Canvas",
    title: "Organize",
    needs: "Cards on the board. Applies to the selection, or to every card when nothing is selected.",
    what: "Tidies the board into a timeline of what you made.",
    how: "Groups cards by the action that created them (e.g. one Render, one Search) and lays out one row per action, oldest at the top, cards left to right in creation order.",
    clip: "organize",
  },
  {
    id: "focus",
    section: "Canvas",
    title: "Focus",
    needs: "At least one selected card.",
    what: "Clears the view so only the selected cards remain.",
    how: "Leaves the selected cards where they are and moves every other card into a grid just beyond the right edge of the view, so they are out of the way but still on the board.",
    clip: "focus",
  },
  {
    id: "destroy",
    section: "Canvas",
    title: "Destroy",
    needs: "Cards on the board.",
    what: "Deletes every card on the board.",
    how: "Removes all cards immediately and asks for no confirmation, so use it with care.",
    clip: "destroy",
  },
];

const sections = [...new Set(entries.map((entry) => entry.section))];
// Imported as assets so the single-file build (vite-canvas-guide.config.ts) inlines them as data URIs.
const clipUrls = import.meta.glob<string>("./canvas-guide-clips/*.mp4", { eager: true, query: "?url", import: "default" });
const clipUrl = (clip: string) => clipUrls[`./canvas-guide-clips/${clip}.mp4`];
const entryFromHash = () => entries.find((entry) => `#${entry.id}` === location.hash) ?? entries[0];

const selected$ = new BehaviorSubject<GuideEntry>(entryFromHash());
fromEvent(window, "hashchange")
  .pipe(map(entryFromHash))
  .subscribe((entry) => selected$.next(entry));

const app$ = selected$.pipe(
  map(
    (active) => html`
      <main class="canvas-guide-page">
        <aside class="panel panel-list">
          <header class="list-header">
            <h1>Canvas Guide</h1>
          </header>
          <nav class="feature-list">
            ${repeat(
              sections,
              (section) => section,
              (section) => html`
                <h2 class="feature-group">${section}</h2>
                ${repeat(
                  entries.filter((entry) => entry.section === section),
                  (entry) => entry.id,
                  (entry) => html`
                    <a class="feature-item ${entry.id === active.id ? "is-active" : ""}" href="#${entry.id}">
                      ${entry.title}
                    </a>
                  `,
                )}
              `,
            )}
          </nav>
        </aside>

        <section class="panel panel-detail">
          <header class="detail-header">
            <span class="detail-section">${active.section}</span>
            <h2>${active.title}</h2>
          </header>

          ${
            active.clip
              ? html`<video
                  class="clip"
                  .src=${clipUrl(active.clip)}
                  width="1280"
                  height="760"
                  autoplay
                  muted
                  loop
                  playsinline
                  preload="auto"
                ></video>`
              : ""
          }
          ${active.note ? html`<p class="note">${active.note}</p>` : ""}

          <section class="detail-block">
            <h3>What it does</h3>
            <p>${active.what}</p>
          </section>
          <section class="detail-block">
            <h3>How it works</h3>
            <p>${active.how}</p>
          </section>
          <section class="detail-block">
            <h3>Requires</h3>
            <p>${active.needs}</p>
          </section>
        </section>
      </main>
    `,
  ),
);

app$.subscribe((template) => render(template, document.getElementById("app")!));
