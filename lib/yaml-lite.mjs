import fs from "node:fs";
import path from "node:path";

export class YamlParseError extends Error {
  constructor(message, file, lineNo = 0) {
    const where = lineNo > 0 ? `${file}:${lineNo}` : file;
    super(`${where} - ${message}`);
    this.name = "YamlParseError";
    this.file = file;
    this.lineNo = lineNo;
  }
}

function splitKeyValue(text) {
  const idx = text.indexOf(":");
  if (idx < 0) {
    return null;
  }
  const key = text.slice(0, idx).trim();
  const rest = text.slice(idx + 1).trim();
  if (!key) {
    return null;
  }
  return { key, rest };
}

function parseScalar(value, file, lineNo) {
  if (value === "null" || value === "~") {
    return null;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  if (/^[+-]?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(value)) {
    return Number(value);
  }
  if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
    return value.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
  if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) {
    return value.slice(1, -1).replace(/''/g, "'");
  }
  if (value === "|" || value === ">") {
    throw new YamlParseError(
      "block scalar syntax is not supported by yaml-lite",
      file,
      lineNo,
    );
  }
  return value;
}

export function parseYaml(text, options = {}) {
  const file = options.file ?? "(input)";
  const lines = [];
  const raw = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").split("\n");

  for (let i = 0; i < raw.length; i += 1) {
    const full = raw[i];
    if (full.includes("\t")) {
      throw new YamlParseError(
        "tabs are not allowed in YAML indentation",
        file,
        i + 1,
      );
    }

    if (/^\s*$/.test(full)) {
      continue;
    }

    const trimmed = full.trimStart();
    if (trimmed.startsWith("#")) {
      continue;
    }

    lines.push({
      indent: full.length - trimmed.length,
      text: trimmed,
      lineNo: i + 1,
    });
  }

  if (lines.length === 0) {
    return null;
  }

  let idx = 0;

  function current() {
    return lines[idx] ?? null;
  }

  function parseNestedOrNull(parentIndent) {
    const next = current();
    if (next && next.indent > parentIndent) {
      return parseNodeAtIndent(next.indent);
    }
    return null;
  }

  function parseMap(indent) {
    const obj = {};
    while (true) {
      const tok = current();
      if (!tok || tok.indent !== indent || tok.text.startsWith("- ")) {
        break;
      }

      const kv = splitKeyValue(tok.text);
      if (!kv) {
        throw new YamlParseError("invalid mapping entry", file, tok.lineNo);
      }

      idx += 1;
      const { key, rest } = kv;
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        throw new YamlParseError(`duplicate key '${key}'`, file, tok.lineNo);
      }

      if (rest) {
        obj[key] = parseScalar(rest, file, tok.lineNo);
      } else {
        obj[key] = parseNestedOrNull(indent);
      }
    }
    return obj;
  }

  function parseSeq(indent) {
    const arr = [];
    while (true) {
      const tok = current();
      if (!tok || tok.indent !== indent || !tok.text.startsWith("- ")) {
        break;
      }

      const body = tok.text.slice(2).trim();
      idx += 1;

      if (!body) {
        arr.push(parseNestedOrNull(indent));
        continue;
      }

      const kv = splitKeyValue(body);
      if (!kv) {
        arr.push(parseScalar(body, file, tok.lineNo));
        continue;
      }

      const item = {};
      const { key, rest } = kv;
      if (rest) {
        item[key] = parseScalar(rest, file, tok.lineNo);
      } else {
        item[key] = parseNestedOrNull(indent);
      }

      while (true) {
        const next = current();
        if (!next || next.indent <= indent) {
          break;
        }
        const continuation = parseNodeAtIndent(next.indent);
        if (
          Array.isArray(continuation) ||
          continuation === null ||
          typeof continuation !== "object"
        ) {
          throw new YamlParseError(
            "list item continuation must be a mapping",
            file,
            next.lineNo,
          );
        }
        Object.assign(item, continuation);
      }

      arr.push(item);
    }
    return arr;
  }

  function parseNodeAtIndent(indent) {
    const tok = current();
    if (!tok) {
      throw new YamlParseError("unexpected end of file", file, 0);
    }
    if (tok.indent !== indent) {
      throw new YamlParseError(
        `expected indent ${indent}, got ${tok.indent}`,
        file,
        tok.lineNo,
      );
    }
    if (tok.text.startsWith("- ")) {
      return parseSeq(indent);
    }
    return parseMap(indent);
  }

  const root = parseNodeAtIndent(lines[0].indent);
  if (idx < lines.length) {
    const tok = lines[idx];
    throw new YamlParseError("unexpected trailing content", file, tok.lineNo);
  }
  return root;
}

export function parseYamlFile(filePath) {
  const absolute = path.resolve(filePath);
  const content = fs.readFileSync(absolute, "utf8");
  return parseYaml(content, { file: filePath });
}
