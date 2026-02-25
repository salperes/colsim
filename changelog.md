## [0.1.0] - 2026-02-25
### Prompt
- ColSim MVP iskeletini tamamla: 2D + 3D Faz-1, validate/run, test ve cikti kontrati

### Added
- `cli/colsim.mjs` ile `validate` ve `run` komutlari
- `core/geometry-engine.mjs`, `core/safety-engine.mjs`, `core/stl-metrics.mjs`
- `core/material-db.mjs` ve `core/spectrum-engine.mjs`
- `lib/yaml-lite.mjs` ve `lib/project-validator.mjs`
- `schemas/` altinda schema ve ornek proje dosyalari
- `tests/` altinda otomatik smoke/unit testler
- `data/xcom_cache/attenuation_sample.csv` ve `data/buildup_gp/gp_sample.csv`
- `scripts/release-gate.mjs` ve baseline rapor altyapisi (`reports/`)
- `BASELINE_v0.1.0.md` baseline dondurma notu

### Changed
- `tools/yaml-validate.mjs` artik ortak parser modulu uzerinden calisiyor
- `mesh_3d` mesh path'i proje dosyasina gore relative resolve ediliyor
- boundary points tipi safety map uretiminde dogrudan destekleniyor
- release kapilari tek komutta kosulabilir hale getirildi (`npm run release:gate`)

### Tests
- `node --test --test-isolation=none tests/*.test.mjs`
- `node cli/colsim.mjs validate schemas/project.parametric2d.example.yaml`
- `node cli/colsim.mjs validate schemas/project.mesh3d.example.yaml`
- `node cli/colsim.mjs run schemas/project.parametric2d.example.yaml --out out/parametric`
- `node cli/colsim.mjs run schemas/project.mesh3d.example.yaml --out out/mesh`
- `node scripts/release-gate.mjs`

### Notes
- MVP safety modeli hizli analiz icindir; tam fiziksel dogrulama Geant4 fazinda yapilacaktir.
