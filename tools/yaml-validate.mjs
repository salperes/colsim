#!/usr/bin/env node

import { parseYamlFile } from "../lib/yaml-lite.mjs";

function main(argv) {
  const files = argv.slice(2);
  if (files.length === 0) {
    console.error("Usage: node tools/yaml-validate.mjs <file1.yaml> [file2.yaml ...]");
    process.exit(1);
  }

  let hasFailure = false;
  for (const file of files) {
    try {
      parseYamlFile(file);
      console.log(`OK ${file}`);
    } catch (error) {
      hasFailure = true;
      console.error(`FAIL ${file}`);
      console.error(String(error.message || error));
    }
  }

  if (hasFailure) {
    process.exit(1);
  }
}

main(process.argv);
