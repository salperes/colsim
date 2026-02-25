import test from "node:test";
import assert from "node:assert/strict";
import { parseYamlFile } from "../lib/yaml-lite.mjs";
import { validateProjectConfig } from "../lib/project-validator.mjs";

test("parametric example validates cleanly", () => {
  const cfg = parseYamlFile("schemas/project.parametric2d.example.yaml");
  const errors = validateProjectConfig(cfg);
  assert.equal(errors.length, 0);
});

test("6 MeV requires conservative mode", () => {
  const cfg = parseYamlFile("schemas/project.parametric2d.example.yaml");
  cfg.project.energy.type = "MeV";
  cfg.project.energy.value = 6;
  cfg.safety.conservative_mode = false;
  const errors = validateProjectConfig(cfg);
  assert.ok(
    errors.some((msg) => msg.includes("safety.conservative_mode")),
    `expected conservative_mode error, got: ${errors.join(" | ")}`,
  );
});

test("unknown fields are rejected", () => {
  const cfg = parseYamlFile("schemas/project.parametric2d.example.yaml");
  cfg.geometry.extra_field = 123;
  const errors = validateProjectConfig(cfg);
  assert.ok(
    errors.some((msg) => msg.includes("geometry.extra_field")),
    `expected unknown field error, got: ${errors.join(" | ")}`,
  );
});
