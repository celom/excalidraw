/**
 * Collection-level operations (create / rename / delete / assign).
 *
 * Collections are pure index metadata — none of these touch the scene, so
 * there's no collab gating and no save pausing. Persistence and cross-tab
 * notification are handled by `setDocumentsIndex`'s write-through.
 */

import { getDocumentsIndex, setDocumentsIndex } from "./state";
import { newDocumentId } from "./storage";

import type {
  CollectionId,
  CollectionMeta,
  DocumentId,
  DocumentMeta,
  DocumentsIndex,
} from "./storage";

/** dataTransfer type for document drags */
export const DOCUMENT_DRAG_MIME = "application/x-excalidraw-document-id";

export const getCollections = (index: DocumentsIndex): CollectionMeta[] =>
  index.collections ?? [];

/** dangling refs (e.g. collection deleted by another tab) resolve to root */
export const getDocumentCollectionId = (
  doc: DocumentMeta,
  collections: CollectionMeta[],
): CollectionId | null =>
  doc.collectionId && collections.some((c) => c.id === doc.collectionId)
    ? doc.collectionId
    : null;

const nextCollectionName = (index: DocumentsIndex) => {
  const names = new Set(getCollections(index).map((c) => c.name));
  if (!names.has("New collection")) {
    return "New collection";
  }
  let counter = 2;
  while (names.has(`New collection ${counter}`)) {
    counter++;
  }
  return `New collection ${counter}`;
};

/** returns the new meta so the caller can start an inline rename */
export const createCollection = (): CollectionMeta => {
  const index = getDocumentsIndex();
  const meta: CollectionMeta = {
    id: newDocumentId(),
    name: nextCollectionName(index),
    createdAt: Date.now(),
  };
  setDocumentsIndex({
    ...index,
    collections: [...getCollections(index), meta],
  });
  return meta;
};

export const renameCollection = (id: CollectionId, name: string) => {
  const trimmedName = name.trim();
  const index = getDocumentsIndex();
  if (!trimmedName || !getCollections(index).some((c) => c.id === id)) {
    return;
  }
  setDocumentsIndex({
    ...index,
    collections: getCollections(index).map((c) =>
      c.id === id ? { ...c, name: trimmedName } : c,
    ),
  });
};

/** contained documents move back to the root "Dashboard" */
export const deleteCollection = (id: CollectionId) => {
  const index = getDocumentsIndex();
  if (!getCollections(index).some((c) => c.id === id)) {
    return;
  }
  setDocumentsIndex({
    ...index,
    collections: getCollections(index).filter((c) => c.id !== id),
    documents: index.documents.map((doc) =>
      doc.collectionId === id ? { ...doc, collectionId: null } : doc,
    ),
  });
};

export const assignDocumentToCollection = (
  docId: DocumentId,
  collectionId: CollectionId | null,
) => {
  const index = getDocumentsIndex();
  const doc = index.documents.find((d) => d.id === docId);
  if (
    !doc ||
    getDocumentCollectionId(doc, getCollections(index)) === collectionId ||
    (collectionId !== null &&
      !getCollections(index).some((c) => c.id === collectionId))
  ) {
    return;
  }
  setDocumentsIndex({
    ...index,
    documents: index.documents.map((d) =>
      d.id === docId ? { ...d, collectionId } : d,
    ),
  });
};
