import { appJotaiStore, atom } from "../app-jotai";
import { STORAGE_KEYS } from "../app_constants";
import { updateBrowserStateVersion } from "../data/tabSync";

import { getOrCreateScenesIndex, saveIndexSync } from "./storage";

import type { CollectionId, SceneId, ScenesIndex } from "./storage";

/** in-memory mirror of the persisted scenes index (runs the legacy-scene
 * migration on first evaluation) */
export const scenesIndexAtom = atom<ScenesIndex>(getOrCreateScenesIndex());

// safe sentinel — real collection ids are UUIDs
export const ROOT_COLLECTION_ID = "root" as const;
export type OpenCollectionId = CollectionId | typeof ROOT_COLLECTION_ID;

/** which collection dashboard overlay is open (null = closed) */
export const openCollectionIdAtom = atom<OpenCollectionId | null>(null);

export const getScenesIndex = (): ScenesIndex => {
  return appJotaiStore.get(scenesIndexAtom) ?? getOrCreateScenesIndex();
};

export const getActiveSceneId = (): SceneId => {
  return getScenesIndex().activeSceneId;
};

/** write-through: updates the atom and persists the index */
export const setScenesIndex = (index: ScenesIndex) => {
  appJotaiStore.set(scenesIndexAtom, index);
  try {
    saveIndexSync(index);
    // notify other tabs (they follow the active scene / index changes)
    updateBrowserStateVersion(STORAGE_KEYS.VERSION_DATA_STATE);
  } catch (error: any) {
    // tiny write — if this fails the scene save path is failing too and
    // surfaces the quota banner
    console.error(error);
  }
};

/** re-reads the index persisted by another tab into the atom (no
 * write-through) */
export const refreshScenesIndexFromStorage = (): ScenesIndex => {
  const index = getOrCreateScenesIndex();
  appJotaiStore.set(scenesIndexAtom, index);
  return index;
};
