# SRS - ColSim (Collimator Simulator)

- Surum: 0.2.0
- Tarih: 2026-02-25
- Kaynaklar: `eng_guide.md`, `New Metin Belgesi.txt`

## 1. Amac

Bu dokuman, ColSim yazilimi icin urun seviyesinde yazilim gereksinimlerini tanimlar.
ColSim'in ana amaci, kolimator geometrisi degisimlerine hizli ve tekrarlanabilir sekilde:

- beam metrikleri (beam width, penumbra, FWHM),
- leakage tabanli guvenlik analizi,
- boundary doz PASS/FAIL karari

uretmek ve sonuclari GUI uzerinden gostermektir.

## 2. Kapsam

Sistem iki temel kullanim alanini kapsar:

- Pencil-beam (backscatter, 225-320 kV)
- Fan-beam (LINAC, 4/6 MeV)
- 3D kolimator tasarimi (mesh tabanli, Faz-1 metrik + Faz-2 baslangic boundary analizi)

MVP kapsami disi:

- Full MC dogrulama (Geant4) ve skyshine
- Gelismis malzeme siniflandirma/AI tabanli karar mekanizmalari

## 3. Sistem Baglami ve Mimari

Calisma modeli:

1. GUI (PyQt6) proje parametrelerini toplar ve `project.yaml` uretir.
2. CLI (`colsim run project.yaml`) headless motoru calistirir.
3. Motor, standart cikti dosyalarini `results/` ve `logs/` altina yazar.
4. GUI yalnizca bu ciktilari okuyup gorsellestirir.

Mimari bilesenler:

- `app/`: GUI katmani
- `cli/`: komut satiri girisi (`run`, `validate`)
- `core/`: `geometry_engine`, `safety_engine`, `spectrum_engine`
- `schemas/`: `project.yaml` semasi
- `data/xcom_cache/`: NIST XCOM turevi attenuation verileri
- `data/buildup_gp/`: GP buildup parametreleri
- `tests/`: unit ve golden testler
- `docs/`: muhendis kullanim dokumani

## 4. Terimler

- FWHM: Full Width at Half Maximum
- Penumbra 10-90: profilin %10-%90 gecis genisligi
- Point-kernel: kaynaktan mesafeye bagli temel doz/yogunluk modeli
- Buildup `B(E,x)`: sacilma katkisini temsil eden duzeltme carpani
- Conservative mode: guvenlik tarafinda muhafazakar katsayi/leakage kullanimi
- Mesh 3D: STL tabanli uc boyutlu kolimator geometrisi
- Watertight mesh: acik kenar/delik icermeyen kapali hacim

## 5. Fonksiyonel Gereksinimler

### 5.1 Proje Girisi ve Dogrulama

- FR-001: Sistem `project.yaml` dosyasini semaya gore dogrulamalidir.
- FR-002: `project.mode` yalnizca `pencil_beam` veya `fan_beam` kabul etmelidir.
- FR-003: Enerji tipi `kV` veya `MeV` olarak acikca belirtilmelidir.
- FR-004: Geometri, kaynak, safety ve sinir limitleri eksiksiz tanimlanmalidir.

### 5.2 CLI Calisma Akisi

- FR-005: Sistem `colsim run <project.yaml>` komutunu desteklemelidir.
- FR-006: Sistem gecersiz girislerde acik hata mesaji verip calismayi durdurmalidir.
- FR-007: Sistem `validate` benzeri bir komutla yalnizca sema dogrulamasini calistirabilmelidir.

### 5.3 Geometry Engine (Analitik)

- FR-008: Geometry engine en az su metrikleri uretmelidir:
  - `beam_core_width_mm`
  - `FWHM_mm`
  - `penumbra_10_90_mm` (opsiyonel olarak 20-80)
  - `integral_fluence_norm`
  - `uniformity_percent` (fan-beam modu icin)
- FR-009: Geometry hesabi; slit acikligi, kaynak capi, mesafe buyutme ve geometrik diverjans etkilerini icermelidir.
- FR-010: Geometry modulu buildup hesabina bagimli olmamalidir.

### 5.4 Safety Engine (Leakage -> Boundary)

- FR-011: Safety engine point-kernel + attenuation + buildup modelini kullanmalidir.
- FR-012: Attenuation katsayilari `xcom_cache` verilerinden alinmalidir.
- FR-013: Buildup katsayilari `buildup_gp` tablolarindan alinmalidir.
- FR-014: Enerji binleme:
  - 225-320 kV icin en az 20 bin
  - 6 MeV icin en az 40 log-bin
- FR-015: Sistem su haritalari uretmelidir:
  - anlik doz hizi (`dose_uSv_h_inst`)
  - saatlik ortalama doz hizi (`dose_uSv_h_avg`)
- FR-016: Saatlik ortalama hesap formulu asagidakiyle uyumlu olmalidir:
  - `H_avg = H_inst * (beam_on_s * scans_per_hour / 3600)`
- FR-017: Boundary icin maksimum deger ve PASS/FAIL sonucu raporlanmalidir.

### 5.5 Conservative Mode

- FR-018: 6 MeV senaryolarinda conservative mode zorunlu olmalidir.
- FR-019: Conservative etki; `conservative_factor` ve/veya leakage fraction parametresiyle konfigurasyondan yonetilmelidir.
- FR-020: GUI'de conservative mode secimi bulunmalidir.

### 5.6 Cikti Kontrati

