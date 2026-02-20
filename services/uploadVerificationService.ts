/**
 * Upload Verification Service
 * 
 * Provides automatic screenshot capture and detailed logging for upload verification.
 * 
 * @module services/uploadVerificationService
 * @version 1.0.0
 * @date 2026-01-13
 */

// Declare chrome types for extension context
declare const chrome: {
  runtime?: {
    sendMessage?: (message: any, callback?: (response?: any) => void) => void;
    lastError?: any;
  };
  tabs?: {
    captureVisibleTab?: (
      windowId: number | null,
      options: { format: 'jpeg' | 'png' },
      callback: (dataUrl?: string) => void
    ) => void;
  };
};

interface VerificationSnapshot {
  timestamp: number;
  type: 'upload_start' | 'upload_progress' | 'upload_complete' | 'upload_failed';
  screenshot?: string; // Base64 encoded screenshot
  progress?: number;
  status?: string;
  details?: Record<string, any>;
  error?: string;
}

interface VerificationLog {
  uploadId: string;
  platform: 'youtube' | 'tiktok' | 'google_vids';
  snapshots: VerificationSnapshot[];
  finalStatus: 'success' | 'failed' | 'timeout';
  videoUrl?: string;
  metadata?: Record<string, any>;
}

const STORAGE_KEY = 'upload_verification_logs';

/**
 * Capture a screenshot of the current page.
 * 
 * @returns {Promise<string>} Base64 encoded screenshot or null
 */
export async function captureScreenshot(): Promise<string | null> {
  // Check if we're in a context where screenshots are possible
  if (!document.querySelector('[data-verification-screenshot]')) {
    console.warn('⚠️ [VerificationService] Screenshot not available in this context');
    return null;
  }

  try {
    // Try using chrome.tabs.captureVisibleTab if in extension
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.captureVisibleTab) {
      return new Promise((resolve) => {
        if (chrome.tabs.captureVisibleTab) {
          chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
            if (chrome.runtime && chrome.runtime.lastError) {
              console.warn('⚠️ [VerificationService] Screenshot capture failed:', chrome.runtime.lastError);
              resolve(null);
            } else {
              resolve(dataUrl);
            }
          });
        } else {
          resolve(null);
        }
      });
    }

    // Fallback: Return a textual representation
    return null;
  } catch (e) {
    console.error('❌ [VerificationService] Screenshot capture error:', e);
    return null;
  }
}

/**
 * Get page text for logging.
 * 
 * @returns {string} Page text summary
 */
export function getPageTextSummary(): string {
  const allText = document.body.innerText || '';
  
  // Extract key information
  const summary = {
    title: document.title,
    url: window.location.href,
    uploadProgress: extractUploadProgress(allText),
    statusText: extractStatusText(allText),
    visibleButtons: extractVisibleButtons(),
    timestamp: new Date().toISOString()
  };

  return JSON.stringify(summary, null, 2);
}

/**
 * Extract upload progress from page text.
 */
function extractUploadProgress(text: string): { percentage: number; status: string } {
  const percentageMatch = text.match(/(\d+)%/);
  const percentage = percentageMatch ? parseInt(percentageMatch[1]) : 0;

  let status = 'unknown';
  if (text.includes('Uploading')) status = 'uploading';
  else if (text.includes('Processing')) status = 'processing';
  else if (text.includes('Checks complete') || text.includes('检查完毕')) status = 'checks_complete';
  else if (text.includes('Scheduled')) status = 'scheduled';
  else if (text.includes('Published')) status = 'published';

  return { percentage, status };
}

/**
 * Extract status text from page.
 */
function extractStatusText(text: string): string[] {
  const statuses: string[] = [];
  
  const patterns = [
    /Checks complete/i,
    /检查完毕/i,
    /Video processing complete/i,
    /Upload complete/i,
    /Scheduled/i,
    /Published/i,
    /Processing/i,
    /Uploading/i
  ];

  patterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      statuses.push(matches[0]);
    }
  });

  return [...new Set(statuses)];
}

