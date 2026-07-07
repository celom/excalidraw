import {
  clearAppStateForLocalStorage,
  getDefaultAppState,
} from "@excalidraw/excalidraw/appState";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { AppState } from "@excalidraw/excalidraw/types";

import {
  STORAGE_KEYS,
  sceneAppStateKey,
  sceneElementsKey,
} from "../app_constants";
import { getOrCreateScenesIndex } from "../scenes/storage";

export const saveUsernameToLocalStorage = (username: string) => {
  try {
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_COLLAB,
      JSON.stringify({ username }),
    );
  } catch (error: any) {
    // Unable to access window.localStorage
    console.error(error);
  }
};

export const importUsernameFromLocalStorage = (): string | null => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_COLLAB);
    if (data) {
      return JSON.parse(data).username;
    }
  } catch (error: any) {
    // Unable to access localStorage
    console.error(error);
  }

  return null;
};

export const importFromLocalStorage = () => {
  // triggers the legacy single-scene → scenes migration on first load
  const index = getOrCreateScenesIndex();
  const activeMeta = index.scenes.find(
    (scene) => scene.id === index.activeSceneId,
  );

  let savedElements = null;
  let savedState = null;

  try {
    savedElements = localStorage.getItem(sceneElementsKey(index.activeSceneId));
    savedState = localStorage.getItem(sceneAppStateKey(index.activeSceneId));
  } catch (error: any) {
    // Unable to access localStorage
    console.error(error);
  }

  let elements: ExcalidrawElement[] = [];
  if (savedElements) {
    try {
      elements = JSON.parse(savedElements);
    } catch (error: any) {
      console.error(error);
      // Do nothing because elements array is already empty
    }
  }

  let appState = null;
  if (savedState) {
    try {
      appState = {
        ...getDefaultAppState(),
        ...clearAppStateForLocalStorage(
          JSON.parse(savedState) as Partial<AppState>,
        ),
      };
    } catch (error: any) {
      console.error(error);
      // Do nothing because appState is already null
    }
  }
  if (activeMeta) {
    // the index is the source of truth for the scene name. Force it even
    // when the scene has no persisted appState yet (e.g. a new scene before
    // its first save) so the default generated name doesn't leak into the
    // index on the next save.
    appState = { ...(appState ?? getDefaultAppState()), name: activeMeta.name };
  }
  return { elements, appState };
};

export const getElementsStorageSize = () => {
  try {
    const index = getOrCreateScenesIndex();
    const elements = localStorage.getItem(
      sceneElementsKey(index.activeSceneId),
    );
    const elementsSize = elements?.length || 0;
    return elementsSize;
  } catch (error: any) {
    console.error(error);
    return 0;
  }
};

export const getTotalStorageSize = () => {
  try {
    const index = getOrCreateScenesIndex();
    const indexSize =
      localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_SCENES_INDEX)?.length ||
      0;
    const collab = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_COLLAB);
    const collabSize = collab?.length || 0;

    const scenesSize = index.scenes.reduce((acc, scene) => {
      const elements = localStorage.getItem(sceneElementsKey(scene.id));
      const appState = localStorage.getItem(sceneAppStateKey(scene.id));
      return acc + (elements?.length || 0) + (appState?.length || 0);
    }, 0);

    return indexSize + collabSize + scenesSize;
  } catch (error: any) {
    console.error(error);
    return 0;
  }
};
