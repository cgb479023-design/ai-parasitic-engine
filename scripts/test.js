#!/usr/bin/env node

import { runCoverage } from '../services/testCoverageService.js';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0]; // Currently only supports 'coverage'

  switch (command) {
    case 'coverage':
      await runCoverage();
      break;
    default:
      console.error(`❌ Unknown command: ${command}`);
      console.error(`✅ Available commands: coverage`);
      process.exit(1);
  }
}

main();
