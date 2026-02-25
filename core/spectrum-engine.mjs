function linspace(start, end, count) {
  if (count <= 1) {
    return [start];
  }
  const step = (end - start) / (count - 1);
  const values = [];
  for (let i = 0; i < count; i += 1) {
    values.push(start + step * i);
  }
  return values;
}

function logspace(start, end, count) {
  if (count <= 1) {
    return [start];
  }
  const logStart = Math.log(start);
  const logEnd = Math.log(end);
  const step = (logEnd - logStart) / (count - 1);
  const values = [];
  for (let i = 0; i < count; i += 1) {
    values.push(Math.exp(logStart + step * i));
  }
  return values;
}

function normalizeWeights(spectrum) {
  const sum = spectrum.reduce((acc, row) => acc + row.weight, 0);
  if (sum <= 0) {
    const flat = 1 / spectrum.length;
    return spectrum.map((row) => ({ ...row, weight: flat }));
  }
  return spectrum.map((row) => ({ ...row, weight: row.weight / sum }));
}

export function buildEnergySpectrum(energy) {
  if (energy.type === "kV") {
    const maxMeV = energy.value / 1000;
    const minMeV = Math.max(0.015, maxMeV * 0.08);
    const binCount = 20;
    const bins = linspace(minMeV, maxMeV, binCount).map((e) => {
      const w = Math.max(0, e * (maxMeV - e));
      return { energy_MeV: e, weight: w };
    });
    return normalizeWeights(bins);
  }

  if (energy.type === "MeV") {
    const maxMeV = energy.value;
    const minMeV = Math.max(0.05, maxMeV * 0.01);
    const binCount = 40;
    const bins = logspace(minMeV, maxMeV, binCount).map((e) => {
      const mean = Math.max(0.3, maxMeV * 0.35);
      const sigma = Math.max(0.2, maxMeV * 0.2);
      const z = (e - mean) / sigma;
      const w = Math.exp(-0.5 * z * z);
      return { energy_MeV: e, weight: w };
    });
    return normalizeWeights(bins);
  }

  throw new Error(`Unsupported energy type: ${energy.type}`);
}
