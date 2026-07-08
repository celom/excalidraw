import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

import {
  ARCHIVE_MANIFEST_FILENAME,
  ARCHIVE_TYPE,
  buildManifest,
  detectConflicts,
  parseManifest,
  planFromEntries,
} from "../scenes/archive";
import { buildArchive } from "../scenes/export";
import { readArchive } from "../scenes/import";
import { buildScenePaths } from "../scenes/serialize";
import { setScenesIndex } from "../scenes/state";
import { saveSceneSync } from "../scenes/storage";

import type { ArchiveManifest } from "../scenes/archive";
import type { CollectionMeta, SceneMeta, ScenesIndex } from "../scenes/storage";

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

const fixtureIndex = (): ScenesIndex => ({
  version: 1,
  activeSceneId: "s1",
  scenes: [
    sceneMeta({ id: "s1", name: "Home" }),
    sceneMeta({ id: "s2", name: "Roadmap", collectionId: "c1" }),
  ],
  collections: [collectionMeta({ id: "c1", name: "Ideas" })],
});

describe("buildManifest", () => {
  it("captures ids, order, paths and normalized collection refs", () => {
    const index = fixtureIndex();
    const scenes = [
      ...index.scenes,
      sceneMeta({ id: "s3", name: "Dangling", collectionId: "gone" }),
    ];
    const paths = buildScenePaths(scenes, index.collections!);
    const manifest = buildManifest({
      scenes,
      collections: index.collections!,
      scope: "all",
      activeSceneId: "s1",
      paths,
    });

    expect(manifest.type).toBe(ARCHIVE_TYPE);
    expect(manifest.version).toBe(1);
    expect(manifest.activeSceneId).toBe("s1");
    expect(manifest.scenes.map((scene) => scene.id)).toEqual([
      "s1",
      "s2",
      "s3",
    ]);
    expect(manifest.scenes[1].path).toBe("Ideas/Roadmap.excalidraw");
    // dangling collection refs are normalized to root
    expect(manifest.scenes[2].collectionId).toBeNull();
    expect(manifest.scenes[2].path).toBe("Dangling.excalidraw");
  });
});

describe("detectConflicts", () => {
  const manifestFor = (index: ScenesIndex): ArchiveManifest =>
    buildManifest({
      scenes: index.scenes,
      collections: index.collections ?? [],
      scope: "all",
      paths: buildScenePaths(index.scenes, index.collections ?? []),
    });

  it("reports no conflicts against a disjoint index", () => {
    const local: ScenesIndex = {
      version: 1,
      activeSceneId: "other",
      scenes: [sceneMeta({ id: "other" })],
    };
    expect(detectConflicts(manifestFor(fixtureIndex()), local)).toEqual({
      sceneConflicts: [],
      collectionConflicts: [],
    });
  });

  it("reports scene and collection id overlaps", () => {
    const local = fixtureIndex();
    expect(detectConflicts(manifestFor(fixtureIndex()), local)).toEqual({
      sceneConflicts: ["s1", "s2"],
      collectionConflicts: ["c1"],
    });
  });
});

describe("parseManifest", () => {
  const validManifest = () =>
    buildManifest({
      scenes: fixtureIndex().scenes,
      collections: fixtureIndex().collections!,
      scope: "all",
      paths: buildScenePaths(
        fixtureIndex().scenes,
        fixtureIndex().collections!,
      ),
    });

  it("roundtrips a built manifest", () => {
    const manifest = validManifest();
    expect(parseManifest(JSON.parse(JSON.stringify(manifest)))).toEqual(
      manifest,
    );
  });

  it("rejects unknown versions and malformed shapes", () => {
    expect(parseManifest(null)).toBeNull();
    expect(parseManifest({})).toBeNull();
    expect(parseManifest({ ...validManifest(), version: 2 })).toBeNull();
    expect(parseManifest({ ...validManifest(), type: "other" })).toBeNull();
    expect(
      parseManifest({ ...validManifest(), scenes: [{ id: 42 }] }),
    ).toBeNull();
    expect(
      parseManifest({ ...validManifest(), collections: "nope" }),
    ).toBeNull();
  });
});

describe("planFromEntries", () => {
  it("derives scenes and collections from a manifest-less layout", () => {
    const plan = planFromEntries(
      [
        "Home.excalidraw",
        "Ideas/Roadmap.excalidraw",
        "Ideas/Nested/Deep.excalidraw",
        "Ideas/",
        "notes.txt",
      ],
      1000,
    );

    expect(plan.scenes.map((scene) => scene.name)).toEqual([
      "Home",
      "Roadmap",
      "Deep",
    ]);
    expect(plan.collections).toHaveLength(1);
    expect(plan.collections[0].name).toBe("Ideas");
    // root file → no collection; nested files → the top-level folder
    expect(plan.scenes[0].collectionId).toBeNull();
    expect(plan.scenes[1].collectionId).toBe(plan.collections[0].id);
    expect(plan.scenes[2].collectionId).toBe(plan.collections[0].id);
    // fresh ids so a foreign zip can never conflict with local data
    expect(new Set(plan.scenes.map((scene) => scene.id)).size).toBe(3);
  });
});

