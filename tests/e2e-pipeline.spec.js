// tests/e2e-pipeline.spec.js
import { test, expect } from '@playwright/test';

// Config
const REACT_APP_URL = 'http://localhost:5173/#youtube_analytics/dfl';

test('DFL Command Center Industrial Loop - Zero Cost Simulation', async ({ page }) => {
    console.log("🧪 [E2E Test] Initiating Playwright industrial agent...");

    // 1. Access Command Center
    console.log("🌐 Navigating to DFL Combat Center...");
    await page.goto(REACT_APP_URL, { timeout: 60000 });

    // 2. Wait for Radar signals (The "Start Hijack" button)
    console.log("📡 Listening for VPH Radar breakout...");
    const hijackBtn = page.getByRole('button', { name: /Start Hijack|一键截胡/i }).first();
    await expect(hijackBtn).toBeVisible({ timeout: 20000 });

    // 3. Manual Ignite via Proxy
    console.log("🎯 Target locked. Commencing mission hijack...");
    await hijackBtn.click();

    // 4. Monitor Industrial Stages
    console.log("🏭 Monitoring Industrial Pipeline Matrix...");

    const waitForStage = async (stageName) => {
        console.log(`   ⏳ Waiting for: [${stageName}]`);
        // We look for the stage text in elements that represent active or completed states
        await expect(page.locator('span').filter({ hasText: stageName })).toBeVisible({ timeout: 60000 });
        console.log(`   ✅ Stage reached: ${stageName}`);
    };

    // Assert mission progression with generous timeout for mocked delays
    await waitForStage('提取基因');
    await waitForStage('变异重组');
    await waitForStage('硬核合成');
    await waitForStage('自愈上传');
    await waitForStage('驻扎完毕');

    console.log("\n🎉 [SUCCESS] E2E Industrial Loop Verified via Playwright. System sync perfect.");
});
