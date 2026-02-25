import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { main as colsimMain } from "../cli/colsim.mjs";

function runColsim(args) {
  return colsimMain(["node", "cli/colsim.mjs", ...args]);
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

test("validate command succeeds for all shipped examples", () => {
  const a = runColsim(["validate", "schemas/project.parametric2d.example.yaml"]);
  assert.equal(a, 0);
  const b = runColsim(["validate", "schemas/project.mesh3d.example.yaml"]);
  assert.equal(b, 0);
  const c = runColsim(["validate", "schemas/project.mesh3d.phase2.example.yaml"]);
  assert.equal(c, 0);
});

test("run command produces contract outputs for parametric case", () => {
  const outDir = path.resolve("out/test-parametric");
  fs.rmSync(outDir, { recursive: true, force: true });

  const code = runColsim([
    "run",
    "schemas/project.parametric2d.example.yaml",
    "--out",
    outDir,
  ]);
  assert.equal(code, 0);

  const metrics = path.join(outDir, "results/metrics.csv");
  const profile = path.join(outDir, "results/profile_1d.csv");
  const boundary = path.join(outDir, "results/boundary_map.csv");
  const log = path.join(outDir, "logs/run.log");

  assert.equal(fs.existsSync(metrics), true);
  assert.equal(fs.existsSync(profile), true);
  assert.equal(fs.existsSync(boundary), true);
  assert.equal(fs.existsSync(log), true);

  const metricsText = readText(metrics);
  assert.match(metricsText, /beam_core_width_mm/);
  assert.match(metricsText, /boundary_pass/);
});

test("mesh phase-1 run creates boundary header-only output", () => {
  const outDir = path.resolve("out/test-mesh");
  fs.rmSync(outDir, { recursive: true, force: true });

  const code = runColsim([
    "run",
    "schemas/project.mesh3d.example.yaml",
    "--out",
    outDir,
  ]);
  assert.equal(code, 0);

  const boundary = path.join(outDir, "results/boundary_map.csv");
  const boundaryText = readText(boundary).trim();
  assert.equal(boundaryText, "angle_deg,dose_uSv_h_inst,dose_uSv_h_avg");
});

test("mesh phase-2 run creates populated boundary output", () => {
  const outDir = path.resolve("out/test-mesh-phase2");
  fs.rmSync(outDir, { recursive: true, force: true });

  const code = runColsim([
    "run",
    "schemas/project.mesh3d.phase2.example.yaml",
    "--out",
    outDir,
  ]);
  assert.equal(code, 0);

  const boundary = path.join(outDir, "results/boundary_map.csv");
  const metrics = path.join(outDir, "results/metrics.csv");
  const boundaryLines = readText(boundary).trim().split(/\r?\n/);
  assert.ok(boundaryLines.length > 2, "phase2 boundary map should contain data rows");

  const lines = readText(metrics).trim().split(/\r?\n/);
  const headers = lines[0].split(",");
  const values = lines[1].split(",");
  const idxInst = headers.indexOf("boundary_max_uSv_h_inst");
  const idxAvg = headers.indexOf("boundary_max_uSv_h_avg");
  const idxPass = headers.indexOf("boundary_pass");
  assert.ok(idxInst >= 0 && idxAvg >= 0 && idxPass >= 0, "boundary columns must exist");
  assert.notEqual(values[idxInst], "", "boundary inst must be populated");
  assert.notEqual(values[idxAvg], "", "boundary avg must be populated");
  assert.ok(values[idxPass] === "true" || values[idxPass] === "false");
});
