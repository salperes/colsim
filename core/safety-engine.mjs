import { getBuildupFactor, getMuRhoCm2PerG } from "./material-db.mjs";
import { buildEnergySpectrum } from "./spectrum-engine.mjs";

function round(value, digits = 6) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }
  const p = 10 ** digits;
  return Math.round(value * p) / p;
}

function toAngleDegrees(x, y) {
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  return deg >= 0 ? deg : 360 + deg;
}

function buildBoundarySamples(boundary) {
  if (boundary.type === "ring") {
    const rows = [];
    for (let angle = 0; angle < 360; angle += 10) {
      rows.push({
        angle_deg: angle,
        radius_m: boundary.radius_m,
      });
    }
    return rows;
  }

  if (!Array.isArray(boundary.points_m)) {
    return [];
  }

  return boundary.points_m.map((point) => ({
    angle_deg: toAngleDegrees(point.x, point.y),
    radius_m: Math.sqrt(point.x * point.x + point.y * point.y + point.z * point.z),
  }));
}

function computeInstantDoseForRadius(input) {
  const {
    radius_m,
    density_g_cm3,
    thickness_mm,
    material,
    leakageFraction,
    conservativeFactor,
    sourceFactor,
    spectrum,
  } = input;

  const radius = Math.max(0.01, radius_m);
  // Leakage path is typically a small fraction of bulk thickness in analytic MVP mode.
  const x_cm = (Math.max(0.001, thickness_mm) / 10.0) * 0.02;
  const geometric = 1 / (radius * radius);

  let weightedTransmission = 0;
  for (const bin of spectrum) {
    const muRho = getMuRhoCm2PerG(material, bin.energy_MeV);
    const muLinear = muRho * density_g_cm3; // 1/cm
    const mfp = muLinear * x_cm;
    const buildup = getBuildupFactor(material, bin.energy_MeV, mfp);
    const attenuation = Math.exp(-mfp);
    weightedTransmission += bin.weight * buildup * attenuation;
  }

  const scale = 1e8;
  return (
    scale *
    leakageFraction *
    conservativeFactor *
    sourceFactor *
    geometric *
    weightedTransmission
  );
}

export function runSafety(projectConfig, geometryResult) {
  const safety = projectConfig.safety;
  if (safety.enable_boundary === false) {
    return {
      boundaryRows: [],
      boundary_max_uSv_h_inst: null,
      boundary_max_uSv_h_avg: null,
      boundary_pass: null,
      duty_factor: null,
      energy_bin_count: 0,
    };
  }

  const spectrum = buildEnergySpectrum(projectConfig.project.energy);
  const dutyFactor =
    (safety.duty_cycle.beam_on_s * safety.duty_cycle.scans_per_hour) / 3600.0;
  const leakageFraction = safety.leakage_fraction ?? 0.001;
  const conservativeFactor = safety.conservative_mode
    ? safety.conservative_factor ?? 1
    : 1;
  const sourceFactor = Math.max(0.2, projectConfig.source.diameter_mm / 4.0);
  const thicknessMm = Math.max(0.01, geometryResult.thickness_mm ?? 1);

  const samples = buildBoundarySamples(safety.boundary);
  const rows = [];
  let maxInst = 0;
  let maxAvg = 0;

  for (const sample of samples) {
    const angleRad = (sample.angle_deg * Math.PI) / 180;
    const directional = Math.max(0.2, 1 + 0.06 * Math.sin(3 * angleRad));
    const inst =
      computeInstantDoseForRadius({
        radius_m: sample.radius_m,
        density_g_cm3: safety.density_g_cm3,
        thickness_mm: thicknessMm,
        material: safety.material,
        leakageFraction,
        conservativeFactor,
        sourceFactor,
        spectrum,
      }) * directional;
    const avg = inst * dutyFactor;
    if (inst > maxInst) maxInst = inst;
    if (avg > maxAvg) maxAvg = avg;
    rows.push({
      angle_deg: round(sample.angle_deg, 3),
      dose_uSv_h_inst: round(inst),
      dose_uSv_h_avg: round(avg),
    });
  }

  return {
    boundaryRows: rows,
    boundary_max_uSv_h_inst: round(maxInst),
    boundary_max_uSv_h_avg: round(maxAvg),
    boundary_pass: maxAvg <= safety.limits.boundary_uSv_per_h,
    duty_factor: round(dutyFactor),
    energy_bin_count: spectrum.length,
  };
}
