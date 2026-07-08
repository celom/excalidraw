/**
 * Browser file I/O for archive zips, via browser-fs-access (native save/open
 * dialogs on Chromium, download/input fallback elsewhere). Used directly
 * rather than through the editor package's `fileSave`/`fileOpen` wrappers,
 * which are typed to `MIME_TYPES` — and that has no zip entry. Lives in its
 * own module so component tests can mock it.
 */

import { fileOpen, fileSave } from "browser-fs-access";

/** no-op when the user cancels the save dialog */
export const downloadBlob = async (blob: Blob, filename: string) => {
  try {
    await fileSave(blob, {
      fileName: filename,
      description: "Excalidraw collection archive",
      extensions: [".zip"],
      mimeTypes: ["application/zip"],
    });
  } catch (error: any) {
    if (error?.name === "AbortError") {
      return;
    }
    throw error;
  }
};

/** resolves null when the user cancels the picker */
export const pickZipFile = async (): Promise<File | null> => {
  try {
    return await fileOpen({
      description: "Excalidraw collection archive",
      extensions: [".zip"],
      mimeTypes: ["application/zip"],
    });
  } catch (error: any) {
    if (error?.name === "AbortError") {
      return null;
    }
    throw error;
  }
};
