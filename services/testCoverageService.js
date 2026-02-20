// services/testCoverageService.js

const { spawn } = require('child_process');

async function runCoverage() {
  console.log('Running test coverage with Vitest...');
  // Exclude problematic test files and directories
  const vitestArgs = [
    'run',
    '--coverage',
    '--exclude', '.archive/test-scripts/*',
    '--exclude', 'src/services/dependencyAnalysisService.test.ts',
    '--max-old-space-size=4096'
  ];
  const child = spawn('npx', ['vitest', ...vitestArgs], { stdio: 'inherit' });

  return new Promise((resolve, reject) => {
    child.on('close', (code) => {
      if (code === 0) {
        console.log('Test coverage completed successfully.');
        resolve();
      } else {
        console.error(`Test coverage failed with exit code ${code}`);
        reject(new Error(`Test coverage failed with exit code ${code}`));
      }
    });
    child.on('error', (err) => {
      console.error('Failed to start test coverage process:', err);
      reject(err);
    });
  });
}

module.exports = {
  runCoverage,
};