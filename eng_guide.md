ENGINEERING_GUIDE.md
ColSim – Collimator Engineering Platform

Scope: Pencil-beam (backscatter 225–320 kV) + Fan-beam (4/6 MeV LINAC)
Primary goal: Kolimatör tasarım optimizasyonu + hızlı güvenlik (leakage → boundary ≤ 2.5 µSv/h)

1. Sistem Felsefesi

ColSim:

Akademik simülatör değildir.

Ürün geliştirme aracıdır.

Hızlı iterasyon + tekrarlanabilir sonuç üretir.

GUI sadece proje yönetir, motor batch çalışır.

Ana hedef:

Kolimatör geometrisi değiştiğinde
→ Beam metrikleri
→ Leakage
→ Boundary doz
trend olarak doğru değişmeli.

Absolute doğruluk Phase-2 MC doğrulama ile sağlanır.

2. Mimari
GUI (PyQt6)
   ↓
project.yaml
   ↓
colsim run project.yaml
   ↓
core/
   ├── geometry_engine.py
   ├── safety_engine.py
   └── spectrum_engine.py
   ↓
results/
3. Proje Dosyası Şeması (project.yaml)
project:
  name: disk_collimator_case1
  mode: pencil_beam   # pencil_beam | fan_beam
  energy:
    type: kV          # kV | MeV
    value: 225

source:
  diameter_mm: 3.9
  spectrum: tungsten_default

geometry:
  slit_mm: 2.0
  inner_diameter_mm: 150
  outer_diameter_mm: 430
  thickness_mm: 50
  sdd_mm: 1900

safety:
  material: tungsten
  density_g_cm3: 19.3
  duty_cycle:
    beam_on_s: 5
    scans_per_hour: 20
  boundary:
    type: ring
    radius_m: 10
  limits:
    boundary_uSv_per_h: 2.5
    operator_uSv_per_h: 1.0
  conservative_factor: 1.3
4. Geometry Engine Tanımı
4.1 Pencil-Beam Metrikleri

Çıktılar:

beam_core_width_mm

FWHM_mm

penumbra_10_90_mm

integral_fluence_norm

uniformity_percent (fan-beam için)

Hesap prensibi

Geometrik diverjans

Kaynak çapı konvolüsyon etkisi

Slit açıklığı

Mesafe büyütme faktörü

⚠ Bu modülde buildup kullanılmaz.

5. Safety Engine Tanımı
5.1 Model

Point-kernel yaklaşımı:

Φ
(
𝑟
,
𝐸
)
=
𝑆
(
𝐸
)
⋅
𝑇
(
𝐸
)
4
𝜋
𝑟
2
⋅
𝐵
(
𝐸
,
𝑥
)
⋅
𝑒
−
𝜇
(
𝐸
)
𝑥
Φ(r,E)=
4πr
2
S(E)⋅T(E)
	​

⋅B(E,x)⋅e
−μ(E)x
Bileşenler

µ(E) → NIST XCOM cache

B(E,x) → GP buildup parametreleri

x → efektif yol uzunluğu

S(E) → spektrum binleme

5.2 Enerji Binleme

225–320 kV: 20 bin

6 MeV: 40 bin (log spacing)

5.3 Instant ve Ortalama Doz
𝐻
˙
𝑎
𝑣
𝑔
=
𝐻
˙
𝑖
𝑛
𝑠
𝑡
⋅
𝑏
𝑒
𝑎
𝑚
_
𝑜
𝑛
_
𝑠
⋅
𝑠
𝑐
𝑎
𝑛
𝑠
_
𝑝
𝑒
𝑟
_
ℎ
𝑜
𝑢
𝑟
3600
H
˙
avg
	​

=
H
˙
inst
	​

⋅
3600
beam_on_s⋅scans_per_hour
	​


Her iki değer ayrı raporlanır.

6. Çıktı Kontratı
6.1 metrics.csv
field	description
beam_core_width_mm	primary width
FWHM_mm	full width half max
penumbra_mm	10–90
boundary_max_uSv_h_inst	instant
boundary_max_uSv_h_avg	hourly avg
boundary_pass	True/False
6.2 profile_1d.csv
x_mm, fluence_norm
6.3 boundary_map.csv
angle_deg, dose_uSv_h_inst, dose_uSv_h_avg
7. Conservative Mode (Özellikle 6 MeV)

Conservative factor varsayılan 1.3

Fan-beam için leakage fraction ek parametre olabilir

Bu değer config’ten kontrol edilir

GUI'de “Conservative Safety Mode” checkbox olacak

8. PASS / FAIL Kriterleri

Boundary:

if boundary_max_uSv_h_avg <= 2.5 → PASS
else → FAIL

Operator limiti ayrı kontrol edilir.

9. Golden Test Senaryosu

Disk kolimatör:

slit = 2 mm

inner_diameter = 150 mm

outer_diameter = 430 mm

source = 3.9 mm

SDD = 1900 mm

Test:

FWHM trendi slit arttıkça artmalı

Penumbra source çapı ile artmalı

Boundary doz kalınlık arttıkça düşmeli

Tolerance: ±3%

10. Kod Kalite Kuralları

Her fonksiyon type-hinted olacak

Test yazılmadan PR kabul edilmez

Hesap varsayımları docstring içinde açık yazılır

“Magic number” yasak — config parametresi olmalı

11. Phase-2 (Gelecek)

Geant4 headless doğrulama

Surface source integration

Skyshine modülü

Multi-boundary polygon

GPU acceleration

12. Mühendislik Prensibi

ColSim:

Trend doğruysa kabul edilir

Absolute değer MC ile doğrulanır

Safety tarafı konservatif olmak zorundadır

Parametrik optimizasyonu desteklemelidir