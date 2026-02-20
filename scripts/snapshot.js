#!/usr/bin/env node

/**
 * Snapshot Management System
 * Provides git-based snapshot functionality with verification
 */

var execSync = require('child_process').execSync;
var fs = require('fs');
var path = require('path');

var SNAPSHOTS_DIR = '.snapshots';
var SNAPSHOT_INDEX_FILE = path.join(SNAPSHOTS_DIR, 'index.json');

/**
 * Initialize snapshots directory
 */
function initSnapshots() {
  if (!fs.existsSync(SNAPSHOTS_DIR)) {
    fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
    fs.writeFileSync(SNAPSHOT_INDEX_FILE, JSON.stringify([], null, 2));
    console.log('Snapshots system initialized');
  }
}

/**
 * Create a snapshot with git commit
 */
function createSnapshot(description) {
  initSnapshots();

  var snapshotId = 'snapshot-' + Date.now();
  var timestamp = Date.now();
  var branch = getCurrentBranch();

  // Stage all changes
  try {
    execSync('git add -A', { cwd: process.cwd() });
  } catch (error) {
    console.warn('No changes to stage');
  }

  // Create git commit with snapshot metadata
  var commitMessage = 'SNAPSHOT: [' + snapshotId + '] ' + description;
  execSync('git commit -m "' + commitMessage + '"', { cwd: process.cwd() });

  // Get list of changed files
  var changedFiles = getChangedFiles();

  var metadata = {
    id: snapshotId,
    timestamp: timestamp,
    description: description,
    branch: branch,
    files: changedFiles
  };

  // Update index
  var index = loadSnapshotIndex();
  index.unshift(metadata);
  fs.writeFileSync(SNAPSHOT_INDEX_FILE, JSON.stringify(index, null, 2));

  console.log('Snapshot created:', snapshotId);
  console.log('   Description:', description);
  console.log('   Files changed:', changedFiles.length);
  
  return metadata;
}

/**
 * Restore latest snapshot
 */
function restoreLatest() {
  initSnapshots();  
  var index = loadSnapshotIndex();  
  if (index.length === 0) {
    throw new Error('No snapshots found. Cannot restore.');
  }

  var latestSnapshot = index[0];  
  console.log('Restoring snapshot:', latestSnapshot.id);
  console.log('   Description:', latestSnapshot.description);  
  // Find commit hash
  var commitHash = findSnapshotCommit(latestSnapshot.id);  
  
  if (!commitHash) {
    throw new Error('Could not find commit for snapshot: ' + latestSnapshot.id);
  }

  // Hard reset to snapshot commit
  execSync('git reset --hard ' + commitHash, { cwd: process.cwd() });  
  console.log('Snapshot restored successfully');
  console.log('\n⚠️  You just rolled back to a previous state.');
  console.log('👉 Suggestion: Run `/record_error` to document what went wrong and prevent it from happening again.');
}

/**
 * List all snapshots
 */
function listSnapshots() {
  initSnapshots();
  return loadSnapshotIndex();
}

/**
 * Compare current state with latest snapshot
 */
function compareWithLatest() {
  var index = loadSnapshotIndex();
  if (index.length === 0) {
    return [];
  }

  var latestSnapshot = index[0];
  var commitHash = findSnapshotCommit(latestSnapshot.id);  
  
  try {
    var diff = execSync('git diff ' + commitHash, { 
      cwd: process.cwd(), 
      encoding: 'utf8' 
    });
    return diff.split('\n').filter(function(line) { return line.trim(); });
  } catch (error) {
    return [];
  }
}

/**
 * Get current git branch
 */
function getCurrentBranch() {
  try {
    var branch = execSync('git rev-parse --abbrev-ref HEAD', { 
      cwd: process.cwd(), 
      encoding: 'utf8' 
    });
    return branch.trim();
  } catch (error) {
    return 'unknown';
  }
}

/**
 * Get list of changed files
 */
function getChangedFiles() {
  try {
    var files = execSync('git diff --name-only', { 
      cwd: process.cwd(), 
      encoding: 'utf8' 
    });
    return files.trim().split('\n').filter(function(f) { return f.trim(); });
  } catch (error) {
    return [];
  }
}

/**
 * Find commit hash for snapshot
 */
function findSnapshotCommit(snapshotId) {
  try {
    var commits = execSync('git log --all --grep="SNAPSHOT: \\\\[' + snapshotId + '\\]" --format="%H"', { 
      cwd: process.cwd(), 
      encoding: 'utf8' 
    });
    var hashes = commits.trim().split('\n').filter(function(h) { return h.trim(); });
    return hashes[0] || null;
  } catch (error) {
    return null;
  }
}

/**
 * Load snapshot index
 */
function loadSnapshotIndex() {
  try {
    var content = fs.readFileSync(SNAPSHOT_INDEX_FILE, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    return [];
  }
}

// CLI interface
if (require.main === module) {
  var command = process.argv[2];
  var args = process.argv.slice(3);

  switch (command) {
    case 'create':
      var description = args.join(' ') || 'Pre-refactor snapshot';
      createSnapshot(description);
      break;
    case 'restore':
      restoreLatest();
      break;
    case 'list':
      var snapshots = listSnapshots();
      console.log('\nSnapshots:');
      snapshots.forEach(function(s, i) {
        console.log('\n  [' + (i + 1) + '] ' + s.id);
        console.log('      ' + s.description);
        console.log('      ' + new Date(s.timestamp).toLocaleString());
        console.log('      Branch: ' + s.branch);
        console.log('      Files: ' + s.files.length);
      });
      break;
    case 'compare':
      var diffs = compareWithLatest();
      if (diffs.length === 0) {
        console.log('No differences from latest snapshot');
      } else {
        console.log('\nDifferences from latest snapshot:');
        console.log(diffs.join('\n'));
      }
      break;
    default:
      console.log(`
Usage: npm run snapshot <command>

Commands:
  create [description]    Create a new snapshot
  restore               Restore of latest snapshot
  list                  List all snapshots
  compare               Compare current state with latest snapshot

Examples:
  npm run snapshot create "Before refactoring background.js"
  npm run snapshot restore
  npm run snapshot list
      `);
  }
}

module.exports = {
  createSnapshot: createSnapshot,
  restoreLatest: restoreLatest,
  listSnapshots: listSnapshots,
  compareWithLatest: compareWithLatest
};