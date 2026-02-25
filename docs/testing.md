# Testing

## 1. Tum testler

```powershell
node --test --test-isolation=none tests/*.test.mjs
```

## 2. YAML parser + ornek dosyalar

```powershell
node tools/yaml-validate.mjs schemas/project.schema.yaml schemas/project.parametric2d.example.yaml schemas/project.mesh3d.example.yaml schemas/project.mesh3d.phase2.example.yaml
```

## 3. CLI dogrulama

```powershell
node cli/colsim.mjs validate schemas/project.parametric2d.example.yaml
node cli/colsim.mjs validate schemas/project.mesh3d.example.yaml
node cli/colsim.mjs validate schemas/project.mesh3d.phase2.example.yaml
```

## 4. CLI run

```powershell
node cli/colsim.mjs run schemas/project.parametric2d.example.yaml --out out/parametric
node cli/colsim.mjs run schemas/project.mesh3d.example.yaml --out out/mesh
node cli/colsim.mjs run schemas/project.mesh3d.phase2.example.yaml --out out/mesh-phase2
```

## 5. Release gate

```powershell
node scripts/release-gate.mjs
```
