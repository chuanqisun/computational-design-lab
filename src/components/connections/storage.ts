import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { CanvasItem } from "../canvas/canvas.component";

export interface ApiKeys {
  gemini?: string;
}

const STORAGE_KEY = "moodboard-ai-api-keys";
const VIEWPORT_KEY = "moodboard-viewport-center";

export function saveApiKeys(keys: ApiKeys): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

export function loadApiKeys(): ApiKeys {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : {};
}

export interface ViewportCenter {
  centerX: number;
  centerY: number;
}

export function saveViewportCenter(center: ViewportCenter): void {
  localStorage.setItem(VIEWPORT_KEY, JSON.stringify(center));
}

export function loadViewportCenter(): ViewportCenter | null {
  const stored = localStorage.getItem(VIEWPORT_KEY);
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored);
    if (typeof parsed.centerX === "number" && typeof parsed.centerY === "number") return parsed;
  } catch {}
  return null;
}

// IndexedDB schema
interface MoodboardDB extends DBSchema {
  items: {
    key: string;
    value: CanvasItem[];
  };
}

const DB_NAME = "moodboard-db";
const DB_VERSION = 3;
const CANVAS_ITEMS_KEY = "canvas-items";

let dbPromise: Promise<IDBPDatabase<MoodboardDB>> | null = null;

function getDB(): Promise<IDBPDatabase<MoodboardDB>> {
  if (!dbPromise) {
    dbPromise = openDB<MoodboardDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 3) {
          if (db.objectStoreNames.contains("items")) {
            db.deleteObjectStore("items");
          }
          db.createObjectStore("items");
        }
      },
    });
  }
  return dbPromise;
}

export async function saveCanvasItems(items: CanvasItem[]): Promise<void> {
  const db = await getDB();
  await db.put("items", items, CANVAS_ITEMS_KEY);
}

export async function loadCanvasItems(): Promise<CanvasItem[]> {
  try {
    const db = await getDB();
    const items = await db.get("items", CANVAS_ITEMS_KEY);
    return items || [];
  } catch (error) {
    console.error("Failed to load canvas items:", error);
    return [];
  }
}
