function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function pushError(errors, path, message) {
  errors.push(`${path}: ${message}`);
}

function reportUnknownKeys(obj, allowedKeys, path, errors) {
  if (!isObject(obj)) {
    return;
  }
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) {
      pushError(errors, `${path}.${key}`, "is not allowed");
    }
  }
}

function expectObject(parent, key, path, errors) {
  if (!isObject(parent) || !(key in parent)) {
    pushError(errors, `${path}.${key}`, "required object is missing");
    return null;
  }
  const value = parent[key];
  if (!isObject(value)) {
    pushError(errors, `${path}.${key}`, "must be an object");
    return null;
  }
  return value;
}

function expectString(parent, key, path, errors, options = {}) {
  if (!isObject(parent) || !(key in parent)) {
    pushError(errors, `${path}.${key}`, "is required");
    return null;
  }
  const value = parent[key];
  if (typeof value !== "string" || value.trim() === "") {
    pushError(errors, `${path}.${key}`, "must be a non-empty string");
    return null;
  }
  if (options.enum && !options.enum.includes(value)) {
    pushError(errors, `${path}.${key}`, `must be one of: ${options.enum.join(", ")}`);
    return null;
  }
  return value;
}

function expectBoolean(parent, key, path, errors, options = {}) {
  if (!isObject(parent) || !(key in parent)) {
    if (!options.optional) {
      pushError(errors, `${path}.${key}`, "is required");
    }
    return null;
  }
  const value = parent[key];
  if (typeof value !== "boolean") {
    pushError(errors, `${path}.${key}`, "must be boolean");
    return null;
  }
  return value;
}

function expectNumber(parent, key, path, errors, options = {}) {
  if (!isObject(parent) || !(key in parent)) {
    if (!options.optional) {
      pushError(errors, `${path}.${key}`, "is required");
    }
    return null;
  }
  const value = parent[key];
  if (typeof value !== "number" || Number.isNaN(value)) {
    pushError(errors, `${path}.${key}`, "must be a number");
    return null;
  }
  if (options.gt !== undefined && !(value > options.gt)) {
    pushError(errors, `${path}.${key}`, `must be > ${options.gt}`);
    return null;
  }
  if (options.gte !== undefined && !(value >= options.gte)) {
    pushError(errors, `${path}.${key}`, `must be >= ${options.gte}`);
    return null;
  }
  if (options.lte !== undefined && !(value <= options.lte)) {
    pushError(errors, `${path}.${key}`, `must be <= ${options.lte}`);
    return null;
  }
  return value;
}

function validateProject(project, errors) {
  reportUnknownKeys(project, ["name", "mode", "energy"], "project", errors);
  expectString(project, "name", "project", errors);
  expectString(project, "mode", "project", errors, {
    enum: ["pencil_beam", "fan_beam"],
  });

  const energy = expectObject(project, "energy", "project", errors);
  if (!energy) {
    return { energyType: null, energyValue: null };
  }
  reportUnknownKeys(energy, ["type", "value"], "project.energy", errors);
  const energyType = expectString(energy, "type", "project.energy", errors, {
    enum: ["kV", "MeV"],
  });
  const energyValue = expectNumber(energy, "value", "project.energy", errors, { gt: 0 });
  return { energyType, energyValue };
}

function validateSource(source, errors) {
  reportUnknownKeys(source, ["diameter_mm", "spectrum"], "source", errors);
  expectNumber(source, "diameter_mm", "source", errors, { gt: 0 });
  expectString(source, "spectrum", "source", errors);
}

function validateGeometryParametric(geometry, errors) {
  reportUnknownKeys(
    geometry,
    [
      "type",
      "slit_mm",
      "inner_diameter_mm",
      "outer_diameter_mm",
      "thickness_mm",
      "sdd_mm",
    ],
    "geometry",
    errors,
  );
  expectNumber(geometry, "slit_mm", "geometry", errors, { gt: 0 });
  expectNumber(geometry, "inner_diameter_mm", "geometry", errors, { gt: 0 });
  expectNumber(geometry, "outer_diameter_mm", "geometry", errors, { gt: 0 });
  expectNumber(geometry, "thickness_mm", "geometry", errors, { gt: 0 });
  expectNumber(geometry, "sdd_mm", "geometry", errors, { gt: 0 });
}

