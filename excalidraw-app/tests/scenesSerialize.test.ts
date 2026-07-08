import {
  sanitizeFilename,
  buildScenePaths,
  serializeSceneToString,
} from "../scenes/serialize";
import { saveSceneSync } from "../scenes/storage";

import type { CollectionMeta, SceneMeta } from "../scenes/storage";

const sceneMeta = (
  overrides: Partial<SceneMeta> & { id: string },
): SceneMeta => ({
  name: "Untitled",
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

const collectionMeta = (
  overrides: Partial<CollectionMeta> & { id: string },
): CollectionMeta => ({
  name: "Collection",
  createdAt: 1,
  ...overrides,
});

describe("sanitizeFilename", () => {
  it("strips illegal filesystem characters", () => {
    expect(sanitizeFilename('Roadmap: Q3/Q4 <v2> "final"?*|\\')).toBe(
      "Roadmap Q3Q4 v2 final",
    );
  });

  it("strips control characters", () => {
    expect(sanitizeFilename("a\u0000b\u001fc")).toBe("abc");
  });

  it("trims trailing dots and spaces", () => {
    expect(sanitizeFilename("name... ")).toBe("name");
  });

  it("guards reserved Windows names", () => {
    expect(sanitizeFilename("CON")).toBe("CON_");
    expect(sanitizeFilename("com1")).toBe("com1_");
  });

  it("falls back to Untitled when nothing survives", () => {
    expect(sanitizeFilename("")).toBe("Untitled");
    expect(sanitizeFilename("???")).toBe("Untitled");
    expect(sanitizeFilename("   ")).toBe("Untitled");
  });

  it("truncates very long names", () => {
    expect(sanitizeFilename("x".repeat(300)).length).toBeLessThanOrEqual(96);
  });
});

describe("buildScenePaths", () => {
  it("places root scenes at the top level and collection scenes in folders", () => {
    const collections = [collectionMeta({ id: "c1", name: "Ideas" })];
    const scenes = [
      sceneMeta({ id: "s1", name: "Home" }),
      sceneMeta({ id: "s2", name: "Roadmap", collectionId: "c1" }),
    ];
    const paths = buildScenePaths(scenes, collections);
    expect(paths.get("s1")).toBe("Home.excalidraw");
    expect(paths.get("s2")).toBe("Ideas/Roadmap.excalidraw");
  });

  it("dedupes clashing scene names within a folder", () => {
    const scenes = [
      sceneMeta({ id: "s1", name: "Plan" }),
      sceneMeta({ id: "s2", name: "Plan" }),
      sceneMeta({ id: "s3", name: "plan" }),
    ];
    const paths = buildScenePaths(scenes, []);
    expect(paths.get("s1")).toBe("Plan.excalidraw");
    expect(paths.get("s2")).toBe("Plan (2).excalidraw");
    expect(paths.get("s3")).toBe("plan (3).excalidraw");
  });

  it("allows same scene name in different folders", () => {
    const collections = [collectionMeta({ id: "c1", name: "Ideas" })];
    const scenes = [
      sceneMeta({ id: "s1", name: "Plan" }),
      sceneMeta({ id: "s2", name: "Plan", collectionId: "c1" }),
    ];
    const paths = buildScenePaths(scenes, collections);
    expect(paths.get("s1")).toBe("Plan.excalidraw");
    expect(paths.get("s2")).toBe("Ideas/Plan.excalidraw");
  });

  it("dedupes collections that sanitize to the same folder name", () => {
    const collections = [
      collectionMeta({ id: "c1", name: "Ideas?" }),
      collectionMeta({ id: "c2", name: "Ideas*" }),
    ];
    const scenes = [
      sceneMeta({ id: "s1", name: "A", collectionId: "c1" }),
      sceneMeta({ id: "s2", name: "A", collectionId: "c2" }),
    ];
    const paths = buildScenePaths(scenes, collections);
    expect(paths.get("s1")).toBe("Ideas/A.excalidraw");
    expect(paths.get("s2")).toBe("Ideas (2)/A.excalidraw");
  });

  it("resolves a dangling collection reference to the root", () => {
    const scenes = [sceneMeta({ id: "s1", name: "A", collectionId: "gone" })];
    const paths = buildScenePaths(scenes, []);
    expect(paths.get("s1")).toBe("A.excalidraw");
  });
});

describe("serializeSceneToString", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("serializes a persisted scene as a self-contained .excalidraw file", async () => {
    const meta = sceneMeta({ id: "scene-1", name: "My scene" });
    saveSceneSync(meta.id, {
      elements: [
        {
          id: "rect-1",
          type: "rectangle",
          isDeleted: false,
        } as any,
      ],
      appState: { viewBackgroundColor: "#fff" },
    });

    const parsed = JSON.parse(await serializeSceneToString(meta));
    expect(parsed.type).toBe("excalidraw");
    expect(parsed.elements).toHaveLength(1);
    expect(parsed.elements[0].id).toBe("rect-1");
    // scene names travel in the manifest/filename, not the exported appState
    expect(parsed.appState.name).toBeUndefined();
    expect(parsed.files).toEqual({});
  });

  it("serializes a never-saved scene as an empty scene", async () => {
    const parsed = JSON.parse(
      await serializeSceneToString(sceneMeta({ id: "missing", name: "Empty" })),
    );
    expect(parsed.type).toBe("excalidraw");
    expect(parsed.elements).toEqual([]);
  });
});
