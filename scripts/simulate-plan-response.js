// 🧪 模拟 Ask Studio 计划响应测试脚本
// 请在 React 应用页面 (http://localhost:3000) 的控制台 (F12) 中运行此代码

(function simulatePlanResponse() {
    console.log("🧪 [Simulation] Constructing mock YPP Plan...");

    // 1. 构造模拟的计划数据 (JSON 字符串)
    const mockPlan = {
        algorithmStage: "TEST_STAGE",
        stageAnalysis: "This is a simulated plan to verify the frontend message handler.",
        schedule: [
            {
                id: "sim_1",
                title: "Test Video 1: Simulation",
                topic: "Simulation Test",
                hook: "Testing the system...",
                script: "This is a test script.",
                visuals: "Test visuals",
                tags: ["test", "simulation"],
                publishTimeLocal: new Date(Date.now() + 3600000).toLocaleString('en-US'), // 1 hour from now
                status: "pending",
                promptBlock: {
                    format: "Vertical 9:16",
                    style: "Realistic",
                    audio: "Male Voice"
                }
            },
            {
                id: "sim_2",
                title: "Test Video 2: Verification",
                topic: "Verification",
                hook: "Verifying the fix...",
                script: "This is another test script.",
                visuals: "Verification visuals",
                tags: ["verify", "fix"],
                publishTimeLocal: new Date(Date.now() + 7200000).toLocaleString('en-US'), // 2 hours from now
                status: "pending"
            }
        ]
    };

    const payload = JSON.stringify(mockPlan);

    console.log("🧪 [Simulation] Sending YPP_PLAN_RESULT message...");

    // 2. 发送消息
    window.postMessage({
        type: 'YPP_PLAN_RESULT',
        payload: payload,
        source: 'simulation_script'
    }, '*');

    console.log("✅ [Simulation] Message sent! Check if the UI updates.");
})();
