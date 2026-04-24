#!/usr/bin/env node

import { main } from "../lib/cli.js";

main(process.argv).catch((error) => {
  console.error(`codex-hub: ${error.message}`);
  process.exitCode = 1;
});

