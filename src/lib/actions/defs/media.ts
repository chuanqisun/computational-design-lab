import { EMPTY, catchError, defer, finalize, last, map, mergeMap, of, switchMap, tap } from "rxjs";
import type { CanvasItem } from "../../../components/canvas/canvas.component";
import {
  buildAnimateMacro,
  combineAnimateInstruction,
  generateAnimatedVideo,
  getAnimatePreflightErrors,
  prepareAnimateContents,
  resolveAnimateDefaultRoles,
  resolveAnimateInputs,
  type AnimateAspectRatio,
  type AnimateDuration,
  type AnimateImageRole,
  type AnimateTask,
} from "../../../components/context-tray/llm/animate";
import { resolveInterviewSelection, summarizeInterview$, type InterviewTurn } from "../../../components/context-tray/llm/interview";
import { textInterview$ } from "../../../components/context-tray/llm/interview-text";
import { generatePersonas$, rankDesigns$, type RankingResult } from "../../../components/context-tray/llm/synthetic-users";
import {
  buildGridConfig,
  getFeedbackPosition,
  getHeaderItemPosition,
  getPersonaPosition,
  getRankedItemPosition,
} from "../../../components/context-tray/tools/user-testing-layout";
import { ActionError, type ActionDef } from "../types";

const cardIdsParam = {
  type: "array" as const,
  items: { type: "string" as const },
  description: "Input card ids. Defaults to the current selection.",
};

export const animate: ActionDef<{
  cardIds?: string[];
  instruction?: string;
  aspectRatio?: AnimateAspectRatio;
  duration?: AnimateDuration;
  task?: AnimateTask;
  roles?: { imageId: string; role: AnimateImageRole }[];
  _annotatedImages?: ReadonlyMap<string, HTMLCanvasElement>;
  _annotatedImageIds?: ReadonlySet<string>;
}> = {
  name: "animate",
  description:
    "Generate a short video card from the input cards (video, images and text). Images are numbered Image1, Image2… in input order; roles can mark one as 'starting-frame' or others as 'reference'. Slow: returns immediately with a pending card; use wait_for_idle to get the result.",
  parameters: {
    type: "object",
    properties: {
      cardIds: cardIdsParam,
      instruction: { type: "string", description: "Motion, camera, pacing and audio direction." },
      aspectRatio: { type: "string", enum: ["default", "16:9", "9:16"] },
      duration: { type: "string", enum: ["default", "4s", "8s", "15s"] },
      task: {
        type: "string",
        enum: ["default", "text_to_video", "image_to_video", "reference_to_video", "edit", "extend"],
      },
      roles: {
        type: "array",
        description: "Role per image id (Image1, Image2… in input order). At most one starting-frame.",
        items: {
          type: "object",
          properties: {
            imageId: { type: "string" },
            role: { type: "string", enum: ["auto", "starting-frame", "reference"] },
          },
          required: ["imageId", "role"],
        },
      },
    },
  },
  humanArgs: ["_annotatedImages", "_annotatedImageIds"],
  needsApiKey: true,
  async: true,
  isAvailable: ({ targets }) =>
    targets.some((card) => card.kind !== "empty") ? true : { reason: "Select a card with video, image, or text content" },
  run: (args, ctx) => {
    const { inputs } = resolveAnimateInputs(ctx.targets);
    const roles = {
      ...resolveAnimateDefaultRoles(inputs),
      ...Object.fromEntries((args.roles ?? []).map((entry) => [entry.imageId, entry.role])),
    };
    const options = {
      duration: args.duration ?? "default",
      task: args.task ?? "default",
      roles,
      annotatedImageIds: args._annotatedImageIds ?? new Set<string>(),
    };
    const errors = getAnimatePreflightErrors(inputs, !!ctx.apiKey, options);
    if (errors.length) throw new ActionError("invalid_args", errors.join(" "));

    const macro = buildAnimateMacro(inputs, roles, options.annotatedImageIds);
    const instruction = combineAnimateInstruction(macro, args.instruction ?? "") || "Animate the selected content.";

    // Preparing inputs can fail (e.g. tainted media); do it before returning so the caller sees the error.
    return defer(() => prepareAnimateContents(inputs, args._annotatedImages ?? new Map(), roles)).pipe(
      map((contents) => {
        const [pos] = ctx.place(1);
        const id = ctx.newId("animate-result");
        ctx.addCards([
          {
            id,
            x: pos.x,
            y: pos.y,
            width: 200,
            height: 300,
            zIndex: pos.z,
            isSelected: false,
            metadata: { pending: "video" },
          },
        ]);

        const removePlaceholder = () => {
          const card = ctx.items$.value.find((item) => item.id === id);
          if (card && !card.videoSrc) ctx.items$.next(ctx.items$.value.filter((item) => item.id !== id));
        };

        ctx.background(
          generateAnimatedVideo({
            contents,
            instruction,
            aspectRatio: args.aspectRatio ?? "default",
            duration: options.duration,
            task: options.task,
            apiKey: ctx.apiKey,
          }).pipe(
            tap((video) =>
              ctx.updateCard(id, {
                videoSrc: `data:${video.mimeType};base64,${video.data}`,
                videoMimeType: video.mimeType,
                metadata: { pending: undefined },
              }),
            ),
            switchMap(() => ctx.settle$([id])),
            catchError((error) => {
              console.error("Animate failed", error);
              return EMPTY;
            }),
            finalize(removePlaceholder),
          ),
        );

        return { summary: "Started video generation", created: [id], pending: [id] };
      }),
    );
  },
  log: "record",
  humanEntry: "tray:Media/Animate",
  agent: "native",
};

