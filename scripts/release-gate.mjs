#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { parseYamlFile } from "../lib/yaml-lite.mjs";
import { validateProjectConfig } from "../lib/project-validator.mjs";
import { loadStlMetrics } from "../core/stl-metrics.mjs";
import { main as colsimMain } from "../cli/colsim.mjs";

function nowIsoCompact() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function runCheck(label, fn) {
  const startedAt = new Date().toISOString();
  try {
    fn();
    return {
      step: label,
      code: 0,
      started_at: startedAt,
      ended_at: new Date().toISOString(),
      stdout: "PASS",
      stderr: "",
    };
  } catch (error) {
    return {
      step: label,
      code: 1,
      started_at: startedAt,
      ended_at: new Date().toISOString(),
      stdout: "",
      stderr: String(error?.stack || error?.message || error),
    };
  }
}

function checkYamlParse() {
  parseYamlFile("schemas/project.schema.yaml");
  parseYamlFile("schemas/project.parametric2d.example.yaml");
  parseYamlFile("schemas/project.mesh3d.example.yaml");
}

function checkValidator() {
  const parametric = parseYamlFile("schemas/project.parametric2d.example.yaml");
  const mesh = parseYamlFile("schemas/project.mesh3d.example.yaml");
  assert.equal(validateProjectConfig(parametric).length, 0);
  assert.equal(validateProjectConfig(mesh).length, 0);

  parametric.project.energy.type = "MeV";
  parametric.project.energy.value = 6;
  parametric.safety.conservative_mode = false;
  const errors = validateProjectConfig(parametric);
  assert.ok(errors.some((e) => e.includes("safety.conservative_mode")));
}

function checkStl() {
  const metrics = loadStlMetrics("data/meshes/disk_collimator_v1.stl", {
    inputUnit: "mm",
    scaleToMm: 1,
    watertightRequired: true,
  });
  assert.equal(metrics.watertight, true);
  assert.ok(Math.abs(metrics.mesh_volume_mm3 - 1000) < 1e-6);
  assert.throws(
    () =>
      loadStlMetrics("data/meshes/open_triangle.stl", {
        inputUnit: "mm",
        scaleToMm: 1,
        watertightRequired: true,
      }),
    /watertight/i,
  );
}

function checkCliValidate() {
  const a = colsimMain(["node", "cli/colsim.mjs", "validate", "schemas/project.parametric2d.example.yaml"]);
  const b = colsimMain(["node", "cli/colsim.mjs", "validate", "schemas/project.mesh3d.example.yaml"]);
  assert.equal(a, 0);
  assert.equal(b, 0);
}

function checkCliRun() {
  fs.rmSync(path.resolve("out/release-parametric"), { recursive: true, force: true });
  fs.rmSync(path.resolve("out/release-mesh"), { recursive: true, force: true });

  const a = colsimMain([
    "node",
    "cli/colsim.mjs",
    "run",
    "schemas/project.parametric2d.example.yaml",
    "--out",
    "out/release-parametric",
  ]);
  const b = colsimMain([
    "node",
    "cli/colsim.mjs",
    "run",
    "schemas/project.mesh3d.example.yaml",
    "--out",
    "out/release-mesh",
  ]);
  assert.equal(a, 0);
  assert.equal(b, 0);

  const required = [
    "out/release-parametric/results/metrics.csv",
    "out/release-parametric/results/profile_1d.csv",
    "out/release-parametric/results/boundary_map.csv",
    "out/release-parametric/logs/run.log",
    "out/release-mesh/results/metrics.csv",
    "out/release-mesh/results/profile_1d.csv",
    "out/release-mesh/results/boundary_map.csv",
    "out/release-mesh/logs/run.log",
  ];
  for (const f of required) {
    assert.equal(fs.existsSync(path.resolve(f)), true, `missing output: ${f}`);
  }
}

function writeReport(payload) {
  const reportsDir = path.resolve("reports");
  fs.mkdirSync(reportsDir, { recursive: true });
  const named = path.join(reportsDir, `release-gate-v0.1.0-${nowIsoCompact()}.json`);
  const latest = path.join(reportsDir, "release-gate-latest.json");
  fs.writeFileSync(named, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  fs.writeFileSync(latest, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return named;
}

function main() {
  const checks = [
    { label: "YAML parser smoke validation", fn: checkYamlParse },
    { label: "Project validator rules", fn: checkValidator },
    { label: "STL metrics and watertight validation", fn: checkStl },
    { label: "CLI validate", fn: checkCliValidate },
    { label: "CLI run and output contract", fn: checkCliRun },
  ];

  const results = [];
  let ok = true;
  for (let i = 0; i < checks.length; i += 1) {
    const { label, fn } = checks[i];
    console.log(`[${i + 1}/${checks.length}] ${label}`);
    const result = runCheck(label, fn);
    results.push(result);
    if (result.code === 0) {
      console.log(`PASS: ${label}`);
    } else {
      ok = false;
      console.error(`FAILED: ${label}`);
      break;
    }
  }

  const payload = {
    version: "0.1.0",
    status: ok ? "pass" : "fail",
    generated_at: new Date().toISOString(),
    results,
  };
  const report = writeReport(payload);
  console.log(`Report: ${report}`);
  if (!ok) {
    process.exit(1);
  }
}

main();
