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

function degToRad(value) {
  return (value * Math.PI) / 180;
}

function applyPose(vertex, pose = null) {
  if (!pose) {
    return vertex;
  }

  const tx = pose.tx_mm ?? 0;
  const ty = pose.ty_mm ?? 0;
  const tz = pose.tz_mm ?? 0;
  const rx = degToRad(pose.rx_deg ?? 0);
  const ry = degToRad(pose.ry_deg ?? 0);
  const rz = degToRad(pose.rz_deg ?? 0);

  let [x, y, z] = vertex;

  // Rotate X
  {
    const c = Math.cos(rx);
    const s = Math.sin(rx);
    const ny = y * c - z * s;
    const nz = y * s + z * c;
    y = ny;
    z = nz;
  }

  // Rotate Y
  {
    const c = Math.cos(ry);
    const s = Math.sin(ry);
    const nx = x * c + z * s;
    const nz = -x * s + z * c;
    x = nx;
    z = nz;
  }

  // Rotate Z
  {
    const c = Math.cos(rz);
    const s = Math.sin(rz);
    const nx = x * c - y * s;
    const ny = x * s + y * c;
    x = nx;
    y = ny;
  }

  return [x + tx, y + ty, z + tz];
}

function parseAsciiTriangles(buffer, scale, pose) {
  const text = buffer.toString("utf8");
  const vertexRegex =
    /vertex\s+([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)\s+([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)\s+([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)/g;

  const vertices = [];
  let match;
  while ((match = vertexRegex.exec(text)) !== null) {
    vertices.push(
      applyPose(
        [
          numeric(match[1]) * scale,
          numeric(match[2]) * scale,
          numeric(match[3]) * scale,
        ],
        pose,
      ),
    );
  }

  if (vertices.length === 0 || vertices.length % 3 !== 0) {
    throw new Error("Invalid ASCII STL content (vertex count is not a triangle multiple)");
  }

  const triangles = [];
  for (let i = 0; i < vertices.length; i += 3) {
    triangles.push([vertices[i], vertices[i + 1], vertices[i + 2]]);
  }
  return triangles;
}

function parseBinaryTriangles(buffer, scale, pose) {
  const count = buffer.readUInt32LE(80);
  const expectedLength = 84 + count * 50;
  if (buffer.length < expectedLength) {
    throw new Error("Invalid binary STL length");
  }

  const triangles = [];
  for (let i = 0; i < count; i += 1) {
    const off = 84 + i * 50 + 12; // Skip normal.
    const v0 = applyPose(
      [
        buffer.readFloatLE(off) * scale,
        buffer.readFloatLE(off + 4) * scale,
        buffer.readFloatLE(off + 8) * scale,
      ],
      pose,
    );
    const v1 = applyPose(
      [
        buffer.readFloatLE(off + 12) * scale,
        buffer.readFloatLE(off + 16) * scale,
        buffer.readFloatLE(off + 20) * scale,
      ],
      pose,
    );
    const v2 = applyPose(
      [
        buffer.readFloatLE(off + 24) * scale,
        buffer.readFloatLE(off + 28) * scale,
        buffer.readFloatLE(off + 32) * scale,
      ],
      pose,
    );
    triangles.push([v0, v1, v2]);
  }
  return triangles;
}

function subtract(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function norm(vector) {
  return Math.sqrt(dot(vector, vector));
}

function normalize(vector) {
  const n = norm(vector);
  if (n <= 1e-12) {
    throw new Error("Zero-length direction vector");
  }
  return [vector[0] / n, vector[1] / n, vector[2] / n];
}

function dedupeSorted(values, epsilon = 1e-5) {
  if (values.length === 0) {
    return values;
  }
  const out = [values[0]];
  for (let i = 1; i < values.length; i += 1) {
    if (Math.abs(values[i] - out[out.length - 1]) > epsilon) {
      out.push(values[i]);
    }
  }
  return out;
}

function rayTriangleIntersection(origin, direction, triangle, epsilon = 1e-7) {
  const [v0, v1, v2] = triangle;
  const edge1 = subtract(v1, v0);
  const edge2 = subtract(v2, v0);
  const pvec = cross(direction, edge2);
  const det = dot(edge1, pvec);

  if (Math.abs(det) < epsilon) {
    return null;
  }

  const invDet = 1 / det;
  const tvec = subtract(origin, v0);
  const u = dot(tvec, pvec) * invDet;
  if (u < -epsilon || u > 1 + epsilon) {
    return null;
  }

  const qvec = cross(tvec, edge1);
  const v = dot(direction, qvec) * invDet;
  if (v < -epsilon || u + v > 1 + epsilon) {
    return null;
  }

  const t = dot(edge2, qvec) * invDet;
  if (t <= epsilon) {
    return null;
  }
  return t;
}

export function loadStlGeometry(filePath, options = {}) {
  const inputUnit = options.inputUnit ?? "mm";
  const userScale = options.scaleToMm ?? 1;
  const watertightRequired = options.watertightRequired ?? true;
  const pose = options.pose ?? null;
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
  const triangles = binary
    ? parseBinaryTriangles(buffer, scale, pose)
    : parseAsciiTriangles(buffer, scale, pose);

  if (triangles.length === 0) {
    throw new Error("STL contains no triangles");
  }

  const edgeCounts = new Map();
  const vertexIndexByKey = new Map();
  let nextVertexIndex = 0;
  let volume = 0;
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

  for (const triangle of triangles) {
    const [v0, v1, v2] = triangle;
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
    triangles,
    triangle_count: triangles.length,
    vertex_count: vertexIndexByKey.size,
    mesh_bbox_x_mm: max[0] - min[0],
    mesh_bbox_y_mm: max[1] - min[1],
    mesh_bbox_z_mm: max[2] - min[2],
    mesh_volume_mm3: Math.abs(volume),
    watertight,
  };
}

export function loadStlMetrics(filePath, options = {}) {
  const { triangles, ...metrics } = loadStlGeometry(filePath, options);
  return metrics;
}

export function isPointInsideMesh(triangles, point) {
  const origin = point;
  const direction = normalize([1, 0.243271, 0.541829]);
  const intersections = [];
  for (const triangle of triangles) {
    const t = rayTriangleIntersection(origin, direction, triangle);
    if (t !== null && Number.isFinite(t)) {
      intersections.push(t);
    }
  }
  if (intersections.length === 0) {
    return false;
  }
  intersections.sort((a, b) => a - b);
  const unique = dedupeSorted(intersections, 1e-5);
  return unique.length % 2 === 1;
}

export function computeRayPathLengthMm(triangles, origin, direction, options = {}) {
  const dir = normalize(direction);
  const maxDistanceMm = Number.isFinite(options.maxDistanceMm)
    ? Math.max(0, options.maxDistanceMm)
    : Number.POSITIVE_INFINITY;

  const intersections = [];
  for (const triangle of triangles) {
    const t = rayTriangleIntersection(origin, dir, triangle);
    if (t === null || !Number.isFinite(t)) {
      continue;
    }
    if (t <= maxDistanceMm + 1e-7) {
      intersections.push(t);
    }
  }

  if (intersections.length === 0) {
    return 0;
  }

  intersections.sort((a, b) => a - b);
  const unique = dedupeSorted(intersections, 1e-5);
  const originInside =
    options.originInside !== undefined
      ? Boolean(options.originInside)
      : isPointInsideMesh(triangles, origin);

  const intervals = [];
  let start = originInside ? 0 : null;
  for (const t of unique) {
    if (start === null) {
      start = t;
    } else {
      intervals.push([start, t]);
      start = null;
    }
  }
  if (start !== null) {
    intervals.push([start, Number.POSITIVE_INFINITY]);
  }

  let total = 0;
  for (const [a0, b0] of intervals) {
    const a = Math.max(0, a0);
    const b = Math.min(maxDistanceMm, b0);
    if (b > a) {
      total += b - a;
    }
  }
  return total;
}
