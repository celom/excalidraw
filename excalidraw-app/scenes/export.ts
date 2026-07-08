/**
 * Archive export: packs the whole workspace (or one collection) into a zip
 * of self-contained `.excalidraw` files + `manifest.json` (see archive.ts
 * for the format).
 */

import { strToU8, zipSync } from "fflate";

import { LocalData } from "../data/LocalData";

import { ARCHIVE_MANIFEST_FILENAME, buildManifest } from "./archive";
import { getCollections } from "./collections";
import { getSceneCollectionId } from "./collections";
import { downloadBlob } from "./fileio";
import {
  buildScenePaths,
  sanitizeFilename,
  serializeSceneToString,
} from "./serialize";
import { getScenesIndex } from "./state";

import type { CollectionId } from "./storage";

export type ExportScope = CollectionId | "all";

// re-wrap because TextEncoder may return a foreign-realm Uint8Array (jsdom)
// that fails fflate's instanceof check and gets treated as a directory
const toBytes = (data: string) => new Uint8Array(strToU8(data));

/** builds the archive bytes — separated from the download for testability */
export const buildArchive = async (
  scope: ExportScope,
): Promise<{ filename: string; bytes: Uint8Array }> => {
  // make sure the active scene's pending debounced save is included,
  // then read the index (the flush may bump its meta)
  LocalData.flushSave();
  const index = getScenesIndex();
  const allCollections = getCollections(index);

  const collections =
    scope === "all"
      ? allCollections
      : allCollections.filter((collection) => collection.id === scope);
  const scenes =
    scope === "all"
      ? index.scenes
      : index.scenes.filter(
          (scene) => getSceneCollectionId(scene, allCollections) === scope,
        );

  const paths = buildScenePaths(scenes, collections);
  const manifest = buildManifest({
    scenes,
    collections,
    scope: scope === "all" ? "all" : "collection",
    ...(scope === "all" ? { activeSceneId: index.activeSceneId } : {}),
    paths,
  });

  const entries: Record<string, Uint8Array> = {
    [ARCHIVE_MANIFEST_FILENAME]: toBytes(JSON.stringify(manifest, null, 2)),
  };
  for (const scene of scenes) {
    entries[paths.get(scene.id)!] = toBytes(
      await serializeSceneToString(scene),
    );
  }

  const scopeName =
    scope === "all" ? "excalidraw-workspace" : collections[0]?.name ?? "";
  const date = new Date().toISOString().slice(0, 10);
  return {
    filename: `${sanitizeFilename(scopeName)} ${date}.zip`,
    // sync zip is plenty for localStorage-sized workspaces (≤ a few MB) and
    // avoids fflate's worker machinery
    bytes: zipSync(entries),
  };
};

export const exportScenesArchive = async (scope: ExportScope) => {
  const { filename, bytes } = await buildArchive(scope);
  await downloadBlob(
    new Blob([bytes as BlobPart], { type: "application/zip" }),
    filename,
  );
};
