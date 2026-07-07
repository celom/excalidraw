import { appJotaiStore, atom } from "../app-jotai";
import { STORAGE_KEYS } from "../app_constants";
import { updateBrowserStateVersion } from "../data/tabSync";

import { getOrCreateDocumentsIndex, saveIndexSync } from "./storage";

import type { CollectionId, DocumentId, DocumentsIndex } from "./storage";

/** in-memory mirror of the persisted documents index (runs the legacy-scene
 * migration on first evaluation) */
export const documentsIndexAtom = atom<DocumentsIndex>(
  getOrCreateDocumentsIndex(),
);

// safe sentinel — real collection ids are UUIDs
export const ROOT_COLLECTION_ID = "root" as const;
export type OpenCollectionId = CollectionId | typeof ROOT_COLLECTION_ID;

/** which collection dashboard overlay is open (null = closed) */
export const openCollectionIdAtom = atom<OpenCollectionId | null>(null);

export const getDocumentsIndex = (): DocumentsIndex => {
  return appJotaiStore.get(documentsIndexAtom) ?? getOrCreateDocumentsIndex();
};

export const getActiveDocumentId = (): DocumentId => {
  return getDocumentsIndex().activeDocumentId;
};

/** write-through: updates the atom and persists the index */
export const setDocumentsIndex = (index: DocumentsIndex) => {
  appJotaiStore.set(documentsIndexAtom, index);
  try {
    saveIndexSync(index);
    // notify other tabs (they follow the active document / index changes)
    updateBrowserStateVersion(STORAGE_KEYS.VERSION_DATA_STATE);
  } catch (error: any) {
    // tiny write — if this fails the scene save path is failing too and
    // surfaces the quota banner
    console.error(error);
  }
};

/** re-reads the index persisted by another tab into the atom (no
 * write-through) */
export const refreshDocumentsIndexFromStorage = (): DocumentsIndex => {
  const index = getOrCreateDocumentsIndex();
  appJotaiStore.set(documentsIndexAtom, index);
  return index;
};
