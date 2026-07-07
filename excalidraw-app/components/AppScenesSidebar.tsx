import { Sidebar } from "@excalidraw/excalidraw";

import { ScenesTab } from "./ScenesTab";

export const SCENES_SIDEBAR_NAME = "scenes";

export const AppScenesSidebar = () => {
  return (
    <Sidebar name={SCENES_SIDEBAR_NAME} position="left">
      <Sidebar.Header />
      <ScenesTab />
    </Sidebar>
  );
};
