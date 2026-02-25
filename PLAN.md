# PLAN - ColSim 0.2.0 (Faz-2 Baslangic)

## Scope

- 0.1.0 baseline uzerine mesh_3d Faz-2 ray-path boundary hesaplari
- sema/validator ve ornek proje dosyalari
- test ve release-gate guncellemesi

## Implemented

1. `core/stl-metrics.mjs` ray-casting fonksiyonlari eklendi.
2. `core/geometry-engine.mjs` STL ucgen geometrisini safety katmanina aktarir hale getirildi.
3. `core/safety-engine.mjs` mesh_3d boundary hesabinda ray-path kalinligi kullanir hale getirildi.
4. `source.position_mm` ve `boundary.z_m` sema/validator destegi eklendi.
5. `schemas/project.mesh3d.phase2.example.yaml` eklendi.
6. Testler Faz-2 kapsamiyla genisletildi.
7. `scripts/release-gate.mjs` version-aware hale getirildi (`VERSION` dosyasindan okur).

## Test Evidence

- `node --test --test-isolation=none tests/*.test.mjs` -> PASS
- `node tools/yaml-validate.mjs schemas/project.schema.yaml schemas/project.parametric2d.example.yaml schemas/project.mesh3d.example.yaml schemas/project.mesh3d.phase2.example.yaml` -> PASS
- `node cli/colsim.mjs validate schemas/project.mesh3d.phase2.example.yaml` -> PASS
- `node cli/colsim.mjs run schemas/project.mesh3d.phase2.example.yaml --out out/mesh-phase2` -> PASS
- `node scripts/release-gate.mjs` -> PASS
