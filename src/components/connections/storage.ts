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
}

const DB_NAME = "moodboard-db";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<MoodboardDB>> | null = null;

function getDB(): Promise<IDBPDatabase<MoodboardDB>> {
  if (!dbPromise) {
    dbPromise = openDB<MoodboardDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("items")) {
          db.createObjectStore("items", { keyPath: "id" });
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
  }>;
}

const MATERIAL_STATE_KEY = "material-page-state";

export async function saveMaterialPageState(state: MaterialPageState): Promise<void> {
  localStorage.setItem(MATERIAL_STATE_KEY, JSON.stringify(state));
}

export function loadMaterialPageState(): MaterialPageState | null {
  const stored = localStorage.getItem(MATERIAL_STATE_KEY);
  return stored ? JSON.parse(stored) : null;
}
