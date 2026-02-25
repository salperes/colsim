# ColSim Architecture (MVP)

ColSim iki katmandan olusur:

1. `cli/` katmani:
- `node cli/colsim.mjs validate <project.yaml>`
- `node cli/colsim.mjs run <project.yaml> --out <dir>`

2. `core/` katmani:
- `geometry-engine.mjs`: 2D parametric ve 3D mesh Faz-1 geometri metrikleri
- `safety-engine.mjs`: leakage -> boundary doz hesabi
- `stl-metrics.mjs`: STL parse, watertight kontrolu, bbox/volume metrikleri
- `material-db.mjs`: attenuation ve buildup tablolarini okuma/interpolasyon
- `spectrum-engine.mjs`: enerji binleme (kV: 20, MeV: 40 log-bin)

Yardimci katman:
- `lib/yaml-lite.mjs`: bagimsiz YAML parser
- `lib/project-validator.mjs`: SRS alan kurallari kontrolu
- `tools/yaml-validate.mjs`: parser smoke kontrolu

Standart cikti kontrati:
- `results/metrics.csv`
- `results/profile_1d.csv`
- `results/boundary_map.csv`
- `logs/run.log`

## Faz-2 Notu

- `mesh_3d` icin boundary hesabinda ray-path kalinligi kullanilir.
- Ray, `source.position_mm` noktasindan boundary orneklerine gonderilir.
- Yol uzunlugu STL ucgenleri uzerinde Moller-Trumbore kesisimi ile hesaplanir.
