#!/usr/bin/env node
/**
 * Golden Functions Verification Script
 * 
 * Validates the integrity of the system after any code modification.
 * Reference: GOLDEN_FUNCTIONS_CONSTITUTION.md
 * 
 * Usage: node scripts/verify-golden.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EXT = path.join(ROOT, 'gemini-extension');

let passed = 0;
let failed = 0;
const errors = [];

function check(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ ${name}: ${e.message}`);
    errors.push({ name, error: e.message });
    failed++;
  }
}

function fileExists(filePath, label) {
  check(label || filePath, () => {
    if (!fs.existsSync(path.resolve(ROOT, filePath))) {
      throw new Error(`File not found: ${filePath}`);
    }
  });
}

function jsCheck(filePath) {
  check(`JS syntax: ${filePath}`, () => {
    execSync(`node --check "${path.resolve(ROOT, filePath)}"`, { stdio: 'pipe' });
  });
}

console.log('\n🔍 Golden Functions Verification\n');

// ═══════════════════════════════════════════════════════════════
// 1. Core Extension Files Exist
// ═══════════════════════════════════════════════════════════════
console.log('📁 Core File Existence:');
fileExists('gemini-extension/content.js', 'content.js (#30 message bridge)');
fileExists('gemini-extension/background.js', 'background.js (#2-6 core handlers)');
fileExists('gemini-extension/youtube-analytics.js', 'youtube-analytics.js (#7-12 data collection)');
fileExists('gemini-extension/manifest.json', 'manifest.json (extension config)');
fileExists('gemini-extension/core/constants.js', 'constants.js (EXT_CONSTANTS)');

// ═══════════════════════════════════════════════════════════════
// 2. Platform Automation Files Exist
// ═══════════════════════════════════════════════════════════════
console.log('\n🎬 Platform Automation Files:');
fileExists('gemini-extension/platforms/geminiGen/autoPilot.js', 'GeminiGen autoPilot (#1a)');
fileExists('gemini-extension/platforms/googleFlow/autoPilot.js', 'Google Flow autoPilot (#1c)');
fileExists('gemini-extension/platforms/googleVids/workflow.js', 'Google Vids workflow (#1d)');
fileExists('gemini-extension/platforms/youtube/studioUploader.js', 'YouTube studioUploader (#4, #5)');
fileExists('gemini-extension/platforms/youtube/commentAutomation.js', 'Comment automation (#22, #23)');

// ═══════════════════════════════════════════════════════════════
// 3. Service Files Exist
// ═══════════════════════════════════════════════════════════════
console.log('\n🔧 Service Files:');
fileExists('services/veoService.ts', 'Veo 3 Service (#1b)');
fileExists('services/dflLearningService.ts', 'DFL Learning Service (#14)');
fileExists('services/askStudioAdapter.ts', 'Ask Studio Adapter (#19, #20)');

// ═══════════════════════════════════════════════════════════════
// 4. JavaScript Syntax Checks
// ═══════════════════════════════════════════════════════════════
console.log('\n🧪 JS Syntax Checks:');
jsCheck('gemini-extension/background.js');
jsCheck('gemini-extension/content.js');
jsCheck('gemini-extension/youtube-analytics.js');
jsCheck('gemini-extension/core/constants.js');
jsCheck('gemini-extension/platforms/geminiGen/autoPilot.js');
jsCheck('gemini-extension/platforms/googleFlow/autoPilot.js');
jsCheck('gemini-extension/platforms/googleVids/workflow.js');

// ═══════════════════════════════════════════════════════════════
// 5. Critical Message Types in content.js
// ═══════════════════════════════════════════════════════════════
console.log('\n📨 Message Type Coverage (content.js):');
const contentJs = fs.readFileSync(path.join(EXT, 'content.js'), 'utf-8');
const requiredMessages = [
  'PREPARE_YOUTUBE_UPLOAD',
  'GOOGLE_VIDS_GENERATE',
  'GOOGLE_FLOW_GENERATE',
  'REQUEST_YOUTUBE_ANALYTICS',
  'REGISTER_SCHEDULED_COMMENT',
  'DFL_SCHEDULE_ADJUST_REQUEST',
  'IGNITE_SCRIPT',
  'ASK_STUDIO_GENERATE_PLAN',
  'CROSS_PLATFORM_DISTRIBUTE',
  'CHECK_EXTENSION_STATUS',
];
requiredMessages.forEach(msg => {
  check(`content.js handles: ${msg}`, () => {
    if (!contentJs.includes(msg)) {
      throw new Error(`Message type ${msg} not found in content.js`);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 6. Critical Actions in background.js
// ═══════════════════════════════════════════════════════════════
console.log('\n📨 Action Coverage (extension-wide):');
const bgJs = fs.readFileSync(path.join(EXT, 'background.js'), 'utf-8');
// Some actions are handled by sub-modules loaded into the extension
const allExtFiles = [bgJs, contentJs];
// Also read scheduledCommentMonitor if it exists
const monitorPath = path.join(EXT, 'platforms', 'youtube', 'scheduledCommentMonitor.js');
if (fs.existsSync(monitorPath)) allExtFiles.push(fs.readFileSync(monitorPath, 'utf-8'));
const allExtCode = allExtFiles.join('\n');

const requiredActions = [
  'storeVideoData',
  'downloadVideo',
  'relayGeminiVideoResult',
  'storeScheduledComment',
  'rescheduleVideo',
  'ASK_STUDIO_GENERATE_PLAN',
  'crossPlatformDistribute',
];
requiredActions.forEach(action => {
  check(`extension handles: ${action}`, () => {
    if (!allExtCode.includes(action)) {
      throw new Error(`Action ${action} not found in extension files`);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 7. Bidirectional Message Bridge (#30 - CRITICAL)
// ═══════════════════════════════════════════════════════════════
console.log('\n🌉 Bidirectional Message Bridge (#30 - CRITICAL):');
check('Direction A: chrome.runtime.onMessage -> window.postMessage', () => {
  if (!contentJs.includes('chrome.runtime.onMessage') || !contentJs.includes('window.postMessage')) {
    throw new Error('Bidirectional bridge Direction A missing');
  }
});
check('Direction B: window.addEventListener(message) -> sendMessage', () => {
  const hasListener = contentJs.includes("window.addEventListener('message'") || contentJs.includes('window.addEventListener("message"');
  if (!hasListener) {
    throw new Error('Bidirectional bridge Direction B missing');
  }
});

// ═══════════════════════════════════════════════════════════════
// 8. Entry Point Chain
// ═══════════════════════════════════════════════════════════════
console.log('\n🔗 Entry Point Chain:');
fileExists('index.html', 'index.html');
fileExists('index.tsx', 'index.tsx (entry)');
fileExists('App.tsx', 'App.tsx (root)');

// ═══════════════════════════════════════════════════════════════
// 9. Manifest Integrity
// ═══════════════════════════════════════════════════════════════
console.log('\n📋 Manifest Integrity:');
check('manifest.json is valid JSON', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf-8'));
  if (!manifest.manifest_version || !manifest.name) {
    throw new Error('Invalid manifest structure');
  }
});
check('manifest references existing files', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf-8'));
  if (manifest.background && manifest.background.service_worker) {
    const bgFile = path.join(EXT, manifest.background.service_worker);
    if (!fs.existsSync(bgFile)) throw new Error('Background script not found: ' + manifest.background.service_worker);
  }
});

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════
console.log('\n' + '='.repeat(60));
console.log('\n📊 Results: ' + passed + ' passed, ' + failed + ' failed\n');

if (failed > 0) {
  console.log('❌ VERIFICATION FAILED:');
  errors.forEach(e => console.log('   - ' + e.name + ': ' + e.error));
  process.exit(1);
} else {
  console.log('✅ ALL GOLDEN FUNCTIONS VERIFIED');
  process.exit(0);
}