/**
 * Extract visible buttons for logging.
 */
function extractVisibleButtons(): string[] {
  const buttons = Array.from(document.querySelectorAll('button, ytcp-button'));
  const visibleButtons = buttons
    .filter(btn => {
      const el = btn as HTMLElement;
      return el.offsetParent !== null;
    })
    .map(btn => (btn.textContent || '').trim())
    .filter(Boolean)
    .slice(0, 10); // Limit to first 10

  return visibleButtons;
}

/**
 * Create a verification snapshot.
 */
export async function createSnapshot(
  uploadId: string,
  type: VerificationSnapshot['type'],
  details?: Record<string, any>
): Promise<VerificationSnapshot> {
  const snapshot: VerificationSnapshot = {
    timestamp: Date.now(),
    type,
    screenshot: await captureScreenshot(),
    details
  };

  // Add context-specific data
  if (type === 'upload_progress') {
    const textSummary = getPageTextSummary();
    const summary = JSON.parse(textSummary);
    snapshot.progress = summary.uploadProgress.percentage;
    snapshot.status = summary.uploadProgress.status;
  }

  return snapshot;
}

/**
 * Log verification snapshot.
 */
export async function logSnapshot(
  uploadId: string,
  platform: VerificationLog['platform'],
  snapshot: VerificationSnapshot
): Promise<void> {
  console.log(`📸 [VerificationService] Logging snapshot for ${uploadId}:`, snapshot.type);

  // Load existing logs
  const logs = loadLogs();

  // Find or create log for this upload
  let log = logs.find(l => l.uploadId === uploadId);
  if (!log) {
    log = {
      uploadId,
      platform,
      snapshots: [],
      finalStatus: 'timeout',
      metadata: {}
    };
    logs.push(log);
  }

  // Add snapshot
  log.snapshots.push(snapshot);

  // Save logs
  saveLogs(logs);

  // Send to background for persistent storage
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    try {
      chrome.runtime.sendMessage({
        action: 'LOG_VERIFICATION_SNAPSHOT',
        payload: {
          uploadId,
          platform,
          snapshot
        }
      });
    } catch (e) {
      console.warn('Failed to send snapshot to background:', e);
    }
  }
}

/**
 * Mark upload as complete with final status.
 */
export async function completeVerification(
  uploadId: string,
  status: VerificationLog['finalStatus'],
  videoUrl?: string,
  metadata?: Record<string, any>
): Promise<void> {
  console.log(`✅ [VerificationService] Completing verification for ${uploadId}:`, status);

  // Capture final snapshot
  const finalSnapshot = await createSnapshot(uploadId, 
    status === 'success' ? 'upload_complete' : 'upload_failed',
    { videoUrl, status }
  );

  // Update log
  const logs = loadLogs();
  const log = logs.find(l => l.uploadId === uploadId);
  if (log) {
    log.snapshots.push(finalSnapshot);
    log.finalStatus = status;
    if (videoUrl) log.videoUrl = videoUrl;
    if (metadata) log.metadata = { ...log.metadata, ...metadata };
    saveLogs(logs);

    // Send to background
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        chrome.runtime.sendMessage({
          action: 'COMPLETE_VERIFICATION',
          payload: {
            uploadId,
            status,
            videoUrl,
            metadata,
            snapshots: log.snapshots
          }
        });
      } catch (e) {
        console.warn('Failed to send completion to background:', e);
      }
    }
  }

  // Create summary report
  const summary = generateVerificationSummary(log);
  console.log('📊 [VerificationService] Verification Summary:', JSON.stringify(summary, null, 2));

  // Store summary for display in React app
  localStorage.setItem(`verification_${uploadId}`, JSON.stringify(summary));
  console.log(`✅ [VerificationService] Summary stored for ${uploadId}`);
}

/**
 * Generate verification summary report.
 */
