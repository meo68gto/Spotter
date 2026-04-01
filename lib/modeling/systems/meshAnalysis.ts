import * as THREE from "three";

export type MeshAnalysisResult = {
  vertexCount: number;
  faceCount: number;
  boundingBox: { min: [number, number, number]; max: [number, number, number] };
  hasNormals: boolean;
  hasUVs: boolean;
  isManifold: boolean;
  geometryType: string;
  memoryBytes: number;
};

/**
 * Analyze a THREE.BufferGeometry and return structural metrics.
 * Used by the Mesh Inspector panel.
 */
export function analyzeMesh(geometry: THREE.BufferGeometry): MeshAnalysisResult {
  const posAttr = geometry.getAttribute("position");
  const normAttr = geometry.getAttribute("normal");
  const uvAttr = geometry.getAttribute("uv");

  const vertexCount = posAttr ? posAttr.count : 0;
  const faceCount = vertexCount / 3;

  // Bounding box
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox;
  const bbMin: [number, number, number] = bb ? [bb.min.x, bb.min.y, bb.min.z] : [0, 0, 0];
  const bbMax: [number, number, number] = bb ? [bb.max.x, bb.max.y, bb.max.z] : [0, 0, 0];
  const boundingBox = { min: bbMin, max: bbMax };

  // Normals and UVs presence
  const hasNormals = !!normAttr && normAttr.count === vertexCount;
  const hasUVs = !!uvAttr && uvAttr.count === vertexCount;

  // Manifold check: each unique edge is shared by at most 2 faces
  const isManifold = checkManifold(geometry);

  // Geometry type name
  const geometryType = geometry.constructor.name.replace("Geometry", "").toLowerCase() || "buffer";

  // Rough memory estimate
  const memoryBytes =
    (posAttr ? posAttr.array.byteLength : 0) +
    (normAttr ? normAttr.array.byteLength : 0) +
    (uvAttr ? uvAttr.array.byteLength : 0) +
    (geometry.getIndex() ? geometry.getIndex()!.array.byteLength : 0);

  return { vertexCount, faceCount, boundingBox, hasNormals, hasUVs, isManifold, geometryType, memoryBytes };
}

/** Simple closed-edge manifold check via half-edge counting */
function checkManifold(geometry: THREE.BufferGeometry): boolean {
  try {
    const index = geometry.getIndex();
    if (!index) return false;

    const edges = new Map<string, number>();
    const arr = index.array;
    const count = arr.length;

    for (let i = 0; i < count; i += 3) {
      const a = arr[i];
      const b = arr[i + 1];
      const c = arr[i + 2];
      const pairs: [number, number][] = [
        [Math.min(a, b), Math.max(a, b)],
        [Math.min(b, c), Math.max(b, c)],
        [Math.min(c, a), Math.max(c, a)],
      ];
      for (const [u, v] of pairs) {
        const key = `${u}_${v}`;
        const cnt = (edges.get(key) ?? 0) + 1;
        if (cnt > 2) return false;
        edges.set(key, cnt);
      }
    }
    return true;
  } catch {
    return false;
  }
}

/** Convenience wrapper: analyze a live THREE.Mesh */
export function analyzeThreeMesh(mesh: THREE.Mesh): MeshAnalysisResult {
  return analyzeMesh(mesh.geometry);
}