function validateGeometryMesh(geometry, errors) {
  reportUnknownKeys(
    geometry,
    ["type", "sdd_mm", "mesh", "aperture_equivalent_method"],
    "geometry",
    errors,
  );
  expectNumber(geometry, "sdd_mm", "geometry", errors, { gt: 0 });
  expectString(geometry, "aperture_equivalent_method", "geometry", errors, {
    enum: ["projected_area", "minimum_clearance"],
  });

  const mesh = expectObject(geometry, "mesh", "geometry", errors);
  if (!mesh) {
    return;
  }
  reportUnknownKeys(
    mesh,
    ["path", "format", "input_unit", "scale_to_mm", "watertight_required", "pose"],
    "geometry.mesh",
    errors,
  );
  expectString(mesh, "path", "geometry.mesh", errors);
  expectString(mesh, "format", "geometry.mesh", errors, { enum: ["stl"] });
  expectString(mesh, "input_unit", "geometry.mesh", errors, {
    enum: ["mm", "cm", "m", "inch"],
  });
  expectNumber(mesh, "scale_to_mm", "geometry.mesh", errors, { gt: 0 });
  const watertightRequired = expectBoolean(mesh, "watertight_required", "geometry.mesh", errors);
  if (watertightRequired !== null && watertightRequired !== true) {
    pushError(errors, "geometry.mesh.watertight_required", "must be true for Phase-1");
  }

  if ("pose" in mesh && mesh.pose !== null) {
    if (!isObject(mesh.pose)) {
      pushError(errors, "geometry.mesh.pose", "must be an object when provided");
      return;
    }
    reportUnknownKeys(
      mesh.pose,
      ["tx_mm", "ty_mm", "tz_mm", "rx_deg", "ry_deg", "rz_deg"],
      "geometry.mesh.pose",
      errors,
    );
    const poseFields = ["tx_mm", "ty_mm", "tz_mm", "rx_deg", "ry_deg", "rz_deg"];
    for (const key of poseFields) {
      if (key in mesh.pose) {
        expectNumber(mesh.pose, key, "geometry.mesh.pose", errors);
      }
    }
  }
}

function validateGeometry(geometry, errors) {
  const geometryType = expectString(geometry, "type", "geometry", errors, {
    enum: ["parametric_2d", "mesh_3d"],
  });
  if (!geometryType) {
    return null;
  }
  if (geometryType === "parametric_2d") {
    validateGeometryParametric(geometry, errors);
  } else {
    validateGeometryMesh(geometry, errors);
  }
  return geometryType;
}

function validateBoundary(boundary, errors) {
  reportUnknownKeys(boundary, ["type", "radius_m", "points_m"], "safety.boundary", errors);
  const type = expectString(boundary, "type", "safety.boundary", errors, {
    enum: ["ring", "points"],
  });
  if (!type) {
    return;
  }

  if (type === "ring") {
    expectNumber(boundary, "radius_m", "safety.boundary", errors, { gt: 0 });
  }

  if (type === "points") {
    if (!("points_m" in boundary)) {
      pushError(errors, "safety.boundary.points_m", "is required when boundary.type=points");
      return;
    }
    if (!Array.isArray(boundary.points_m) || boundary.points_m.length === 0) {
      pushError(errors, "safety.boundary.points_m", "must be a non-empty array");
      return;
    }
    for (let i = 0; i < boundary.points_m.length; i += 1) {
      const point = boundary.points_m[i];
      const p = `safety.boundary.points_m[${i}]`;
      if (!isObject(point)) {
        pushError(errors, p, "must be an object");
        continue;
      }
      reportUnknownKeys(point, ["x", "y", "z"], p, errors);
      expectNumber(point, "x", p, errors);
      expectNumber(point, "y", p, errors);
      expectNumber(point, "z", p, errors);
    }
  }
}

