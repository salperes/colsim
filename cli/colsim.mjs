#!/usr/bin/env node

import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseYamlFile } from "../lib/yaml-lite.mjs";
import { validateProjectConfig } from "../lib/project-validator.mjs";
import { runGeometry } from "../core/geometry-engine.mjs";
import { runSafety } from "../core/safety-engine.mjs";
import { loadStlMetrics } from "../core/stl-metrics.mjs";
import { ensureDir, resolveOutDirs, writeCsv, writeText } from "../lib/io-utils.mjs";

function usage() {
  console.log("Usage:");
  console.log("  node cli/colsim.mjs validate <project.yaml>");
  console.log("  node cli/colsim.mjs run <project.yaml> [--out <directory>]");
}

function loadProject(filePath) {
  return parseYamlFile(filePath);
}

function resolveProjectPaths(config, projectPath) {
  const projectDir = path.dirname(path.resolve(projectPath));
  const next = structuredClone(config);
  if (next.geometry?.type === "mesh_3d" && typeof next.geometry.mesh?.path === "string") {
    if (!path.isAbsolute(next.geometry.mesh.path)) {
      next.geometry.mesh.path = path.resolve(projectDir, next.geometry.mesh.path);
    }
  }
  return next;
}

function validateMeshGeometry(config) {
  if (config.geometry?.type !== "mesh_3d") {
    return [];
  }
  try {
    loadStlMetrics(config.geometry.mesh.path, {
      inputUnit: config.geometry.mesh.input_unit,
      scaleToMm: config.geometry.mesh.scale_to_mm,
      watertightRequired: config.geometry.mesh.watertight_required,
    });
    return [];
  } catch (error) {
    return [`geometry.mesh.path: ${String(error.message || error)}`];
  }
}

function printValidationErrors(errors) {
  for (const error of errors) {
    console.error(`- ${error}`);
  }
}

function validateProject(projectPath) {
  let config;
  try {
    config = resolveProjectPaths(loadProject(projectPath), projectPath);
  } catch (error) {
    console.error(`YAML parse failed: ${String(error.message || error)}`);
    return 1;
  }

  const errors = [
    ...validateProjectConfig(config),
    ...validateMeshGeometry(config),
  ];
  if (errors.length > 0) {
    console.error(`Validation failed for ${projectPath}:`);
    printValidationErrors(errors);
    return 1;
  }

  console.log(`Validation OK: ${projectPath}`);
  return 0;
}

function runProject(projectPath, outDir) {
  let config;
  try {
    config = resolveProjectPaths(loadProject(projectPath), projectPath);
  } catch (error) {
    console.error(`YAML parse failed: ${String(error.message || error)}`);
    return 1;
  }

  const errors = [
    ...validateProjectConfig(config),
    ...validateMeshGeometry(config),
  ];
  if (errors.length > 0) {
    console.error(`Validation failed for ${projectPath}:`);
    printValidationErrors(errors);
    return 1;
  }

  let geometryResult;
  try {
    geometryResult = runGeometry(config);
  } catch (error) {
    console.error(`Geometry failed: ${String(error.message || error)}`);
    return 1;
  }

  const safetyResult = runSafety(config, geometryResult);

  const dirs = resolveOutDirs(outDir);
  ensureDir(dirs.resultsDir);
  ensureDir(dirs.logsDir);

  const metricsRow = {
    ...geometryResult.metrics,
    boundary_max_uSv_h_inst: safetyResult.boundary_max_uSv_h_inst,
    boundary_max_uSv_h_avg: safetyResult.boundary_max_uSv_h_avg,
    boundary_pass: safetyResult.boundary_pass,
    phase1_geometry_only: config.runtime?.phase1_geometry_only === true,
  };

  const metricsHeaders = [
    "beam_core_width_mm",
    "FWHM_mm",
    "penumbra_10_90_mm",
    "integral_fluence_norm",
    "uniformity_percent",
    "mesh_bbox_x_mm",
    "mesh_bbox_y_mm",
    "mesh_bbox_z_mm",
    "mesh_volume_mm3",
    "aperture_equivalent_mm",
    "boundary_max_uSv_h_inst",
    "boundary_max_uSv_h_avg",
    "boundary_pass",
    "phase1_geometry_only",
  ];

  const profileHeaders = ["x_mm", "fluence_norm"];
  const boundaryHeaders = ["angle_deg", "dose_uSv_h_inst", "dose_uSv_h_avg"];

  writeCsv(path.join(dirs.resultsDir, "metrics.csv"), metricsHeaders, [metricsRow]);
  writeCsv(path.join(dirs.resultsDir, "profile_1d.csv"), profileHeaders, geometryResult.profileRows);
  writeCsv(
    path.join(dirs.resultsDir, "boundary_map.csv"),
    boundaryHeaders,
    safetyResult.boundaryRows,
  );

  const logLines = [
    `timestamp=${new Date().toISOString()}`,
    `command=run`,
    `input=${projectPath}`,
    `mode=${config.project.mode}`,
    `energy=${config.project.energy.value}${config.project.energy.type}`,
    `geometry_type=${config.geometry.type}`,
    `phase1_geometry_only=${config.runtime?.phase1_geometry_only === true}`,
    `boundary_enabled=${config.safety.enable_boundary}`,
    `boundary_rows=${safetyResult.boundaryRows.length}`,
    `boundary_pass=${metricsRow.boundary_pass}`,
    `energy_bins=${safetyResult.energy_bin_count}`,
  ];
  writeText(path.join(dirs.logsDir, "run.log"), `${logLines.join("\n")}\n`);

  console.log(`Run OK: ${projectPath}`);
  console.log(`Output: ${path.join(dirs.resultsDir, "metrics.csv")}`);
  return 0;
}

function parseOutDir(args, fallback) {
  const idx = args.indexOf("--out");
  if (idx < 0) {
    return fallback;
  }
  if (idx + 1 >= args.length) {
    throw new Error("--out requires a directory value");
  }
  return args[idx + 1];
}

export function main(argv) {
  const args = argv.slice(2);
  if (args.length < 2) {
    usage();
    return 1;
  }

  const command = args[0];
  const projectPath = args[1];

  if (command === "validate") {
    return validateProject(projectPath);
  }

  if (command === "run") {
    try {
      const outDir = parseOutDir(args, process.cwd());
      return runProject(projectPath, outDir);
    } catch (error) {
      console.error(String(error.message || error));
      return 1;
    }
  }

  usage();
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv));
}
