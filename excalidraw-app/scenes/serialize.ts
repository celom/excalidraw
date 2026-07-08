/**
 * Shared scene-file serialization and on-disk naming, used by both the
 * archive export and the folder-sync mirror so their layouts match:
 * root scenes live at the top level, collection scenes in one folder per
 * collection, every scene as a self-contained `.excalidraw` file.
 */

import { serializeAsJSON } from "@excalidraw/excalidraw/data/json";
import { isInitializedImageElement } from "@excalidraw/element";

import type { FileId } from "@excalidraw/element/types";
import type { BinaryFiles } from "@excalidraw/excalidraw/types";

import { LocalData } from "../data/LocalData";

import { getSceneCollectionId } from "./collections";
import { scenesStorage } from "./storage";

import type { CollectionMeta, SceneId, SceneMeta } from "./storage";

export const SCENE_FILE_EXTENSION = ".excalidraw";

// generous for display purposes yet safely under the common 255-byte
// filename limit once the extension and dedupe suffix are appended
const MAX_FILENAME_LENGTH = 96;

// https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file
const WINDOWS_RESERVED_NAMES = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;

/**
 * Makes an arbitrary user string safe as a cross-platform file/folder name.
 * Falls back to "Untitled" when nothing survives.
 */
export const sanitizeFilename = (name: string): string => {
  let sanitized = name
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .trim()
    // Windows rejects trailing dots/spaces
    .replace(/[. ]+$/, "")
    .slice(0, MAX_FILENAME_LENGTH)
    .replace(/[. ]+$/, "")
    .trim();
  if (WINDOWS_RESERVED_NAMES.test(sanitized)) {
    sanitized = `${sanitized}_`;
  }
  return sanitized || "Untitled";
};

/** relative path within an archive / sync folder, e.g. "Ideas/Roadmap.excalidraw" */
export type ScenePathPlan = Map<SceneId, string>;

/**
 * Deterministic file layout for a set of scenes: sanitized collection
 * folders + sanitized scene filenames, deduped within each folder by
 * appending " (2)", " (3)"… Root scenes sit at the top level.
 */
export const buildScenePaths = (
  scenes: readonly SceneMeta[],
  collections: readonly CollectionMeta[],
): ScenePathPlan => {
  // two collections may sanitize to the same folder name — dedupe those too
  const folderNames = new Set<string>();
  const folderByCollectionId = new Map<string, string>();
  for (const collection of collections) {
    const base = sanitizeFilename(collection.name);
    let folder = base;
    let counter = 2;
    while (folderNames.has(folder)) {
      folder = `${base} (${counter})`;
      counter++;
    }
    folderNames.add(folder);
    folderByCollectionId.set(collection.id, folder);
  }

  const usedNamesByFolder = new Map<string, Set<string>>();
  const paths: ScenePathPlan = new Map();
  for (const scene of scenes) {
    const collectionId = getSceneCollectionId(scene, [...collections]);
    const folder = collectionId
      ? folderByCollectionId.get(collectionId) ?? ""
      : "";
    let usedNames = usedNamesByFolder.get(folder);
    if (!usedNames) {
      usedNames = new Set();
      usedNamesByFolder.set(folder, usedNames);
    }
    const base = sanitizeFilename(scene.name);
    let filename = base;
    let counter = 2;
    while (usedNames.has(filename.toLowerCase())) {
      filename = `${base} (${counter})`;
      counter++;
    }
    usedNames.add(filename.toLowerCase());
    paths.set(
      scene.id,
      `${folder ? `${folder}/` : ""}${filename}${SCENE_FILE_EXTENSION}`,
    );
  }
  return paths;
};

/**
 * Loads the persisted scene blob and its image files from IDB and produces
 * a self-contained `.excalidraw` JSON string (images embedded as dataURLs).
 * A never-saved scene (no keys written yet) serializes as an empty scene.
 */
export const serializeSceneToString = async (
  meta: SceneMeta,
): Promise<string> => {
  const data = await scenesStorage.loadScene(meta.id);
  const elements = data?.elements ?? [];

  const fileIds = elements.reduce((acc, element) => {
    if (!element.isDeleted && isInitializedImageElement(element)) {
      acc.push(element.fileId);
    }
    return acc;
  }, [] as FileId[]);

  const files: BinaryFiles = {};
  if (fileIds.length) {
    const { loadedFiles } = await LocalData.fileStorage.getFiles(fileIds);
    for (const file of loadedFiles) {
      files[file.id] = file;
    }
  }

  // the scene name travels in the manifest and the filename — appState.name
  // is stripped by the export serializer (`name: { export: false }`)
  return serializeAsJSON(elements, data?.appState ?? {}, files, "local");
};
