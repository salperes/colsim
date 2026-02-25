import test from "node:test";
import assert from "node:assert/strict";
import {
  computeRayPathLengthMm,
  loadStlGeometry,
  loadStlMetrics,
} from "../core/stl-metrics.mjs";

test("loadStlMetrics computes expected bbox and volume for cube fixture", () => {
  const metrics = loadStlMetrics("data/meshes/disk_collimator_v1.stl", {
    inputUnit: "mm",
    scaleToMm: 1,
    watertightRequired: true,
  });
  assert.equal(metrics.watertight, true);
  assert.equal(metrics.mesh_bbox_x_mm, 10);
  assert.equal(metrics.mesh_bbox_y_mm, 10);
  assert.equal(metrics.mesh_bbox_z_mm, 10);
  assert.ok(Math.abs(metrics.mesh_volume_mm3 - 1000) < 1e-6);
});

test("loadStlMetrics fails for non-watertight mesh when required", () => {
  assert.throws(
    () =>
      loadStlMetrics("data/meshes/open_triangle.stl", {
        inputUnit: "mm",
        scaleToMm: 1,
        watertightRequired: true,
      }),
    /not watertight/i,
  );
});

test("computeRayPathLengthMm returns expected segment through cube", () => {
  const geometry = loadStlGeometry("data/meshes/disk_collimator_v1.stl", {
    inputUnit: "mm",
    scaleToMm: 1,
    watertightRequired: true,
  });
  const length = computeRayPathLengthMm(
    geometry.triangles,
    [-5, 5, 5],
    [1, 0, 0],
    { maxDistanceMm: 100 },
  );
  assert.ok(Math.abs(length - 10) < 1e-4, `expected ~10, got ${length}`);
});
