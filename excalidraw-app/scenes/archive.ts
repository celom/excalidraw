/**
 * Collection archive format — pure manifest/zip-layout logic (no DOM, no
 * storage access). An archive is a zip of self-contained `.excalidraw`
 * files (one per scene, foldered by collection, root scenes at the top
 * level) plus a `manifest.json` carrying ids/names/order so a workspace
 * can be restored losslessly.
 */

import { getExportSource } from "@excalidraw/common";

import { getSceneCollectionId } from "./collections";
import { SCENE_FILE_EXTENSION } from "./serialize";
import { newSceneId } from "./storage";

import type { ScenePathPlan } from "./serialize";
import type {
  CollectionId,
  CollectionMeta,
  SceneId,
  SceneMeta,
  ScenesIndex,
} from "./storage";

export const ARCHIVE_MANIFEST_FILENAME = "manifest.json";
export const ARCHIVE_TYPE = "excalidraw-collection-archive";
export const ARCHIVE_MANIFEST_VERSION = 1;

export type ArchiveSceneEntry = {
  id: SceneId;
  name: string;
  createdAt: number;
  updatedAt: number;
  /** null ≡ root "Dashboard" */
  collectionId: CollectionId | null;
  /** zip entry path, e.g. "Ideas/Roadmap.excalidraw" */
  path: string;
};

export type ArchiveManifest = {
  type: typeof ARCHIVE_TYPE;
  version: typeof ARCHIVE_MANIFEST_VERSION;
  source: string;
  exportedAt: number;
  scope: "all" | "collection";
  /** informational only — ignored on import */
  activeSceneId?: SceneId;
  collections: CollectionMeta[];
  /** array order = index (display) order */
  scenes: ArchiveSceneEntry[];
};

export const buildManifest = (opts: {
  scenes: readonly SceneMeta[];
  collections: readonly CollectionMeta[];
  scope: "all" | "collection";
  activeSceneId?: SceneId;
  paths: ScenePathPlan;
}): ArchiveManifest => {
  return {
    type: ARCHIVE_TYPE,
    version: ARCHIVE_MANIFEST_VERSION,
    source: getExportSource(),
    exportedAt: Date.now(),
    scope: opts.scope,
    ...(opts.activeSceneId ? { activeSceneId: opts.activeSceneId } : {}),
    collections: [...opts.collections],
    scenes: opts.scenes.map((scene) => ({
      id: scene.id,
      name: scene.name,
      createdAt: scene.createdAt,
      updatedAt: scene.updatedAt,
      // normalize dangling refs the same way the path plan does
      collectionId: getSceneCollectionId(scene, [...opts.collections]),
      path: opts.paths.get(scene.id)!,
    })),
  };
};

const isValidSceneEntry = (entry: any): entry is ArchiveSceneEntry =>
  entry &&
  typeof entry.id === "string" &&
  typeof entry.name === "string" &&
  typeof entry.createdAt === "number" &&
  typeof entry.updatedAt === "number" &&
  (entry.collectionId === null || typeof entry.collectionId === "string") &&
  typeof entry.path === "string";

const isValidCollectionEntry = (entry: any): entry is CollectionMeta =>
  entry &&
  typeof entry.id === "string" &&
  typeof entry.name === "string" &&
  typeof entry.createdAt === "number";

/** accepts only the current manifest version — anything else returns null
 * so callers fall back to the manifest-less entry plan */
export const parseManifest = (json: unknown): ArchiveManifest | null => {
  const data = json as any;
  if (
    !data ||
    data.type !== ARCHIVE_TYPE ||
    data.version !== ARCHIVE_MANIFEST_VERSION ||
    (data.scope !== "all" && data.scope !== "collection") ||
    !Array.isArray(data.scenes) ||
    !data.scenes.every(isValidSceneEntry) ||
    !Array.isArray(data.collections) ||
    !data.collections.every(isValidCollectionEntry)
  ) {
    return null;
  }
  return data as ArchiveManifest;
};

/**
 * Synthesizes a manifest for a zip without (a usable) `manifest.json`:
 * every `.excalidraw` entry becomes a new scene named after the file, and
 * each top-level folder becomes a collection (deeper nesting collapses
 * into that collection). Fresh ids, so importing never conflicts.
 */
export const planFromEntries = (
  entryPaths: readonly string[],
  now: number = Date.now(),
): ArchiveManifest => {
  const collectionsByFolder = new Map<string, CollectionMeta>();
  const scenes: ArchiveSceneEntry[] = [];

  for (const path of entryPaths) {
    if (
      path.endsWith("/") ||
      !path.toLowerCase().endsWith(SCENE_FILE_EXTENSION)
    ) {
      continue;
    }
    const segments = path.split("/").filter(Boolean);
    const filename = segments[segments.length - 1];
    const folder = segments.length > 1 ? segments[0] : null;

    let collection: CollectionMeta | undefined;
    if (folder) {
      collection = collectionsByFolder.get(folder);
      if (!collection) {
        collection = { id: newSceneId(), name: folder, createdAt: now };
        collectionsByFolder.set(folder, collection);
      }
    }

    scenes.push({
      id: newSceneId(),
      name:
        filename.slice(0, -SCENE_FILE_EXTENSION.length).trim() || "Untitled",
      createdAt: now,
      updatedAt: now,
      collectionId: collection?.id ?? null,
      path,
    });
  }

  return {
    type: ARCHIVE_TYPE,
    version: ARCHIVE_MANIFEST_VERSION,
    source: "",
    exportedAt: now,
    scope: "all",
    collections: [...collectionsByFolder.values()],
    scenes,
  };
};

export const detectConflicts = (
  manifest: ArchiveManifest,
  index: ScenesIndex,
): { sceneConflicts: SceneId[]; collectionConflicts: CollectionId[] } => {
  const sceneIds = new Set(index.scenes.map((scene) => scene.id));
  const collectionIds = new Set((index.collections ?? []).map((c) => c.id));
  return {
    sceneConflicts: manifest.scenes
      .map((scene) => scene.id)
      .filter((id) => sceneIds.has(id)),
    collectionConflicts: manifest.collections
      .map((collection) => collection.id)
      .filter((id) => collectionIds.has(id)),
  };
};
