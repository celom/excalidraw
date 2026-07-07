import { THEME } from "@excalidraw/common";
import { exportToCanvas } from "@excalidraw/excalidraw";
import { useUIAppState } from "@excalidraw/excalidraw/context/ui-appState";
import { isInitializedImageElement } from "@excalidraw/element";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";

import type { FileId } from "@excalidraw/element/types";

import type { BinaryFiles } from "@excalidraw/excalidraw/types";

import { LocalData } from "../data/LocalData";
import { DOCUMENT_DRAG_MIME } from "../documents/collections";
import { loadDocumentSync } from "../documents/storage";

import { documentsTabIcon } from "./DocumentsTab";

import type { DocumentMeta } from "../documents/storage";

// rendered at 2x for retina
const CARD_PREVIEW_SIZE = 240;

export const DocumentCard = ({
  meta,
  isActive,
  disabled,
  onOpen,
}: {
  meta: DocumentMeta;
  isActive: boolean;
  disabled: boolean;
  onOpen: () => void;
}) => {
  const { theme } = useUIAppState();
  // canvas is attached imperatively (replaceChildren) — the host div must
  // stay mounted across status changes and never receive React children
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const [previewStatus, setPreviewStatus] = useState<
    "loading" | "ready" | "empty" | "error"
  >("loading");

  useEffect(() => {
    // guards against a stale export resolving after a newer one (or unmount)
    let cancelled = false;
    const isStale = () => cancelled;

    const renderPreview = async () => {
      const data = loadDocumentSync(meta.id);
      const elements = data?.elements.filter((element) => !element.isDeleted);
      if (!elements?.length) {
        setPreviewStatus("empty");
        return;
      }

      const fileIds = elements.reduce((acc, element) => {
        if (isInitializedImageElement(element)) {
          acc.push(element.fileId);
        }
        return acc;
      }, [] as FileId[]);

      const files: BinaryFiles = {};
      if (fileIds.length) {
        const { loadedFiles } = await LocalData.fileStorage.getFiles(fileIds);
        if (isStale()) {
          return;
        }
        for (const file of loadedFiles) {
          files[file.id] = file;
        }
      }

      const canvas = await exportToCanvas({
        elements,
        appState: {
          ...data?.appState,
          exportBackground: true,
          exportWithDarkMode: theme === THEME.DARK,
        },
        files,
        exportPadding: 8,
        maxWidthOrHeight: CARD_PREVIEW_SIZE * 2,
      });
      if (isStale()) {
        return;
      }
      canvasHostRef.current?.replaceChildren(canvas);
      setPreviewStatus("ready");
    };

    renderPreview().catch((error: any) => {
      console.error(error);
      if (!isStale()) {
        setPreviewStatus("error");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [meta.id, meta.updatedAt, theme]);

  return (
    <div
      className={clsx("document-card", {
        "document-card--active": isActive,
        "document-card--disabled": disabled,
      })}
      draggable={!disabled}
      onDragStart={(event) => {
        event.dataTransfer.setData(DOCUMENT_DRAG_MIME, meta.id);
        event.dataTransfer.effectAllowed = "move";
      }}
      onClick={() => {
        if (!disabled) {
          onOpen();
        }
      }}
    >
      <div className="document-card__preview">
        <div
          ref={canvasHostRef}
          className={clsx("document-card__preview-canvas", {
            "document-card__preview-canvas--hidden": previewStatus !== "ready",
          })}
        />
        {previewStatus === "empty" && (
          <div className="document-card__preview-fallback">Empty</div>
        )}
        {previewStatus === "error" && (
          <div className="document-card__preview-fallback">
            {documentsTabIcon}
          </div>
        )}
      </div>
      <div className="document-card__name">
        {isActive && (
          <span className="document-card__active-dot" title="Active document" />
        )}
        {meta.name}
      </div>
    </div>
  );
};
