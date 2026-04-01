/**
 * Pure 3D file import/export — GLTF, GLB, OBJ, STL.
 * Uses Three.js loaders to parse files and convert them into the Batcave SceneNode graph.
 * Three.js is already in package.json.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { MODEL_FORMAT_VERSION, type ModelingScene, type SceneNode } from "../types";

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── THREE.Object3D → SceneNode conversion ───────────────────────────────────

/** Recursively convert a THREE.Object3D tree into SceneNodes */
function convertThreeObject(
  obj: THREE.Object3D,
  parentId: string | null,
  nodes: Record<string, SceneNode>,
  rootNodeIds: string[],
  _gltfArchive: Record<string, unknown>,
): { nodes: Record<string, SceneNode>; rootNodeIds: string[] } {
  const id = makeId(obj.type || "group");
  const name = obj.name || id;

  let nodeType: SceneNode["type"] = "group";
  let props: Record<string, unknown> = {};

  if (obj instanceof THREE.Mesh) {
    const geo = obj.geometry;
    const mat = obj.material as THREE.MeshStandardMaterial | undefined;
    const color = mat?.color ? `#${mat.color.getHexString()}` : "#6ea8ff";

    if (geo instanceof THREE.BoxGeometry) {
      nodeType = "box";
      props = { width: geo.parameters.width ?? 1, height: geo.parameters.height ?? 1, depth: geo.parameters.depth ?? 1, color };
    } else if (geo instanceof THREE.SphereGeometry) {
      nodeType = "sphere";
      props = { radius: geo.parameters.radius ?? 0.5, widthSegments: geo.parameters.widthSegments ?? 24, heightSegments: geo.parameters.heightSegments ?? 16, color };
    } else if (geo instanceof THREE.CylinderGeometry) {
      nodeType = "cylinder";
      props = { radiusTop: geo.parameters.radiusTop ?? 0.5, radiusBottom: geo.parameters.radiusBottom ?? 0.5, height: geo.parameters.height ?? 1, radialSegments: geo.parameters.radialSegments ?? 24, color };
    } else if (geo instanceof THREE.PlaneGeometry) {
      nodeType = "plane";
      props = { width: geo.parameters.width ?? 1, height: geo.parameters.height ?? 1, color };
    } else {
      // Unknown geometry — represented as a MeshNode placeholder
      nodeType = "mesh";
      props = { gltfDef: "", sourceFile: "imported.glb", color };
    }
  } else if (obj instanceof THREE.DirectionalLight) {
    nodeType = "directionalLight";
    props = { intensity: obj.intensity, color: `#${obj.color.getHexString()}` };
  } else if (obj instanceof THREE.PointLight) {
    nodeType = "pointLight";
    props = { intensity: obj.intensity, distance: obj.distance, decay: obj.decay, color: `#${obj.color.getHexString()}` };
  } else if (obj instanceof THREE.AmbientLight) {
    nodeType = "ambientLight";
    props = { intensity: obj.intensity, color: `#${obj.color.getHexString()}` };
  } else if (obj instanceof THREE.Group) {
    nodeType = "group";
    props = {};
  }

  const node: SceneNode = {
    id,
    name,
    type: nodeType,
    parentId,
    position: [obj.position.x, obj.position.y, obj.position.z],
    rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
    scale: [obj.scale.x, obj.scale.y, obj.scale.z],
    visible: obj.visible,
    locked: false,
    props: props as SceneNode["props"],
  } as SceneNode;

  nodes[id] = node;
  if (parentId === null) rootNodeIds.push(id);

  obj.children.forEach((child) => {
    const result = convertThreeObject(child, id, nodes, rootNodeIds, _gltfArchive);
    Object.assign(nodes, result.nodes);
  });

  return { nodes, rootNodeIds };
}

// ─── SceneNode → THREE.Scene (for export) ────────────────────────────────────

