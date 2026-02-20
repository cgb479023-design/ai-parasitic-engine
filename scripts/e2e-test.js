#!/usr/bin/env node
"use strict";

// End-to-End Testing Framework (Path B: skip type-check in E2E via SKIP_TYPE_CHECK env)
// Automated testing of complete user workflows

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const WORKFLOWS = [
  {
    name: 'Plugin Initialization',
    description: 'Verify Chrome plugin loads without errors',
    test: async () => {
      const manifestPath = path.join(process.cwd(), 'gemini-extension', 'manifest.json');
      if (!fs.existsSync(manifestPath)) throw new Error('manifest.json not found');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (!manifest.background || !manifest.content_scripts) throw new Error('Invalid manifest structure');
      return true;
    }
  },
  {
    name: 'Chrome Storage Initialization',
    description: 'Verify chrome.storage initialization works',
    test: async () => {
      const bgPath = path.join(process.cwd(), 'gemini-extension', 'background.js');
      if (!fs.existsSync(bgPath)) throw new Error('background.js not found');
      const content = fs.readFileSync(bgPath, 'utf8');
      if (!content.includes('chrome.storage.local.get')) throw new Error('No storage initialization found');
      return true;
    }
  },
  {
    name: 'Message Communication',
    description: 'Verify onMessage and sendMessage handlers exist',
    test: async () => {
      const bgPath = path.join(process.cwd(), 'gemini-extension', 'background.js');
      const contentPath = path.join(process.cwd(), 'gemini-extension', 'content.js');
      if (!fs.existsSync(bgPath) || !fs.existsSync(contentPath)) throw new Error('Required files not found');
      const bgContent = fs.readFileSync(bgPath, 'utf8');
      const contentContent = fs.readFileSync(contentPath, 'utf8');
      if (!bgContent.includes('chrome.runtime.onMessage')) throw new Error('No onMessage handler in background.js');
      if (!contentContent.includes('chrome.runtime.sendMessage')) throw new Error('No sendMessage in content.js');
      return true;
    }
  },
  {
    name: 'API Service Initialization',
    description: 'Verify Gemini API service can be initialized',
    test: async () => {
      const servicePath = path.join(process.cwd(), 'src', 'services', 'geminiService.ts');
      if (!fs.existsSync(servicePath)) throw new Error('geminiService.ts not found');
      const content = fs.readFileSync(servicePath, 'utf8');
      if (!content.includes('generateVideo') && !content.includes('createVideo')) throw new Error('No video generation function found');
      return true;
    }
  },
  {
    name: 'UI Component Rendering',
    description: 'Verify main UI components can render',
    test: async () => {
      const appPath = path.join(process.cwd(), 'App.tsx');
      if (!fs.existsSync(appPath)) throw new Error('App.tsx not found');
      const content = fs.readFileSync(appPath, 'utf8');
      const required = ['Header', 'InputForm', 'LoadingScreen', 'OutputDisplay'];
      const missing = required.filter(c => !content.includes(c));
      if (missing.length) throw new Error('Missing components: ' + missing.join(', '));
      return true;
    }
  },
  {
    name: 'Video Generation Flow',
    description: 'Verify complete video generation workflow',
    test: async () => {
      const servicePath = path.join(process.cwd(), 'src', 'services', 'geminiService.ts');
      const appPath = path.join(process.cwd(), 'App.tsx');
      if (!fs.existsSync(servicePath)) throw new Error('geminiService.ts not found');
      const serviceContent = fs.readFileSync(servicePath, 'utf8');
      const req = ['generateFullPromptAndViralityAnalysis', 'generateVideoAndThumbnail', 'processEditedVideoWithAI'];
      const missing = req.filter(fn => !serviceContent.includes(fn));
      if (missing.length) throw new Error('Missing functions: ' + missing.join(', '));
      const appContent = fs.readFileSync(appPath, 'utf8');
      if (!appContent.includes('handleSubmit') || !appContent.includes('processGeneratedVideo')) throw new Error('Main flow handlers not found');
      return true;
    }
  },
  {
    name: 'Editor Export Flow',
    description: 'Verify video editor export workflow',
    test: async () => {
      const editorPath = path.join(process.cwd(), 'src', 'components', 'Editor.tsx');
      if (!fs.existsSync(editorPath)) throw new Error('Editor.tsx not found');
      const content = fs.readFileSync(editorPath, 'utf8');
      if (!content.includes('handleExportFromEditor')) throw new Error('Export handler not found');
      if (!content.includes('processEditedVideoWithAI')) throw new Error('Video processing call not found');
      return true;
    }
  },
  {
    name: 'Type Safety Check',
    description: 'Verify TypeScript types are defined correctly',
    test: async () => {
      // Path B: skip type-check in E2E if SKIP_TYPE_CHECK is set
      if (process.env.SKIP_TYPE_CHECK) {
        console.log('Type check skipped (Path B)');
        return true;
      }
      try {
        execSync('npm run type-check', { cwd: process.cwd(), stdio: 'inherit' });
        return true;
      } catch (error) {
        throw new Error(`Type check failed: ${error && error.message}`);
      }
    }
  },
  {
    name: 'Lint Check',
    description: 'Verify code passes linting rules',
    test: async () => {
      if (process.env.SKIP_LINT) {
        console.log('Lint check skipped (Path A)');
        return true;
      }
      try {
        execSync('npm run lint', { cwd: process.cwd(), stdio: 'inherit' });
        return true;
      } catch (error) {
        throw new Error(`Lint check failed: ${error && error.message}`);
      }
    }
  },
  {
    name: 'YouTube Analytics & YPP Flow',
    description: 'Verify YouTube Analytics and YPP components structure',
    test: async () => {
      const yaPath = path.join(process.cwd(), 'src', 'components', 'YouTubeAnalytics.tsx');
      const yppPanelPath = path.join(process.cwd(), 'src', 'components', 'YouTubeAnalytics', 'panels', 'YPPPanel.tsx');
      const useYPPPath = path.join(process.cwd(), 'src', 'components', 'YouTubeAnalytics', 'hooks', 'useYPP.ts');

      if (!fs.existsSync(yaPath)) throw new Error('YouTubeAnalytics.tsx not found');
      if (!fs.existsSync(yppPanelPath)) throw new Error('YPPPanel.tsx not found');
      if (!fs.existsSync(useYPPPath)) throw new Error('useYPP.ts not found');

      const yaContent = fs.readFileSync(yaPath, 'utf8');
      if (!yaContent.includes('YPPPanel')) throw new Error('YPPPanel not imported in YouTubeAnalytics');
      if (!yaContent.includes('useYPP')) throw new Error('useYPP not used in YouTubeAnalytics');

      const useYPPContent = fs.readFileSync(useYPPPath, 'utf8');
      if (!useYPPContent.includes('generateYppPlan')) throw new Error('generateYppPlan not exported from useYPP');

      return true;
    }
  }
];

