import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { CanvasItem } from "../canvas/canvas.component";

export interface ApiKeys {
  openai?: string;
  together?: string;
  gemini?: string;
}

const STORAGE_KEY = "moodboard-ai-api-keys";

export function saveApiKeys(keys: ApiKeys): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

export function loadApiKeys(): ApiKeys {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : {};
}

export function clearApiKeys(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// IndexedDB schema
interface MoodboardDB extends DBSchema {
  items: {
    key: string;
    value: CanvasItem;
  };
  "material-page": {
    key: string;
    value: MaterialPageState;
  };
}

const DB_NAME = "moodboard-db";
const DB_VERSION = 2; // Bump version to add store

let dbPromise: Promise<IDBPDatabase<MoodboardDB>> | null = null;

function getDB(): Promise<IDBPDatabase<MoodboardDB>> {
  if (!dbPromise) {
    dbPromise = openDB<MoodboardDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (!db.objectStoreNames.contains("items")) {
          db.createObjectStore("items", { keyPath: "id" });
        }
        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains("material-page")) {
            db.createObjectStore("material-page");
          }
        }
      },
    });
  }
  return dbPromise;
}

export async function saveCanvasItems(items: CanvasItem[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("items", "readwrite");

  // Clear existing items
  await tx.store.clear();

  // Save all items
  await Promise.all(items.map((item) => tx.store.put(item)));

  await tx.done;
}

export async function loadCanvasItems(): Promise<CanvasItem[]> {
  try {
    const db = await getDB();
    return await db.getAll("items");
  } catch (error) {
    console.error("Failed to load canvas items:", error);
    return [];
  }
}

export async function clearCanvasItems(): Promise<void> {
  const db = await getDB();
  await db.clear("items");
}

// Material page persistence
export interface MaterialPageState {
  selectedComponents: {
    shape: string | null;
    cap: string | null;
    material: string | null;
    surface: string | null;
  };
  capColor: string;
  previews: Array<{
    type: "image" | "video";
    prompt: string;
    model: string;
    width?: string;
    height?: string;
    aspectRatio?: string;
    startFrame?: string;
    componentIds?: number[];
  }>;
}

const MATERIAL_STATE_KEY = "material-page-state";

export async function saveMaterialPageState(state: MaterialPageState): Promise<void> {
  const db = await getDB();
  await db.put("material-page", state, MATERIAL_STATE_KEY);
}

export async function loadMaterialPageState(): Promise<MaterialPageState | null> {
  try {
    const db = await getDB();
    const state = await db.get("material-page", MATERIAL_STATE_KEY);
    return state || null;
  } catch (error) {
    console.error("Failed to load material page state:", error);
    return null;
  }
}
