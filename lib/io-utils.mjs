import fs from "node:fs";
import path from "node:path";

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function csvCell(value) {
  if (value === null || value === undefined) {
    return "";
  }
  const text = String(value);
  if (text.includes('"') || text.includes(",") || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function writeCsv(filePath, headers, rows) {
  const lines = [];
  lines.push(headers.join(","));
  for (const row of rows) {
    const values = headers.map((h) => csvCell(row[h]));
    lines.push(values.join(","));
  }
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
}

export function writeText(filePath, content) {
  fs.writeFileSync(filePath, content, "utf8");
}

export function resolveOutDirs(baseDir) {
  const root = path.resolve(baseDir);
  const resultsDir = path.join(root, "results");
  const logsDir = path.join(root, "logs");
  return { root, resultsDir, logsDir };
}
