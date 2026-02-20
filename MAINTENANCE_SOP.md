# 🛡️ AI Neural Engine V2.0: 投产后巡检与保养手册 (SOP)

> **身份确认**：舰队指挥官 (Fleet Commander)
> **作战状态**：7x24h 无人值守自动化

---

## ☕ 一、 每日清晨扫雷 (Daily Quick Check)
**耗时：~2 分钟 | 目标：态势感知**

1.  **📊 A/B 战报 (CTR Matrix) 收割确认**
    - **检查项**：检查 [CTR Matrix](http://localhost:5173/#youtube_analytics/dfl) 中是否有 CTR > 10% 的爆款变异基因。
    - **决策**：若某个“备用基因”表现出断层优势，手动锁定该标题，结束该轮测试。

2.  **⚙️ 流水线 (Pipeline Matrix) 积压警告**
    - **检查项**：确认任务是否卡在“音视频合成” (Muxing) 超过 10 分钟。
    - **决策**：若卡死，执行 `pm2 restart neural-engine-core` 触发僵尸复活逻辑。

3.  **🛡️ 免疫终端 (EvoMap Logs) 战损评估**
    - **检查项**：观察是否有频繁的 `[HEALING]` 或补丁下载记录。
    - **决策**：无需干预。频繁自愈仅表示 YouTube 正在改版，系统正在自动适配。

---

## 🧹 二、 每周深度保养 (Weekly Maintenance)
**耗时：~10 分钟 | 目标：物理资源回收**

1.  **💾 清理合成残骸 (Disk Bloat Check)**
    - **风险**：进程意外中断可能导致 `temp_assets` 目录残留大体积 `.mp4` 文件。
    - **动作**：每周检查 `h:\AI_Neural_Engine_Clean_v3.5\server\temp_assets`，清理过期成片。

2.  **🔋 API 弹药库盘点 (Quota Audit)**
    - **ElevenLabs**：检查剩余字符数。高质量语音是核心耗材，防止欠费停止。
    - **Gemini**：确认 API Dashboard 是否有 429 限流记录。

3.  **🧠 记忆中枢备份 (Database Backup)**
    - **动作**：定期备份 `server/platform.db`。
    - **价值**：这里存储了所有爆款 CTR 数据，是未来训练私有化垂直大模型的核心语料。

---

## 🚨 三、 红色警戒预案 (Emergency Protocols)
**目标：应对极端风控与死锁**

| 症状 | 可能原因 | 抢救方案 |
| :--- | :--- | :--- |
| **上传频繁超时/验证码** | IP 权重降低 / 被 YouTube 标记 | 挂载动态代理池或启用 `puppeteer-extra-plugin-stealth` 插件。 |
| **SQLITE_BUSY** | 数据库并发锁死 | 检查是否有多个 PM2 实例同时写入。确保 `instances: 1`。 |
| **ElevenLabs 401/403** | API Key 泄露或到期 | 立即在 `.env` 中更新密钥并重启。 |

---
*© 2026 AI Neural Engine Project. Industrial Grade Stability.*