export const runUserTesting: ActionDef<{ trait: string; segment?: string; numUsers?: number; cardIds?: string[] }> = {
  name: "run_user_testing",
  description:
    "Run synthetic user testing on the input designs: generate personas for a segment, have each rank the designs on a trait, and lay out persona, ranked copies and feedback cards in a grid. Rankings are returned in data.",
  parameters: {
    type: "object",
    properties: {
      trait: { type: "string", description: "e.g. playfulness" },
      segment: { type: "string" },
      numUsers: { type: "integer", minimum: 1, maximum: 5 },
      cardIds: cardIdsParam,
    },
    required: ["trait"],
  },
  needsApiKey: true,
  isAvailable: ({ targets }) => (targets.length > 0 ? true : { reason: "Select at least one design card" }),
  run: (args, ctx) => {
    const trait = args.trait.trim();
    if (!trait) throw new ActionError("invalid_args", "trait must not be empty");
    const numUsers = args.numUsers ?? 3;
    const selectedItems = ctx.targets;
    const maxZ = ctx.items$.value.reduce((max, item) => Math.max(max, item.zIndex ?? 0), 0);
    const origin = { x: Math.min(...selectedItems.map((i) => i.x)), y: Math.min(...selectedItems.map((i) => i.y)) };
    const config = buildGridConfig(selectedItems, numUsers, origin, { colGap: 20, rowGap: 20 });

    ctx.items$.next(
      ctx.items$.value.map((item) => {
        const index = selectedItems.findIndex((s) => s.id === item.id);
        if (index < 0) return item;
        const pos = getHeaderItemPosition(index, config);
        return { ...item, x: pos.x, y: pos.y, width: pos.width, height: pos.height };
      }),
    );

    const created: string[] = [];
    const rankings: { persona: string; rankedItemIds: string[]; feedback: string }[] = [];

    return generatePersonas$({ trait, segment: args.segment || "All", numUsers, apiKey: ctx.apiKey }).pipe(
      mergeMap((persona, userIndex) => {
        const personaPos = getPersonaPosition(userIndex, config);
        const personaId = ctx.newId("persona");
        created.push(personaId);
        ctx.addCards([
          {
            id: personaId,
            title: persona.name,
            body: `${persona.occupation}, age ${persona.age}\nVoice: ${persona.voiceName}\n${persona.description}`,
            x: personaPos.x,
            y: personaPos.y,
            width: personaPos.width,
            height: personaPos.height,
            zIndex: maxZ + 1 + userIndex,
            isSelected: false,
            metadata: { kind: "synthetic-user", gender: persona.gender, voiceName: persona.voiceName, persona },
          },
        ]);

        return rankDesigns$({ persona, items: selectedItems, trait, apiKey: ctx.apiKey }).pipe(
          tap((ranking: RankingResult) => {
            rankings.push({ persona: persona.name, rankedItemIds: ranking.rankedItemIds, feedback: ranking.feedback });
            const newCards: CanvasItem[] = [];
            ranking.rankedItemIds.forEach((itemId, rankPosition) => {
              const original = selectedItems.find((i) => i.id === itemId);
              if (!original) return;
              const pos = getRankedItemPosition(userIndex, rankPosition, config);
              newCards.push({
                id: ctx.newId("ranked"),
                title: original.title,
                body: original.body,
                imageSrc: original.imageSrc,
                imagePrompt: original.imagePrompt,
                x: pos.x,
                y: pos.y,
                width: pos.width,
                height: pos.height,
                zIndex: maxZ + 10 + userIndex * 10 + rankPosition,
                isSelected: false,
                metadata: { kind: "ranked-copy", sourceId: original.id, rank: rankPosition + 1, persona: persona.name },
              });
            });
            const feedbackPos = getFeedbackPosition(userIndex, config);
            newCards.push({
              id: ctx.newId("feedback"),
              title: `${persona.name}'s Feedback`,
              body: ranking.feedback,
              x: feedbackPos.x,
              y: feedbackPos.y,
              width: feedbackPos.width,
              height: feedbackPos.height,
              zIndex: maxZ + 10 + userIndex * 10 + config.numItems,
              isSelected: false,
              metadata: { kind: "feedback", persona: persona.name },
            });
            created.push(...newCards.map((card) => card.id));
            ctx.addCards(newCards);
          }),
        );
      }),
      last(undefined, null),
      // Persona and feedback cards get their images through the same fill/render as every other card.
      switchMap(() => ctx.settle$([...created])),
      map(() => ({
        summary: `User testing on "${trait}" with ${rankings.length} persona(s)`,
        created: [...created],
        updated: selectedItems.map((item) => item.id),
        data: { rankings },
      })),
    );
  },
  log: "record",
  humanEntry: "tray:User testing/Start",
  agent: "native",
};

