# PLAN - ColSim MVP Completion

## Scope

- CLI-first MVP teslimi (`validate`, `run`)
- 2D parametric + 3D mesh Faz-1 geometri
- safety analizi (spectrum + attenuation + buildup)
- cikti kontrati ve test kapsami

## Implemented

1. YAML parser ve project validator tamamlandi.
2. `cli/colsim.mjs` validate/run komutlari tamamlandi.
3. STL metriği (bbox/volume/watertight) tamamlandi.
4. Spectrum binleme:
- kV: 20 bin
- MeV: 40 log-bin
5. Safety engine attenuation+buildup tablolari ile tamamlandi.
6. Cikti kontrati:
- `results/metrics.csv`
- `results/profile_1d.csv`
- `results/boundary_map.csv`
- `logs/run.log`
7. Testler tamamlandi:
- validator testleri
- STL testleri
- CLI run/validate testleri

## Test Evidence

- `node --test --test-isolation=none tests/*.test.mjs` -> PASS (8/8)
- `node tools/yaml-validate.mjs ...` -> PASS
- `node cli/colsim.mjs validate ...` -> PASS
