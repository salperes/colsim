import fs from "node:fs";
import path from "node:path";

function parseCsv(text) {
  const lines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
  if (lines.length < 2) {
    return [];
  }
  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const values = lines[i].split(",").map((v) => v.trim());
    if (values.length !== headers.length) {
      continue;
    }
    const row = {};
    for (let j = 0; j < headers.length; j += 1) {
      row[headers[j]] = values[j];
    }
    rows.push(row);
  }
  return rows;
}

function clampIndex(index, maxLength) {
  if (index < 0) return 0;
  if (index >= maxLength) return maxLength - 1;
  return index;
}

function interpolateLinear(x, points, field) {
  if (points.length === 0) {
    return null;
  }
  if (points.length === 1) {
    return points[0][field];
  }
  if (x <= points[0].energy_MeV) {
    return points[0][field];
  }
  if (x >= points[points.length - 1].energy_MeV) {
    return points[points.length - 1][field];
  }

  let hi = 1;
  while (hi < points.length && points[hi].energy_MeV < x) {
    hi += 1;
  }
  hi = clampIndex(hi, points.length);
  const lo = hi - 1;
  const p0 = points[lo];
  const p1 = points[hi];
  const t = (x - p0.energy_MeV) / (p1.energy_MeV - p0.energy_MeV);
  return p0[field] + (p1[field] - p0[field]) * t;
}

function normalizeMaterial(material) {
  return String(material ?? "")
    .trim()
    .toLowerCase();
}

let cache = null;

function loadDb() {
  if (cache) {
    return cache;
  }

  const attenuationPath = path.resolve("data/xcom_cache/attenuation_sample.csv");
  const buildupPath = path.resolve("data/buildup_gp/gp_sample.csv");
  const attenuationRows = parseCsv(fs.readFileSync(attenuationPath, "utf8"));
  const buildupRows = parseCsv(fs.readFileSync(buildupPath, "utf8"));

  const attenuationByMaterial = new Map();
  for (const row of attenuationRows) {
    const material = normalizeMaterial(row.material);
    const point = {
      energy_MeV: Number(row.energy_MeV),
      mu_rho_cm2_g: Number(row.mu_rho_cm2_g),
    };
    if (!Number.isFinite(point.energy_MeV) || !Number.isFinite(point.mu_rho_cm2_g)) {
      continue;
    }
    if (!attenuationByMaterial.has(material)) {
      attenuationByMaterial.set(material, []);
    }
    attenuationByMaterial.get(material).push(point);
  }
  for (const points of attenuationByMaterial.values()) {
    points.sort((a, b) => a.energy_MeV - b.energy_MeV);
  }

  const buildupByMaterial = new Map();
  for (const row of buildupRows) {
    const material = normalizeMaterial(row.material);
    const point = {
      energy_MeV: Number(row.energy_MeV),
      b0: Number(row.b0),
      b1: Number(row.b1),
    };
    if (!Number.isFinite(point.energy_MeV) || !Number.isFinite(point.b0) || !Number.isFinite(point.b1)) {
      continue;
    }
    if (!buildupByMaterial.has(material)) {
      buildupByMaterial.set(material, []);
    }
    buildupByMaterial.get(material).push(point);
  }
  for (const points of buildupByMaterial.values()) {
    points.sort((a, b) => a.energy_MeV - b.energy_MeV);
  }

  cache = {
    attenuationByMaterial,
    buildupByMaterial,
  };
  return cache;
}

export function getMuRhoCm2PerG(material, energyMeV) {
  const db = loadDb();
  const points = db.attenuationByMaterial.get(normalizeMaterial(material));
  if (!points || points.length === 0) {
    throw new Error(`No attenuation data for material '${material}'`);
  }
  const value = interpolateLinear(energyMeV, points, "mu_rho_cm2_g");
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid attenuation interpolation for material '${material}'`);
  }
  return value;
}

export function getBuildupFactor(material, energyMeV, mfp) {
  const db = loadDb();
  const points = db.buildupByMaterial.get(normalizeMaterial(material));
  if (!points || points.length === 0) {
    throw new Error(`No buildup data for material '${material}'`);
  }
  const b0 = interpolateLinear(energyMeV, points, "b0");
  const b1 = interpolateLinear(energyMeV, points, "b1");
  if (!Number.isFinite(b0) || !Number.isFinite(b1)) {
    throw new Error(`Invalid buildup interpolation for material '${material}'`);
  }
  const clampedMfp = Math.max(0, mfp);
  return 1 + b0 * (1 - Math.exp(-b1 * clampedMfp));
}