function generateVerificationSummary(log: VerificationLog): any {
  const duration = log.snapshots.length >1 
    ? (log.snapshots[log.snapshots.length - 1].timestamp - log.snapshots[0].timestamp) / 1000 
    : 0;

  const progressSnapshots = log.snapshots.filter(s => s.type === 'upload_progress');
  const finalProgress = progressSnapshots.length > 0 
    ? progressSnapshots[progressSnapshots.length - 1].progress 
    : null;

  return {
    uploadId: log.uploadId,
    platform: log.platform,
    finalStatus: log.finalStatus,
    duration: `${duration.toFixed(1)}s`,
    snapshotCount: log.snapshots.length,
    finalProgress: finalProgress ? `${finalProgress}%` : 'unknown',
    videoUrl: log.videoUrl || 'N/A',
    metadata: log.metadata
  };
}

/**
 * Load verification logs from localStorage.
 */
function loadLogs(): VerificationLog[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error('❌ [VerificationService] Failed to load logs:', e);
    return [];
  }
}

/**
 * Save verification logs to localStorage.
 */
function saveLogs(logs: VerificationLog[]): void {
  try {
    // Keep only last 50 logs to prevent storage bloat
    const trimmed = logs.slice(-50);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.error('❌ [VerificationService] Failed to save logs:', e);
  }
}

/**
 * Get verification log for a specific upload.
 */
export function getVerificationLog(uploadId: string): VerificationLog | null {
  const logs = loadLogs();
  return logs.find(l => l.uploadId === uploadId) || null;
}

/**
 * Clear old verification logs (older than 7 days).
 */
export function clearOldLogs(): void {
  const logs = loadLogs();
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const filtered = logs.filter(l => {
    const lastSnapshot = l.snapshots[l.snapshots.length - 1];
    return lastSnapshot && lastSnapshot.timestamp > sevenDaysAgo;
  });
  saveLogs(filtered);
  console.log(`🧹 [VerificationService] Cleared ${logs.length - filtered.length} old logs`);
}

/**
 * Auto-monitor upload progress with periodic snapshots.
 */
export async function monitorUpload(
  uploadId: string,
  platform: VerificationLog['platform'],
  onComplete: (status: VerificationLog['finalStatus'], videoUrl?: string) => void,
  options?: { intervalMs?: number; maxDuration?: number }
): Promise<void> {
  const { intervalMs = 5000, maxDuration = 60000 } = options || {};

  console.log(`📊 [VerificationService] Starting upload monitoring for ${uploadId}`);

  // Log initial snapshot
  await logSnapshot(
    uploadId,
    platform,
    await createSnapshot(uploadId, 'upload_start')
  );

  const startTime = Date.now();
  let lastProgress = 0;

  const interval = setInterval(async () => {
    const elapsed = Date.now() - startTime;

    // Check timeout
    if (elapsed > maxDuration) {
      clearInterval(interval);
      await completeVerification(uploadId, 'timeout');
      onComplete('timeout');
      return;
    }

    // Create progress snapshot
    const snapshot = await createSnapshot(uploadId, 'upload_progress');
    
    // Check if progress has changed
    const currentProgress = snapshot.progress || 0;
    if (currentProgress !== lastProgress) {
      await logSnapshot(uploadId, platform, snapshot);
      lastProgress = currentProgress;
    }

    // Check if upload is complete
    if (snapshot.status === 'published' || snapshot.status === 'scheduled' || snapshot.progress === 100) {
      clearInterval(interval);
      await completeVerification(uploadId, 'success');
      onComplete('success', snapshot.details?.videoUrl);
    }
  }, intervalMs);
}

// Expose for use in content scripts
if (typeof window !== 'undefined') {
  (window as any).UploadVerificationService = {
    captureScreenshot,
    logSnapshot,
    completeVerification,
    getVerificationLog,
    monitorUpload,
    clearOldLogs
  };
}
