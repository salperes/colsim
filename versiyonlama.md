# ColSim Versiyonlama ve Changelog Kurallari

Bu dosya, ColSim (Collimator Simulator) icin versiyonlama, changelog ve release kapilarini tanimlar.
Kurallar, SRS'deki mimariya (GUI + batch CLI + standard results kontrati) ve muhendislik akisina (plan -> uygula -> test/kanit) gore yazilmistir.

## 1. Versiyon Semasi

ColSim, SemVer kullanir:

`MAJOR.MINOR.PATCH`

Ornek:

- `0.1.0` -> MVP taban cizgisi
- `0.2.0` -> geriye uyumlu yeni yetenek
- `0.2.1` -> bugfix
- `1.0.0` -> stabil ilk ana surum

Pre-release gerekiyorsa:

- `0.3.0-rc.1`

## 2. Bump Kurallari

### 2.1 MAJOR

Asagidaki degisikliklerden en az biri varsa:

- `project.yaml` semasinda geriye uyumsuz degisiklik
- `results/*.csv` cikti kontratinda geriye uyumsuz kolon/format degisikligi
- CLI komut/arguman davranisinda geriye uyumsuz degisiklik
- Safety limit yorumunda (PASS/FAIL mantigi) geriye uyumsuz kural degisikligi
- `mesh_3d` semasi/alanlarinda (`geometry.type`, `geometry.mesh.*`) geriye uyumsuz degisiklik

### 2.2 MINOR

Asagidaki durumlarda:

- geriye uyumlu yeni ozellik (yeni CLI komutu, yeni opsiyonel parametre, yeni metrik)
- mevcut kontrati bozmadan yeni cikti alani ekleme
- GUI'ye yeni, geriye uyumlu kontrol/ekran ekleme
- 3D kolimator Faz-1 (`mesh_3d` import + validasyon + temel metrikler) gibi geriye uyumlu capability ekleme

### 2.3 PATCH

Asagidaki durumlarda:

- bugfix
- performans iyilestirmesi (davranis kontratini bozmadan)
- test/refactor/doc iyilestirmesi (kullanici davranisini degistirmeden)

Not:

- Sadece dokumantasyon degisikligi release gerektirmiyorsa versiyon bump zorunlu degildir.
- Dokuman degisikligi davranis farkini acikliyorsa en az PATCH bump yapilir.

## 3. Versiyon Kaynagi (Single Source of Truth)

Tercih sirasiyla:

1. `pyproject.toml` -> `[project].version`
2. `VERSION` dosyasi (tek satir, semver)

Kural:

- Her iki dosya da varsa ayni versiyon degerini tasimalidir.
- GUI/CLI surumu bu kaynaktan okuyarak gostermelidir; hard-coded surum kullanilmaz.

## 4. Changelog Kurali

Dosya: `changelog.md` (repo root)

Format: Keep-a-Changelog benzeri, ters kronolojik.

```md
## [0.2.1] - 2026-02-25
### Prompt
- Boundary map hesabinda acisal ornekleme bugfixi

### Added
- ...

### Changed
- ...

### Fixed
- ...

### Tests
- `pytest -q`
- `tests/test_golden_pencilbeam.py` gecti

### Notes
- Varsayim: conservative_factor varsayilan 1.3 olarak korundu.
```

Kurallar:

1. Append-only: eski release notlari silinmez.
2. Her release girdisinde tarih ISO formatinda yazilir (`YYYY-MM-DD`).
3. Degisiklik tipi net yazilir: `Added`, `Changed`, `Fixed`, `Removed`, `Docs`, `Tests`.
4. Kod degisikligi varsa `Tests` bolumu bos birakilmaz.
5. Varsayim yapildiysa `Notes` bolumunde acik yazilir.

## 5. Release Kapilari (Zorunlu)

Kod degisikligi iceren her teslimde asagidaki sira izlenir:

1. `PLAN.md` guncelle: degisecek dosyalar + test plani.
2. Uygulama: tek konuya odakli degisiklik (kucuk PR).
3. Test: `pytest` + ilgili golden test.
4. Dokuman: etkilenen `docs/` ve gerekiyorsa `SRS.md`.
5. Changelog: `changelog.md` girdisi ekle.
6. Version bump: SemVer kuralina gore guncelle.
7. Kanit: run/test log ozeti ekle.

Teslim kapisi:

- `pytest` basarili degilse release yapilmaz.
- Golden test tolerans disinda ise release yapilmaz.
- Cikti kontrati (`results/metrics.csv`, `results/profile_1d.csv`, `results/boundary_map.csv`, `logs/run.log`) uretilemiyorsa release yapilmaz.

## 6. Etiketleme ve Branch Kurali

- Git tag formati: `vMAJOR.MINOR.PATCH` (ornek: `v0.2.1`)
- Her PR tek konu olmali (ornek: yalnizca boundary_map iyilestirmesi)
- Refactor ve ozellik ayni PR'da birlestirilmemeli (test izolasyonu icin)

## 7. Ornek Bump Senaryolari

1. `project.yaml` icinde zorunlu alan adini degistirmek:
- `0.4.2 -> 1.0.0` (MAJOR)

2. Yeni opsiyonel `safety.leakage_fraction` parametresi eklemek:
- `0.4.2 -> 0.5.0` (MINOR)

3. Penumbra hesabinda bugfix:
- `0.4.2 -> 0.4.3` (PATCH)

4. Sadece yazim hatasi duzeltmesi:
- release yok veya `0.4.3 -> 0.4.4` (ihtiyaca bagli PATCH)

5. `mesh_3d` Faz-1 destegi eklemek (STL import + validasyon + temel metrikler):
- `0.4.2 -> 0.5.0` (MINOR)

6. `mesh_3d` varsayilan birimini `mm` yerine baska birime cekmek (geriye uyumsuz):
- `0.5.0 -> 1.0.0` (MAJOR)

## 8. ColSim'e Ozel Notlar

- 6 MeV conservative mode davranisi guvenlik kritik kabul edilir; bu alandaki davranis degisikligi en az MINOR, geriye uyumsuzsa MAJOR olmalidir.
- Boundary PASS limiti (`2.5 uSv/h`) veya operator limiti yorumu degisirse risk nedeniyle changelog'da ayri `Safety` notu acilmalidir.
- SRS ile celisen bir degisiklik yapilamaz; gerekiyorsa once SRS guncellenir, sonra kod release edilir.
- 3D kolimator yetenekleri fazli teslim edilir: Faz-1 (import/validasyon/metrik), Faz-2 (tam safety/boundary). Fazlar arasi geriye uyumsuz gecis MAJOR bump gerektirir.
