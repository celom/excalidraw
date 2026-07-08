import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import DialogActionButton from "@excalidraw/excalidraw/components/DialogActionButton";
import { flushSync } from "react-dom";

import "./ArchiveConflictDialog.scss";

import type { ConflictResolution } from "../scenes/import";

const plural = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? "" : "s"}`;

/**
 * Restore-by-id summary prompt: shown once per import when the archive
 * contains ids that already exist in this browser (see scenes/import.ts).
 */
export const ArchiveConflictDialog = ({
  sceneCount,
  collectionCount,
  conflictingSceneCount,
  conflictingCollectionCount,
  onCancel,
  onResolve,
}: {
  sceneCount: number;
  collectionCount: number;
  conflictingSceneCount: number;
  conflictingCollectionCount: number;
  onCancel: () => void;
  onResolve: (resolution: ConflictResolution) => void;
}) => {
  const conflictSummary = [
    conflictingSceneCount ? plural(conflictingSceneCount, "scene") : null,
    conflictingCollectionCount
      ? plural(conflictingCollectionCount, "collection")
      : null,
  ]
    .filter(Boolean)
    .join(" and ");

  return (
    <Dialog
      title="Import archive"
      size="small"
      onCloseRequest={onCancel}
      className="archive-conflict-dialog"
    >
      <p>
        This archive contains {plural(sceneCount, "scene")}
        {collectionCount ? ` in ${plural(collectionCount, "collection")}` : ""}.
      </p>
      <p>
        <b>{conflictSummary} from this archive already exist</b> in this browser
        — likely from an earlier backup of this workspace.
      </p>
      <p>
        <b>Overwrite</b> replaces the existing versions; <b>Keep both</b>{" "}
        imports them as copies.
      </p>
      <div className="archive-conflict-dialog__buttons">
        <DialogActionButton label="Cancel" onClick={onCancel} />
        <DialogActionButton
          label="Keep both"
          onClick={() =>
            // flush before the caller re-focuses the container (see
            // ConfirmDialog for the chromium crash this avoids)
            flushSync(() => onResolve("keep-both"))
          }
        />
        <DialogActionButton
          label="Overwrite"
          actionType="danger"
          onClick={() => flushSync(() => onResolve("overwrite"))}
        />
      </div>
    </Dialog>
  );
};
