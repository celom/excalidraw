import { useExcalidrawAPI } from "@excalidraw/excalidraw";
import { PlusIcon } from "@excalidraw/excalidraw/components/icons";
import clsx from "clsx";
import { useState } from "react";

import { useAtomValue, useSetAtom } from "../app-jotai";
import { isCollaboratingAtom } from "../collab/Collab";
import { createScene, switchToScene } from "../scenes/actions";
import {
  SCENE_DRAG_MIME,
  assignSceneToCollection,
  createCollection,
  getCollections,
} from "../scenes/collections";
import {
  ROOT_COLLECTION_ID,
  scenesIndexAtom,
  openCollectionIdAtom,
} from "../scenes/state";

import "./ScenesTab.scss";

import type { OpenCollectionId } from "../scenes/state";

const MS_IN_MINUTE = 60 * 1000;
const RELATIVE_TIME_UNITS: [number, Intl.RelativeTimeFormatUnit][] = [
  [365 * 24 * 60 * MS_IN_MINUTE, "year"],
  [30 * 24 * 60 * MS_IN_MINUTE, "month"],
  [7 * 24 * 60 * MS_IN_MINUTE, "week"],
  [24 * 60 * MS_IN_MINUTE, "day"],
  [60 * MS_IN_MINUTE, "hour"],
  [MS_IN_MINUTE, "minute"],
];

const formatRelativeTime = (timestamp: number) => {
  const diff = timestamp - Date.now();
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unitMs, unit] of RELATIVE_TIME_UNITS) {
    if (Math.abs(diff) >= unitMs) {
      return formatter.format(Math.round(diff / unitMs), unit);
    }
  }
  return "just now";
};

export const ScenesTab = () => {
  const excalidrawAPI = useExcalidrawAPI();
  const scenesIndex = useAtomValue(scenesIndexAtom);
  const isCollaborating = useAtomValue(isCollaboratingAtom);
  const setOpenCollectionId = useSetAtom(openCollectionIdAtom);

  const [dropTargetId, setDropTargetId] = useState<OpenCollectionId | null>(
    null,
  );

  if (!excalidrawAPI) {
    return null;
  }

  const collections = [...getCollections(scenesIndex)].sort(
    (a, b) => a.createdAt - b.createdAt,
  );
  const scenes = [...scenesIndex.scenes].sort(
    (a, b) => b.updatedAt - a.updatedAt,
  );

  const collectionDropHandlers = (target: OpenCollectionId) => ({
    onDragOver: (event: React.DragEvent) => {
      if (event.dataTransfer.types.includes(SCENE_DRAG_MIME)) {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setDropTargetId(target);
      }
    },
    onDragLeave: (event: React.DragEvent) => {
      // ignore transitions into the row's own children
      if (!event.currentTarget.contains(event.relatedTarget as Node)) {
        setDropTargetId((current) => (current === target ? null : current));
      }
    },
    onDrop: (event: React.DragEvent) => {
      event.preventDefault();
      setDropTargetId(null);
      const sceneId = event.dataTransfer.getData(SCENE_DRAG_MIME);
      if (sceneId) {
        assignSceneToCollection(
          sceneId,
          target === ROOT_COLLECTION_ID ? null : target,
        );
      }
    },
  });

  return (
    <div className="scenes-tab">
      <div className="scenes-tab__header">
        <div className="scenes-tab__title">Scenes</div>
        <button
          type="button"
          className="scenes-tab__new-button"
          onClick={() => createScene(excalidrawAPI)}
          disabled={isCollaborating}
          title="New scene"
        >
          {PlusIcon}
          New
        </button>
      </div>
      {isCollaborating && (
        <div className="scenes-tab__hint">
          Switching scenes is disabled during a live collaboration session.
        </div>
      )}
      <div className="scenes-tab__section-header">
        Collections
        <button
          type="button"
          title="New collection"
          onClick={() => {
            const meta = createCollection();
            setOpenCollectionId(meta.id);
          }}
        >
          {PlusIcon}
        </button>
      </div>
      <div className="scenes-tab__collections">
        <div
          className={clsx("scenes-tab__collection", {
            "scenes-tab__collection--drop-target":
              dropTargetId === ROOT_COLLECTION_ID,
          })}
          onClick={() => setOpenCollectionId(ROOT_COLLECTION_ID)}
          {...collectionDropHandlers(ROOT_COLLECTION_ID)}
        >
          <div className="scenes-tab__collection-name">
            {folderIcon}
            Dashboard
          </div>
        </div>
        {collections.map((collection) => (
          <div
            key={collection.id}
            className={clsx("scenes-tab__collection", {
              "scenes-tab__collection--drop-target":
                dropTargetId === collection.id,
            })}
            onClick={() => setOpenCollectionId(collection.id)}
            {...collectionDropHandlers(collection.id)}
          >
            <div className="scenes-tab__collection-name">
              {folderIcon}
              {collection.name}
            </div>
          </div>
        ))}
      </div>
      <div className="scenes-tab__section-header">All scenes</div>
      <div className="scenes-tab__list">
        {scenes.map((scene) => {
          const isActive = scene.id === scenesIndex.activeSceneId;
          const switchDisabled = isCollaborating || isActive;
          return (
            <div
              key={scene.id}
              className={clsx("scenes-tab__item", {
                "scenes-tab__item--active": isActive,
                "scenes-tab__item--disabled": isCollaborating && !isActive,
              })}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData(SCENE_DRAG_MIME, scene.id);
                event.dataTransfer.effectAllowed = "move";
              }}
              onClick={() => {
                if (!switchDisabled) {
                  switchToScene(scene.id, excalidrawAPI);
                }
              }}
            >
              <div className="scenes-tab__item-info">
                <div className="scenes-tab__item-name">
                  {isActive && (
                    <span
                      className="scenes-tab__active-dot"
                      title="Active scene"
                    />
                  )}
                  {scene.name}
                </div>
                <div className="scenes-tab__item-time">
                  {formatRelativeTime(scene.updatedAt)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// tabler-icons: files (no fitting icon in the editor package)
export const scenesTabIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M15 3v4a1 1 0 0 0 1 1h4" />
    <path d="M18 17h-7a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2h4l5 5v7a2 2 0 0 1 -2 2z" />
    <path d="M16 17v2a2 2 0 0 1 -2 2h-7a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2h2" />
  </svg>
);

// tabler-icons: folder (no fitting icon in the editor package)
const folderIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 4h4l3 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2" />
  </svg>
);
