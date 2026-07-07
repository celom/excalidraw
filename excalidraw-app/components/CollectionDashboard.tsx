import { useExcalidrawAPI } from "@excalidraw/excalidraw";
import { CloseIcon } from "@excalidraw/excalidraw/components/icons";
import { useUIAppState } from "@excalidraw/excalidraw/context/ui-appState";
import clsx from "clsx";
import { useEffect } from "react";

import { useAtom, useAtomValue } from "../app-jotai";
import { isCollaboratingAtom } from "../collab/Collab";
import { LocalData } from "../data/LocalData";
import { switchToDocument } from "../documents/actions";
import {
  getCollections,
  getDocumentCollectionId,
} from "../documents/collections";
import {
  ROOT_COLLECTION_ID,
  documentsIndexAtom,
  openCollectionIdAtom,
} from "../documents/state";

import { DOCUMENTS_SIDEBAR_NAME } from "./AppDocumentsSidebar";
import { DocumentCard } from "./DocumentCard";

import "./CollectionDashboard.scss";

export const CollectionDashboard = () => {
  const excalidrawAPI = useExcalidrawAPI();
  const [openCollectionId, setOpenCollectionId] = useAtom(openCollectionIdAtom);
  const documentsIndex = useAtomValue(documentsIndexAtom);
  const isCollaborating = useAtomValue(isCollaboratingAtom);
  // the sidebar stacks above the overlay — inset the overlay so its content
  // isn't hidden underneath
  const isDocumentsSidebarOpen =
    useUIAppState().openSidebar?.name === DOCUMENTS_SIDEBAR_NAME;

  const isOpen = openCollectionId !== null;
  const collections = getCollections(documentsIndex);
  const collection =
    openCollectionId !== null && openCollectionId !== ROOT_COLLECTION_ID
      ? collections.find((c) => c.id === openCollectionId)
      : null;
  // the open collection was deleted (possibly by another tab)
  const isDangling = openCollectionId !== ROOT_COLLECTION_ID && !collection;

  useEffect(() => {
    if (isOpen && isDangling) {
      setOpenCollectionId(null);
    }
  }, [isOpen, isDangling, setOpenCollectionId]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    // persist the active document's pending debounced save so its card
    // snapshot is up to date
    LocalData.flushSave();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // capture on window runs before the editor's document-level handler,
        // so the canvas doesn't also react
        event.stopPropagation();
        setOpenCollectionId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
    };
  }, [isOpen, setOpenCollectionId]);

  if (!excalidrawAPI || !isOpen || isDangling) {
    return null;
  }

  const documents = documentsIndex.documents
    .filter(
      (doc) =>
        getDocumentCollectionId(doc, collections) ===
        (openCollectionId === ROOT_COLLECTION_ID ? null : openCollectionId),
    )
    .sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div
      className={clsx("collection-dashboard", {
        "collection-dashboard--sidebar-open": isDocumentsSidebarOpen,
      })}
      // keep the (undocked) documents sidebar open while interacting with
      // the dashboard — also avoids the layout shift swallowing the click
      data-prevent-outside-click
    >
      <div className="collection-dashboard__header">
        <div className="collection-dashboard__title">
          {collection ? collection.name : "Dashboard"}
        </div>
        <button
          type="button"
          className="collection-dashboard__close"
          title="Close"
          onClick={() => setOpenCollectionId(null)}
        >
          {CloseIcon}
        </button>
      </div>
      {isCollaborating && (
        <div className="collection-dashboard__hint">
          Switching documents is disabled during a live collaboration session.
        </div>
      )}
      <div className="collection-dashboard__grid">
        {documents.map((doc) => (
          <DocumentCard
            key={doc.id}
            meta={doc}
            isActive={doc.id === documentsIndex.activeDocumentId}
            disabled={isCollaborating}
            onOpen={() => {
              switchToDocument(doc.id, excalidrawAPI);
              setOpenCollectionId(null);
            }}
          />
        ))}
        {!documents.length && (
          <div className="collection-dashboard__empty">
            No documents in this collection.
          </div>
        )}
      </div>
    </div>
  );
};