describe("readArchive", () => {
  const zipFile = (entries: Record<string, Uint8Array>) =>
    new File([new Uint8Array(zipSync(entries)) as BlobPart], "archive.zip");
  const bytes = (data: string) => new Uint8Array(strToU8(data));

  it("reads a manifest archive and maps scene ids to entry bytes", async () => {
    setScenesIndex(fixtureIndex());
    const { bytes: archiveBytes } = await buildArchive("all");
    const parsed = await readArchive(
      new File([new Uint8Array(archiveBytes) as BlobPart], "backup.zip"),
    );

    expect(parsed.hadManifest).toBe(true);
    expect(parsed.manifest.scenes.map((scene) => scene.id)).toEqual([
      "s1",
      "s2",
    ]);
    expect(parsed.sceneFiles.size).toBe(2);
  });

  it("drops manifest scenes whose entries are missing from the zip", async () => {
    setScenesIndex(fixtureIndex());
    const { bytes: archiveBytes } = await buildArchive("all");
    const entries = unzipSync(archiveBytes);
    delete entries["Ideas/Roadmap.excalidraw"];
    const reZipped: Record<string, Uint8Array> = {};
    for (const [path, data] of Object.entries(entries)) {
      reZipped[path] = new Uint8Array(data);
    }

    const parsed = await readArchive(zipFile(reZipped));
    expect(parsed.manifest.scenes.map((scene) => scene.id)).toEqual(["s1"]);
  });

  it("falls back to the entry plan when there is no manifest", async () => {
    const parsed = await readArchive(
      zipFile({
        "Home.excalidraw": bytes('{"type":"excalidraw","elements":[]}'),
        "Ideas/Plan.excalidraw": bytes('{"type":"excalidraw","elements":[]}'),
      }),
    );

    expect(parsed.hadManifest).toBe(false);
    expect(parsed.manifest.scenes.map((scene) => scene.name)).toEqual([
      "Home",
      "Plan",
    ]);
    expect(parsed.sceneFiles.size).toBe(2);
  });

  it("rejects a zip with no scenes and non-zip files", async () => {
    await expect(
      readArchive(zipFile({ "readme.txt": bytes("hi") })),
    ).rejects.toThrow("no .excalidraw scenes");
    await expect(
      readArchive(new File([bytes("not a zip") as BlobPart], "x.zip")),
    ).rejects.toThrow("not a readable zip");
  });
});

describe("buildArchive", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("zips a manifest plus one .excalidraw entry per scene", async () => {
    setScenesIndex(fixtureIndex());
    saveSceneSync("s1", {
      elements: [{ id: "rect-1", type: "rectangle", isDeleted: false } as any],
      appState: {},
    });
    // s2 stays never-saved — must still get an (empty) entry

    const { filename, bytes } = await buildArchive("all");
    expect(filename).toMatch(/^excalidraw-workspace \d{4}-\d{2}-\d{2}\.zip$/);

    const entries = unzipSync(bytes);
    expect(Object.keys(entries).sort()).toEqual([
      "Home.excalidraw",
      "Ideas/Roadmap.excalidraw",
      ARCHIVE_MANIFEST_FILENAME,
    ]);

    const manifest = JSON.parse(strFromU8(entries[ARCHIVE_MANIFEST_FILENAME]));
    expect(manifest.type).toBe(ARCHIVE_TYPE);
    expect(manifest.scope).toBe("all");
    expect(manifest.scenes).toHaveLength(2);

    const home = JSON.parse(strFromU8(entries["Home.excalidraw"]));
    expect(home.type).toBe("excalidraw");
    expect(home.elements[0].id).toBe("rect-1");

    const roadmap = JSON.parse(strFromU8(entries["Ideas/Roadmap.excalidraw"]));
    expect(roadmap.elements).toEqual([]);
  });

  it("scopes a single-collection export to that collection", async () => {
    setScenesIndex(fixtureIndex());

    const { filename, bytes } = await buildArchive("c1");
    expect(filename).toMatch(/^Ideas \d{4}-\d{2}-\d{2}\.zip$/);

    const entries = unzipSync(bytes);
    expect(Object.keys(entries).sort()).toEqual([
      "Ideas/Roadmap.excalidraw",
      ARCHIVE_MANIFEST_FILENAME,
    ]);

    const manifest = JSON.parse(strFromU8(entries[ARCHIVE_MANIFEST_FILENAME]));
    expect(manifest.scope).toBe("collection");
    expect(manifest.scenes.map((scene: any) => scene.id)).toEqual(["s2"]);
    expect(manifest.collections.map((c: any) => c.id)).toEqual(["c1"]);
    expect(manifest.activeSceneId).toBeUndefined();
  });
});