- FR-021: Her `run` sonunda asagidaki dosyalar uretilmelidir:
  - `results/metrics.csv`
  - `results/profile_1d.csv`
  - `results/boundary_map.csv`
  - `logs/run.log`
- FR-022: `metrics.csv` en az su alanlari icermelidir:
  - `beam_core_width_mm`
  - `FWHM_mm`
  - `penumbra_mm` veya `penumbra_10_90_mm`
  - `boundary_max_uSv_h_inst`
  - `boundary_max_uSv_h_avg`
  - `boundary_pass`
- FR-023: `profile_1d.csv` en az `x_mm, fluence_norm` kolonlarini icermelidir.
- FR-024: `boundary_map.csv` en az `angle_deg, dose_uSv_h_inst, dose_uSv_h_avg` kolonlarini icermelidir.
- FR-025: Boundary temsilinde ring grid veya nokta listesi desteklenmelidir.

### 5.7 3D Kolimator Tasarimi (Faz-1/Faz-2 Extension)

- FR-026: Sistem `geometry.type` alaninda `parametric_2d` ve `mesh_3d` degerlerini desteklemelidir.
- FR-027: `mesh_3d` tipinde en az `STL` importu desteklenmeli; dosya yolu `geometry.mesh.path` ile verilmelidir.
- FR-028: `mesh_3d` yukleme sirasinda en az su validasyonlar zorunlu olmalidir:
  - mesh watertight olmalidir (acik kenar/kapali olmayan hacim kabul edilmez)
  - olcek sifir/negatif olamaz
  - birimler `mm` olarak normalize edilmelidir
- FR-029: `colsim validate` komutu `mesh_3d` hatalarini alan bazli ve acik mesaja sahip olarak raporlamalidir.
- FR-030: `mesh_3d` Faz-1 kosumunda en az su temel metrikler `metrics.csv` icinde uretilmelidir:
  - `mesh_bbox_x_mm`
  - `mesh_bbox_y_mm`
  - `mesh_bbox_z_mm`
  - `mesh_volume_mm3`
  - `aperture_equivalent_mm`
- FR-031: `mesh_3d` Faz-1 kosumunda safety/boundary hesabi devre disiysa `results/boundary_map.csv` dosyasi yalnizca kolon basliklariyla uretilmeli ve `logs/run.log` icine `phase1_geometry_only=true` kaydi yazilmalidir.
- FR-032: `mesh_3d` Faz-2 kosumunda boundary hesabi ray-path tabanli efektif yol uzunlugunu kullanmalidir (kaynak konumu -> boundary noktasi dogrultusunda mesh kesisimi).
- FR-033: `source.position_mm` opsiyonel alani verildiginde ray-path hesabi bu konumu kullanmali, verilmediginde kaynak `(0,0,0)` kabul edilmelidir.

## 6. Is Kurallari ve Limitler

- BR-001: Boundary PASS kosulu:
  - `boundary_max_uSv_h_avg <= 2.5` ise PASS
  - aksi halde FAIL
- BR-002: Operator limiti ayri alan olarak tanimlanip ayri kontrol edilmelidir (varsayilan hedef: `<= 1.0 uSv/h`).
- BR-003: Tum varsayimlar acik parametre olarak konfigurable olmalidir; sessiz sabit kabul yapilmamalidir.

## 7. Kalite ve Diger Gereksinimler

- NFR-001: Sonuclar ayni girdi ile tekrarlanabilir olmalidir.
- NFR-002: Kod tabani type hints kullanmalidir.
- NFR-003: Hesap varsayimlari fonksiyon/docstring seviyesinde aciklanmalidir.
- NFR-004: Sabitler ("magic number") konfigurasyon/sema alanlariyla disaridan yonetilmelidir.
- NFR-005: Her ozellik degisikligi unit/golden test ve ilgili dokuman guncellemesi ile teslim edilmelidir.

## 8. Dogrulama ve Kabul Kriterleri

### 8.1 Otomatik Test Kriterleri

- VR-001: `pytest` calismasi basarili olmalidir.
- VR-002: Golden test ciktisi tanimli toleranslar icinde kalmalidir.
- VR-003: Cikti kontrati dosyalari her run sonunda fiziksel olarak uretilmelidir.

### 8.2 Golden Senaryo (MVP Referans)

Disk kolimator referans senaryosu:

- `slit_mm = 2`
- `inner_diameter_mm = 150`
- `outer_diameter_mm = 430`
- `source.diameter_mm = 3.9`
- `sdd_mm = 1900`

Beklenen trendler (tolerans: +/-3%):

- `slit` artarsa `FWHM` artar.
- `source diameter` artarsa `penumbra` artar.
- `thickness` artarsa `boundary dose` duser.

## 9. Gelecek Faz (Bilgi, SRS Kapsami Disi)

Asagidaki maddeler MVP disidir:

- Geant4 headless dogrulama
- Mesh tabanli 3D kolimatorlar icin tam fiziksel kalibrasyon (Geant4 referansli Faz-2 dogrulama)
- Surface source integration
- Skyshine modulu
- Multi-boundary polygon destegi
- GPU acceleration

## 10. Izlenebilirlik Ozeti

Bu SRS; iki kaynak dokumandaki ortak cizgiyi esas alir:

- GUI odakli + batch motor mimarisi
- Geometry ve safety motorlarinin ayrik ama tutarli tasarimi
- Standart cikti kontrati
- Boundary guvenlik limitleri ve conservative davranis
- Test odakli teslim kriterleri
