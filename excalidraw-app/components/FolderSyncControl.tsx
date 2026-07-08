import ConfirmDialog from "@excalidraw/excalidraw/components/ConfirmDialog";
import { useState } from "react";

import { useAtomValue } from "../app-jotai";
import {
  disableFolderSync,
  enableFolderSync,
  folderSyncErrorAtom,
  folderSyncStatusAtom,
  isFolderSyncSupported,
  reenableFolderSync,
} from "../scenes/folderSync";

import "./FolderSyncControl.scss";

// tabler-icons: folder-share (no fitting icon in the editor package)
const folderSyncIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M13 19h-8a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2h4l3 3h7a2 2 0 0 1 2 2v4" />
    <path d="M16 22l5 -5" />
    <path d="M21 21.5v-4.5h-4.5" />
  </svg>
);

/**
 * Sidebar control for the one-way folder mirror (see scenes/folderSync.ts).
 * Renders nothing on browsers without the File System Access API.
 */
export const FolderSyncControl = () => {
  const status = useAtomValue(folderSyncStatusAtom);
  const error = useAtomValue(folderSyncErrorAtom);
  const [isConfirmingStop, setIsConfirmingStop] = useState(false);

  if (!isFolderSyncSupported() || status === "unsupported") {
    return null;
  }

  return (
    <div className="folder-sync">
      {status === "off" && (
        <button
          type="button"
          className="folder-sync__action"
          title="Continuously save all scenes as .excalidraw files into a folder you pick"
          onClick={() => enableFolderSync()}
        >
          {folderSyncIcon}
          <span>Sync to folder…</span>
        </button>
      )}
      {status === "active" && (
        <div className="folder-sync__row">
          <span className="folder-sync__dot folder-sync__dot--active" />
          <span className="folder-sync__label">Syncing to folder</span>
          <button
            type="button"
            className="folder-sync__stop"
            onClick={() => setIsConfirmingStop(true)}
          >
            Stop
          </button>
        </div>
      )}
      {status === "needs-permission" && (
        <button
          type="button"
          className="folder-sync__action"
          title="The browser needs you to re-confirm access to the sync folder"
          onClick={() => reenableFolderSync()}
        >
          <span className="folder-sync__dot folder-sync__dot--warning" />
          <span>Resume folder sync</span>
        </button>
      )}
      {status === "error" && (
        <div className="folder-sync__row folder-sync__row--error">
          <span className="folder-sync__dot folder-sync__dot--error" />
          <span className="folder-sync__label" title={error ?? undefined}>
            {error ?? "Folder sync failed."}
          </span>
          <button
            type="button"
            className="folder-sync__stop"
            onClick={() => enableFolderSync()}
          >
            Choose folder…
          </button>
        </div>
      )}
      {isConfirmingStop && (
        <ConfirmDialog
          title="Stop folder sync"
          onConfirm={() => {
            disableFolderSync();
            setIsConfirmingStop(false);
          }}
          onCancel={() => setIsConfirmingStop(false)}
        >
          <p>
            Scenes will no longer be saved to the folder. Files already written
            are kept on disk.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
};
