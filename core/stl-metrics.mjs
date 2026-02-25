import fs from "node:fs";
import path from "node:path";

const UNIT_TO_MM = {
  mm: 1,
  cm: 10,
  m: 1000,
  inch: 25.4,
};

function detectBinaryStl(buffer) {
  if (buffer.length < 84) {
    return false;
  }
  const triangleCount = buffer.readUInt32LE(80);
  const expected = 84 + triangleCount * 50;
  if (expected === buffer.length) {
    return true;
  }
  const header = buffer.subarray(0, 80).toString("utf8").trim().toLowerCase();
  if (header.startsWith("solid")) {
    return false;
  }
  return true;
}

function numeric(value) {
  return Number.parseFloat(value);
}

function sortedEdgeKey(a, b) {
  return a < b ? `${a}_${b}` : `${b}_${a}`;
}

function triangleVolume(v0, v1, v2) {
  const cx = v1[1] * v2[2] - v1[2] * v2[1];
  const cy = v1[2] * v2[0] - v1[0] * v2[2];
  const cz = v1[0] * v2[1] - v1[1] * v2[0];
  return (v0[0] * cx + v0[1] * cy + v0[2] * cz) / 6.0;
}

export function loadStlMetrics(filePath, options = {}) {
  const inputUnit = options.inputUnit ?? "mm";
  const userScale = options.scaleToMm ?? 1;
  const watertightRequired = options.watertightRequired ?? true;
  const unitScale = UNIT_TO_MM[inputUnit];
  if (!unitScale) {
    throw new Error(`Unsupported input unit: ${inputUnit}`);
  }
  if (!(userScale > 0)) {
    throw new Error("scale_to_mm must be > 0");
  }

  const scale = unitScale * userScale;
  const absolute = path.resolve(filePath);
  if (!fs.existsSync(absolute)) {
    throw new Error(`Mesh file not found: ${filePath}`);
  }

  const buffer = fs.readFileSync(absolute);
  const binary = detectBinaryStl(buffer);

  let triangleCount = 0;
  let volume = 0;
  const edgeCounts = new Map();
  const vertexIndexByKey = new Map();
  let nextVertexIndex = 0;

  const min = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  const max = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];

  function vertexKey(v) {
    return `${v[0].toFixed(6)},${v[1].toFixed(6)},${v[2].toFixed(6)}`;
  }

  function getVertexIndex(v) {
    const key = vertexKey(v);
    const cached = vertexIndexByKey.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const idx = nextVertexIndex;
    nextVertexIndex += 1;
    vertexIndexByKey.set(key, idx);
    return idx;
  }

  function updateBounds(v) {
    if (v[0] < min[0]) min[0] = v[0];
    if (v[1] < min[1]) min[1] = v[1];
    if (v[2] < min[2]) min[2] = v[2];
    if (v[0] > max[0]) max[0] = v[0];
    if (v[1] > max[1]) max[1] = v[1];
    if (v[2] > max[2]) max[2] = v[2];
  }

  function processTriangle(v0, v1, v2) {
    triangleCount += 1;
    updateBounds(v0);
    updateBounds(v1);
    updateBounds(v2);
    volume += triangleVolume(v0, v1, v2);

    const i0 = getVertexIndex(v0);
    const i1 = getVertexIndex(v1);
    const i2 = getVertexIndex(v2);
    const e01 = sortedEdgeKey(i0, i1);
    const e12 = sortedEdgeKey(i1, i2);
    const e20 = sortedEdgeKey(i2, i0);
    edgeCounts.set(e01, (edgeCounts.get(e01) ?? 0) + 1);
    edgeCounts.set(e12, (edgeCounts.get(e12) ?? 0) + 1);
    edgeCounts.set(e20, (edgeCounts.get(e20) ?? 0) + 1);
  }

  if (!binary) {
    const text = buffer.toString("utf8");
    const vertexRegex =
      /vertex\s+([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)\s+([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)\s+([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)/g;

    const vertices = [];
    let match;
    while ((match = vertexRegex.exec(text)) !== null) {
      vertices.push([numeric(match[1]) * scale, numeric(match[2]) * scale, numeric(match[3]) * scale]);
    }
    if (vertices.length === 0 || vertices.length % 3 !== 0) {
      throw new Error("Invalid ASCII STL content (vertex count is not a triangle multiple)");
    }
    for (let i = 0; i < vertices.length; i += 3) {
      processTriangle(vertices[i], vertices[i + 1], vertices[i + 2]);
    }
  } else {
    const count = buffer.readUInt32LE(80);
    const expectedLength = 84 + count * 50;
    if (buffer.length < expectedLength) {
      throw new Error("Invalid binary STL length");
    }
    for (let i = 0; i < count; i += 1) {
      const off = 84 + i * 50 + 12; // skip normal
      const v0 = [
        buffer.readFloatLE(off) * scale,
        buffer.readFloatLE(off + 4) * scale,
        buffer.readFloatLE(off + 8) * scale,
      ];
      const v1 = [
        buffer.readFloatLE(off + 12) * scale,
        buffer.readFloatLE(off + 16) * scale,
        buffer.readFloatLE(off + 20) * scale,
      ];
      const v2 = [
        buffer.readFloatLE(off + 24) * scale,
        buffer.readFloatLE(off + 28) * scale,
        buffer.readFloatLE(off + 32) * scale,
      ];
      processTriangle(v0, v1, v2);
    }
  }

  if (triangleCount === 0) {
    throw new Error("STL contains no triangles");
  }

  let watertight = true;
  for (const count of edgeCounts.values()) {
    if (count !== 2) {
      watertight = false;
      break;
    }
  }

  if (watertightRequired && !watertight) {
    throw new Error("Mesh is not watertight (detected non-manifold/open edges)");
  }

  return {
    triangle_count: triangleCount,
    vertex_count: vertexIndexByKey.size,
    mesh_bbox_x_mm: max[0] - min[0],
    mesh_bbox_y_mm: max[1] - min[1],
    mesh_bbox_z_mm: max[2] - min[2],
    mesh_volume_mm3: Math.abs(volume),
    watertight,
  };
}
