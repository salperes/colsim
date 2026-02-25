# ColSim Baseline Freeze - v0.1.0

- Tarih: 2026-02-25
- Durum: READY
- Release gate raporu: `reports/release-gate-latest.json`

## Gecilen Kapilar

1. YAML parser smoke validation
2. Project validator rules
3. STL metrics and watertight validation
4. CLI validate
5. CLI run and output contract

Komut:

```powershell
node scripts/release-gate.mjs
```

## Uretilen Kanit Dosyalari

- `reports/release-gate-latest.json`
- `out/release-parametric/results/metrics.csv`
- `out/release-parametric/results/profile_1d.csv`
- `out/release-parametric/results/boundary_map.csv`
- `out/release-parametric/logs/run.log`
- `out/release-mesh/results/metrics.csv`
- `out/release-mesh/results/profile_1d.csv`
- `out/release-mesh/results/boundary_map.csv`
- `out/release-mesh/logs/run.log`

## Git Tag Adimi (Manual)

Bu klasor henuz git repo degil. Tag icin:

```powershell
git init
git add .
git commit -m "release: v0.1.0 baseline freeze"
git tag -a v0.1.0 -m "ColSim v0.1.0"
```