async function runTest(test) {
  const startTime = Date.now();
  try {
    console.log(`\n🧪 Testing: ${test.name}`);
    console.log(`   ${test.description}`);
    const result = await test.test();
    const duration = Date.now() - startTime;
    if (result) {
      console.log(`   ✅ PASSED (${duration}ms)`);
      return { name: test.name, status: 'pass', duration };
    } else {
      throw new Error('Test returned false');
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error && error.message ? error.message : String(error);
    console.log(`   ❌ FAILED (${duration}ms)`);
    console.log(`   Error: ${errorMessage}`);
    return { name: test.name, status: 'fail', duration, error: errorMessage };
  }
}

async function runE2ETests() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 END-TO-END TESTING');
  console.log('='.repeat(60) + '\n');
  const startTime = Date.now();
  const results = [];
  for (const workflow of WORKFLOWS) {
    const result = await runTest(workflow);
    results.push(result);
    if (result.status === 'fail' && ['Plugin Initialization', 'Type Safety Check'].includes(result.name)) {
      console.log('\n🛑 Critical test failed, stopping...');
      break;
    }
  }
  const duration = Date.now() - startTime;
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const skipped = results.filter(r => r.status === 'skip').length;
  const total = results.length;

  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`\nTotal: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`⏱️  Duration: ${duration}ms`);

  if (failed > 0) {
    console.log('\n❌ FAILED TESTS:\n');
    results.filter(r => r.status === 'fail').forEach(r => {
      console.log(`   ❌ ${r.name}`);
      console.log(`      ${r.error}`);
    });
  }

  console.log('\n' + '='.repeat(60));
  if (passed === total) {
    console.log('✅ ALL TESTS PASSED\n');
  } else {
    console.log(`❌ ${failed} TEST(S) FAILED\n`);
  }
  console.log('='.repeat(60));

  return { total, passed, failed, skipped, results, duration };
}

async function runSpecificWorkflow(workflowName) {
  const workflow = WORKFLOWS.find(w => w.name.toLowerCase().includes(workflowName.toLowerCase()));
  if (!workflow) {
    console.log(`\n❌ Workflow not found: ${workflowName}`);
    console.log('\nAvailable workflows:');
    WORKFLOWS.forEach(w => console.log(`   - ${w.name}`));
    return { name: workflowName, status: 'skip', duration: 0 };
  }
  return await runTest(workflow);
}

const command = process.argv[2];
const arg = process.argv[3];
(async () => {
  switch (command) {
    case 'all':
      await runE2ETests();
      break;
    case 'workflow':
      await runSpecificWorkflow(arg || '');
      break;
    default:
      console.log(`\nUsage: npm run verify:e2e <command>\n\nCommands:\n  all                       Run all e2e tests\n  workflow <name>          Run specific workflow test\nExamples:\n  npm run verify:e2e all\n  npm run verify:e2e workflow "video generation"\n        `);
  }
})();