function validateSafety(safety, errors) {
  reportUnknownKeys(
    safety,
    [
      "material",
      "density_g_cm3",
      "duty_cycle",
      "boundary",
      "limits",
      "conservative_mode",
      "conservative_factor",
      "leakage_fraction",
      "enable_boundary",
    ],
    "safety",
    errors,
  );
  expectString(safety, "material", "safety", errors);
  expectNumber(safety, "density_g_cm3", "safety", errors, { gt: 0 });
  expectBoolean(safety, "conservative_mode", "safety", errors);
  expectBoolean(safety, "enable_boundary", "safety", errors);
  expectNumber(safety, "conservative_factor", "safety", errors, { gt: 0, optional: true });
  expectNumber(safety, "leakage_fraction", "safety", errors, {
    gte: 0,
    lte: 1,
    optional: true,
  });

  const dutyCycle = expectObject(safety, "duty_cycle", "safety", errors);
  if (dutyCycle) {
    reportUnknownKeys(dutyCycle, ["beam_on_s", "scans_per_hour"], "safety.duty_cycle", errors);
    expectNumber(dutyCycle, "beam_on_s", "safety.duty_cycle", errors, { gt: 0 });
    expectNumber(dutyCycle, "scans_per_hour", "safety.duty_cycle", errors, { gte: 0 });
  }

  const boundary = expectObject(safety, "boundary", "safety", errors);
  if (boundary) {
    validateBoundary(boundary, errors);
  }

  const limits = expectObject(safety, "limits", "safety", errors);
  if (limits) {
    reportUnknownKeys(
      limits,
      ["boundary_uSv_per_h", "operator_uSv_per_h"],
      "safety.limits",
      errors,
    );
    expectNumber(limits, "boundary_uSv_per_h", "safety.limits", errors, { gt: 0 });
    expectNumber(limits, "operator_uSv_per_h", "safety.limits", errors, { gt: 0 });
  }
}

export function validateProjectConfig(config) {
  const errors = [];
  if (!isObject(config)) {
    return ["root: YAML root must be an object"];
  }

  reportUnknownKeys(config, ["project", "source", "geometry", "safety", "runtime"], "root", errors);

  const project = expectObject(config, "project", "root", errors);
  const source = expectObject(config, "source", "root", errors);
  const geometry = expectObject(config, "geometry", "root", errors);
  const safety = expectObject(config, "safety", "root", errors);

  let energyType = null;
  let energyValue = null;
  if (project) {
    const projectInfo = validateProject(project, errors);
    energyType = projectInfo.energyType;
    energyValue = projectInfo.energyValue;
  }
  if (source) {
    validateSource(source, errors);
  }
  if (geometry) {
    validateGeometry(geometry, errors);
  }
  if (safety) {
    validateSafety(safety, errors);
  }

  if (energyType === "MeV" && energyValue === 6 && safety && safety.conservative_mode !== true) {
    pushError(
      errors,
      "safety.conservative_mode",
      "must be true when project.energy is 6 MeV",
    );
  }

  if ("runtime" in config && config.runtime !== null) {
    if (!isObject(config.runtime)) {
      pushError(errors, "runtime", "must be an object when provided");
    } else {
      reportUnknownKeys(config.runtime, ["phase1_geometry_only"], "runtime", errors);
      expectBoolean(config.runtime, "phase1_geometry_only", "runtime", errors, {
        optional: true,
      });
    }
  }

  if (
    config.runtime &&
    config.runtime.phase1_geometry_only === true &&
    safety &&
    safety.enable_boundary !== false
  ) {
    pushError(
      errors,
      "safety.enable_boundary",
      "must be false when runtime.phase1_geometry_only=true",
    );
  }

  return errors;
}
