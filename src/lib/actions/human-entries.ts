/**
 * Parity manifest: every human entry point in the canvas UI, mapped to the action it dispatches.
 * Entries with `{ none }` have no board effect (viewport, downloads, driver meta-controls) and are not actions.
 * A new UI capability must be added here AND ship as a registered action, or the parity test fails.
 */
export const HUMAN_ENTRIES: Record<string, string | { none: string }> = {
  // Perception (agent counterpart: perception actions)
  "view:screen": "observe",
  "view:progress": "wait_for_idle",
  "dialog:open": "view_cards",

  // Canvas gestures and shortcuts
  "canvas:select": "select_cards",
  "canvas:marquee": "select_cards",
  "canvas:select-all": "select_cards",
  "canvas:drag": "move_cards",
  "canvas:delete": "delete_cards",
  "canvas:cut": "delete_cards",
  "canvas:copy-paste": "duplicate_cards",
  "canvas:paste-text": "add_card",
  "canvas:paste-media": "add_media",
  "canvas:pan": { none: "Viewport navigation only; mirrored into UiState.viewport" },

  // Card dialog
  "dialog:edit": "edit_card",
  "dialog:Regenerate": "regenerate_image",
  "dialog:Download": { none: "Saves an image file to the user's disk; no board effect" },

  // Context tray
  "tray:New/Capture": "add_media",
  "tray:New/Render": "render_image",
  "tray:New/Write": "add_card",
  "tray:New/Search": "search_references",
  "tray:Visualize": "visualize_concept",
  "tray:Scan": "scan_concept",
  "tray:Blend": "blend_images",
  "tray:Design/Create": "design_concepts",
  "tray:User testing/Start": "run_user_testing",
  "tray:User testing/Interview": "interview_persona",
  "tray:Design/Iterate": "iterate_designs",
  "tray:Media/Sketch": "edit_image",
  "tray:Media/Animate": "animate",
  "tray:Canvas/Gather": "move_cards",
  "tray:Canvas/Organize": "move_cards",
  "tray:Canvas/Focus": "move_cards",
  "tray:Canvas/Destroy": "clear_canvas",
  "tray:Export": "export_cards",

  // Driver meta-controls (Workflow tray section + dialogs): drive the agent, not the board
  "meta:workflow-select": { none: "Chooses which workflow (AGENTS.md) the AI follows" },
  "meta:workflow-run": { none: "Starts/stops the AI run" },
  "meta:workflow-editor": { none: "Creates, edits, imports and deletes workflows" },
  "meta:trace-dialog": { none: "Reviews the trace and what the AI perceives" },
  "meta:trace-clear": { none: "Clears the recorded trace" },
  "meta:stop": { none: "Cancels all running work" },
  "meta:setup": { none: "API key configuration" },
};