/** Reconstruct a live THREE.Scene from a SceneNode graph (used by GLTFExporter) */
export function buildThreeScene(scene: ModelingScene): THREE.Scene {
  const threeScene = new THREE.Scene();
  const objectMap = new Map<string, THREE.Object3D>();

  const allNodes = Object.values(scene.nodes);

  for (const node of allNodes) {
    let obj: THREE.Object3D | null = null;

    if (node.type === "box") {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(node.props.width, node.props.height, node.props.depth),
        new THREE.MeshStandardMaterial({ color: node.props.color }),
      );
      m.position.set(...node.position);
      m.rotation.set(...node.rotation);
      m.scale.set(...node.scale);
      obj = m;
    } else if (node.type === "sphere") {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(node.props.radius, node.props.widthSegments, node.props.heightSegments),
        new THREE.MeshStandardMaterial({ color: node.props.color }),
      );
      m.position.set(...node.position);
      m.rotation.set(...node.rotation);
      m.scale.set(...node.scale);
      obj = m;
    } else if (node.type === "cylinder") {
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(node.props.radiusTop, node.props.radiusBottom, node.props.height, node.props.radialSegments),
        new THREE.MeshStandardMaterial({ color: node.props.color }),
      );
      m.position.set(...node.position);
      m.rotation.set(...node.rotation);
      m.scale.set(...node.scale);
      obj = m;
    } else if (node.type === "plane") {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(node.props.width, node.props.height),
        new THREE.MeshStandardMaterial({ color: node.props.color, side: THREE.DoubleSide }),
      );
      m.position.set(...node.position);
      m.rotation.set(...node.rotation);
      m.scale.set(...node.scale);
      obj = m;
    } else if (node.type === "directionalLight") {
      const l = new THREE.DirectionalLight(new THREE.Color(node.props.color), node.props.intensity);
      l.position.set(...node.position);
      l.rotation.set(...node.rotation);
      l.scale.set(...node.scale);
      obj = l;
    } else if (node.type === "pointLight") {
      const l = new THREE.PointLight(new THREE.Color(node.props.color), node.props.intensity, node.props.distance, node.props.decay);
      l.position.set(...node.position);
      l.rotation.set(...node.rotation);
      l.scale.set(...node.scale);
      obj = l;
    } else if (node.type === "ambientLight") {
      const l = new THREE.AmbientLight(new THREE.Color(node.props.color), node.props.intensity);
      l.position.set(...node.position);
      l.scale.set(...node.scale);
      obj = l;
    } else if (node.type === "mesh") {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: node.props.color }));
      m.position.set(...node.position);
      m.rotation.set(...node.rotation);
      m.scale.set(...node.scale);
      obj = m;
    } else if (node.type === "group") {
      const g = new THREE.Group();
      g.position.set(...node.position);
      g.rotation.set(...node.rotation);
      g.scale.set(...node.scale);
      obj = g;
    }

    if (obj) {
      obj.name = node.name;
      obj.visible = node.visible;
      objectMap.set(node.id, obj);
      threeScene.add(obj);
    }
  }

  // Wire parent-child hierarchy
  for (const node of allNodes) {
    if (node.parentId) {
      const child = objectMap.get(node.id);
      const parent = objectMap.get(node.parentId);
      if (child && parent && parent instanceof THREE.Group) {
        parent.add(child);
      }
    }
  }

  return threeScene;
}

// ─── Public Import/Export API ─────────────────────────────────────────────────

export async function importGltf(file: File): Promise<{ ok: true; scene: ModelingScene } | { ok: false; error: string }> {
  try {
    const buffer = await file.arrayBuffer();
    const loader = new GLTFLoader();
    const { scene: threeScene } = await new Promise<GLTF>((resolve, reject) => {
      loader.parse(buffer, "", resolve, reject);
    });

    const nodes: Record<string, SceneNode> = {};
    const rootNodeIds: string[] = [];

    threeScene.children.forEach((child) => {
      const result = convertThreeObject(child, null, nodes, rootNodeIds, {});
      Object.assign(nodes, result.nodes);
    });

    const scene: ModelingScene = {
      formatVersion: MODEL_FORMAT_VERSION,
      sceneId: makeId("scene"),
      name: file.name.replace(/\.(gltf|glb)$/i, ""),
      rootNodeIds,
      nodes,
      updatedAt: Date.now(),
    };

    return { ok: true, scene };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to import GLTF" };
  }
}

export async function exportGltf(scene: ModelingScene, binary = false): Promise<Blob> {
  const threeScene = buildThreeScene(scene);
  return new Promise((resolve, reject) => {
    const exporter = new GLTFExporter();
    exporter.parse(
      threeScene,
      (result) => {
        if (binary && result instanceof ArrayBuffer) {
          resolve(new Blob([result], { type: "model/gltf-binary" }));
        } else if (typeof result === "string") {
          resolve(new Blob([result], { type: "application/json" }));
        } else {
          resolve(new Blob([JSON.stringify(result, null, 2)], { type: "application/json" }));
        }
      },
      (err) => reject(err),
      { binary },
    );
  });
}

export async function importObj(file: File): Promise<{ ok: true; scene: ModelingScene } | { ok: false; error: string }> {
  try {
    const text = await file.text();
    const loader = new OBJLoader();
    const obj = loader.parse(text);

    const nodes: Record<string, SceneNode> = {};
    const rootNodeIds: string[] = [];

    obj.children.forEach((child: THREE.Object3D) => {
      const result = convertThreeObject(child, null, nodes, rootNodeIds, {});
      Object.assign(nodes, result.nodes);
    });

    const scene: ModelingScene = {
      formatVersion: MODEL_FORMAT_VERSION,
      sceneId: makeId("scene"),
      name: file.name.replace(/\.obj$/i, ""),
      rootNodeIds,
      nodes,
      updatedAt: Date.now(),
    };

    return { ok: true, scene };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to import OBJ" };
  }
}

export async function importStl(file: File): Promise<{ ok: true; scene: ModelingScene } | { ok: false; error: string }> {
  try {
    const buffer = await file.arrayBuffer();
    const loader = new STLLoader();
    const geometry = loader.parse(buffer);
    const material = new THREE.MeshStandardMaterial({ color: "#6ea8ff" });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = file.name.replace(/\.stl$/i, "");

    const nodes: Record<string, SceneNode> = {};
    const rootNodeIds: string[] = [];
    const result = convertThreeObject(mesh, null, nodes, rootNodeIds, {});
    Object.assign(nodes, result.nodes);

    const scene: ModelingScene = {
      formatVersion: MODEL_FORMAT_VERSION,
      sceneId: makeId("scene"),
      name: file.name.replace(/\.stl$/i, ""),
      rootNodeIds: result.rootNodeIds,
      nodes,
      updatedAt: Date.now(),
    };

    return { ok: true, scene };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to import STL" };
  }
}
