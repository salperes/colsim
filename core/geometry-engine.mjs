import { loadStlMetrics } from "./stl-metrics.mjs";

function round(value, digits = 6) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }
  const p = 10 ** digits;
  return Math.round(value * p) / p;
}

function makeProfileRows(fwhm, beamCore) {
  const sigma = Math.max(fwhm / 2.355, 0.1);
  const halfCore = beamCore / 2;
  const rows = [];
  for (let x = -30; x <= 30; x += 1) {
    const edgeDistance = Math.max(0, Math.abs(x) - halfCore);
    const fluence = Math.exp(-(edgeDistance * edgeDistance) / (2 * sigma * sigma));
    rows.push({ x_mm: x, fluence_norm: round(fluence, 6) });
  }
  return rows;
}

function apertureEquivalentFromBbox(metrics, method) {
  const x = metrics.mesh_bbox_x_mm;
  const y = metrics.mesh_bbox_y_mm;
  const z = metrics.mesh_bbox_z_mm;
  if (method === "projected_area") {
    const area = Math.max(1e-9, x * y);
    return 2 * Math.sqrt(area / Math.PI);
  }
  if (method === "minimum_clearance") {
    return Math.max(1e-9, Math.min(x, y, z));
  }
  return Math.max(1e-9, Math.min(x, y));
}

export function runGeometry(projectConfig, options = {}) {
  const geometry = projectConfig.geometry;
  const source = projectConfig.source;
  const mode = projectConfig.project.mode;
  const metrics = {
    beam_core_width_mm: null,
    FWHM_mm: null,
    penumbra_10_90_mm: null,
    integral_fluence_norm: 1,
    uniformity_percent: null,
    mesh_bbox_x_mm: null,
    mesh_bbox_y_mm: null,
    mesh_bbox_z_mm: null,
    mesh_volume_mm3: null,
    aperture_equivalent_mm: null,
  };

  if (geometry.type === "parametric_2d") {
    const effectiveDistance = Math.max(geometry.sdd_mm - geometry.thickness_mm, 1);
    const magnification = geometry.sdd_mm / effectiveDistance;
    const beamCore = geometry.slit_mm * magnification;
    const penumbra = source.diameter_mm * magnification;
    const fwhm = beamCore + 0.5 * penumbra;

    metrics.beam_core_width_mm = round(beamCore);
    metrics.FWHM_mm = round(fwhm);
    metrics.penumbra_10_90_mm = round(penumbra);
    metrics.aperture_equivalent_mm = round(beamCore);
    if (mode === "fan_beam") {
      metrics.uniformity_percent = round(Math.max(0, 100 - penumbra * 0.3), 3);
    }

    return {
      metrics,
      profileRows: makeProfileRows(fwhm, beamCore),
      thickness_mm: geometry.thickness_mm,
    };
  }

  if (geometry.type === "mesh_3d") {
    const stl = loadStlMetrics(geometry.mesh.path, {
      inputUnit: geometry.mesh.input_unit,
      scaleToMm: geometry.mesh.scale_to_mm,
      watertightRequired: geometry.mesh.watertight_required,
    });

    const apertureEquivalent = apertureEquivalentFromBbox(
      stl,
      geometry.aperture_equivalent_method,
    );
    const beamCore = apertureEquivalent;
    const penumbra = source.diameter_mm * 0.8;
    const fwhm = beamCore + penumbra * 0.35;

    metrics.beam_core_width_mm = round(beamCore);
    metrics.FWHM_mm = round(fwhm);
    metrics.penumbra_10_90_mm = round(penumbra);
    metrics.mesh_bbox_x_mm = round(stl.mesh_bbox_x_mm);
    metrics.mesh_bbox_y_mm = round(stl.mesh_bbox_y_mm);
    metrics.mesh_bbox_z_mm = round(stl.mesh_bbox_z_mm);
    metrics.mesh_volume_mm3 = round(stl.mesh_volume_mm3);
    metrics.aperture_equivalent_mm = round(apertureEquivalent);
    if (mode === "fan_beam") {
      metrics.uniformity_percent = round(Math.max(0, 98 - penumbra * 0.25), 3);
    }

    return {
      metrics,
      profileRows: makeProfileRows(fwhm, beamCore),
      thickness_mm: stl.mesh_bbox_z_mm,
      stl,
    };
  }

  throw new Error(`Unsupported geometry.type: ${geometry.type}`);
}