export const interviewPersona: ActionDef<{ cardIds?: string[]; questions?: string[]; _transcript?: InterviewTurn[] }> = {
  name: "interview_persona",
  description:
    "Interview one synthetic-user persona card about the other input cards (text Q&A), then add an interview summary card. Input must contain exactly one persona card (tag synthetic-user).",
  parameters: {
    type: "object",
    properties: {
      cardIds: cardIdsParam,
      questions: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 8 },
    },
  },
  humanArgs: ["_transcript"],
  needsApiKey: true,
  isAvailable: ({ targets }) =>
    targets.filter((card) => card.tag === "synthetic-user" || card.id.startsWith("persona-")).length === 1
      ? true
      : { reason: "Select exactly one synthetic user card (plus any cards to discuss)" },
  run: (args, ctx) => {
    const selection = resolveInterviewSelection(ctx.targets);
    if (!selection.personaCard) throw new ActionError("unavailable", "Exactly one persona card is required");
    const personaCard = selection.personaCard;
    const contextItems = selection.contextItems;

    const transcript$ = args._transcript
      ? of(args._transcript)
      : args.questions?.length
        ? textInterview$({ personaCard, contextItems, questions: args.questions, apiKey: ctx.apiKey })
        : (() => {
            throw new ActionError("invalid_args", "questions are required");
          })();

    const [pos] = ctx.place(1, [personaCard.id]);
    return transcript$.pipe(
      switchMap((transcript) => {
        if (!transcript.length) throw new ActionError("action_failed", "No conversation recorded to summarize.");
        return summarizeInterview$({ personaCard, contextItems, transcript, apiKey: ctx.apiKey }).pipe(
          map((summary) => ({ summary, transcript })),
        );
      }),
      map(({ summary, transcript }) => {
        const id = ctx.newId("interview-summary");
        ctx.addCards([
          {
            id,
            title: summary.title,
            body: summary.body,
            x: pos.x,
            y: pos.y,
            width: 200,
            height: 300,
            zIndex: pos.z,
            isSelected: false,
            metadata: {
              kind: "interview-summary",
              personaCardId: personaCard.id,
              personaName: personaCard.title || "Synthetic User",
            },
          },
        ]);
        return { id, title: summary.title, transcript };
      }),
      switchMap(({ id, title, transcript }) =>
        ctx.settle$([id]).pipe(
          map(() => ({
            summary: `Interviewed ${personaCard.title || "persona"}: ${title}`,
            created: [id],
            data: { transcript },
          })),
        ),
      ),
    );
  },
  log: "record",
  humanEntry: "tray:User testing/Interview",
  agent: "equivalent",
};

export const mediaActions = [animate, runUserTesting, interviewPersona];
