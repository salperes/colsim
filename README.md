# ColSim

ColSim, collimator geometri degisiklikleri icin hizli metrik ve boundary safety analizi ureten CLI tabanli MVP'dir.

## Ozellikler

- `project.yaml` parse + kural dogrulama
- `colsim validate` ve `colsim run`
- 2D `parametric_2d` geometri metrikleri
- 3D `mesh_3d` Faz-1 (STL import, watertight kontrolu, bbox/volume)
- safety hesap zinciri:
  - enerji binleme
  - attenuation (`data/xcom_cache/`)
  - buildup (`data/buildup_gp/`)
- standart cikti kontrati:
  - `results/metrics.csv`
  - `results/profile_1d.csv`
  - `results/boundary_map.csv`
  - `logs/run.log`

## Hemen calistir

```powershell
node cli/colsim.mjs validate schemas/project.parametric2d.example.yaml
node cli/colsim.mjs validate schemas/project.mesh3d.example.yaml

node cli/colsim.mjs run schemas/project.parametric2d.example.yaml --out out/parametric
node cli/colsim.mjs run schemas/project.mesh3d.example.yaml --out out/mesh
```

## Test

```powershell
node --test --test-isolation=none tests/*.test.mjs
```

## Baseline Freeze

```powershell
node scripts/release-gate.mjs
```

Detay: `BASELINE_v0.1.0.md` ve `reports/release-gate-latest.json`

## Dosya yapisi

- `cli/`: komut satiri girisleri
- `core/`: hesap motorlari
- `lib/`: parser/validator/io yardimcilari
- `schemas/`: ornek proje dosyalari + schema
- `data/`: attenuation ve buildup tablo cache'leri
- `tests/`: otomatik testler
- `docs/`: mimari ve test dokumani
