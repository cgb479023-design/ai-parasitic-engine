// ecosystem.config.cjs (V2.0 工业绞肉机终极守护配置)

module.exports = {
    apps: [
        {
            name: 'neural-engine-core',        // 舰队核心代号
            script: './server/index.js',       // 指挥部主入口

            // 🛡️ 核心护甲 1：防止 SQLite 锁死
            // 绝对不能开启集群模式 (cluster) 或大于 1 的实例数！
            // 因为 SQLite 是单文件锁，多进程并发写入会瞬间报 SQLITE_BUSY 导致流水线全毁。
            instances: 1,
            exec_mode: 'fork',

            // 🛡️ 核心护甲 2：内存泄漏熔断机制 (Memory Watchdog)
            // 我们的流水线包含 FFmpeg 压制和 Puppeteer 爬虫，长期运行极易撑爆内存。
            // 一旦 Node.js 进程内存吃超过 2GB，PM2 会无情地将其 Kill 并瞬间重启。
            // 配合我们 server/index.js 里的 "僵尸复活" 逻辑，任务会无缝断点续传！
            max_memory_restart: '2G',

            // 🛡️ 核心护甲 3：无缝无限重启
            autorestart: true,                 // 崩溃后自动拉起
            exp_backoff_restart_delay: 100,    // 防止陷入无限重启死循环 (指数级延迟重启)
            watch: false,                      // 🚨 生产环境绝对关闭！否则你生成一个临时 MP4 都会触发整个服务器重启

            // 📡 战报日志分离
            // 将普通日志和报错日志分开，方便你在 EvoMap Terminal 里精准溯源
            out_file: './logs/engine-out.log',
            error_file: './logs/engine-error.log',
            merge_logs: true,                  // 避免日志文件后缀加数字
            time: true,                        // 为每行日志强行打上标准时间戳

            // ⚙️ 环境变量矩阵
            env: {
                NODE_ENV: 'development',
                PORT: 51122
            },
            env_production: {
                NODE_ENV: 'production',
                PORT: 51122
            }
        }
    ]
};
