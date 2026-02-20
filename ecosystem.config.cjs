module.exports = {
    apps: [
        {
            name: "neural-engine-core",       // 进程名称
            script: "./server/index.js",      // 你的主入口文件
            instances: 1,                     // 对于涉及到本地 SQLite 写操作的，建议单实例运行防止锁表
            autorestart: true,                // 核心：崩溃自动重启！
            watch: false,                     // 生产环境关闭 watch，避免临时文件变动导致频繁重启
            max_memory_restart: "2G",         // 防御性设置：如果 FFmpeg 合成导致内存泄漏，超过 2G 自动杀掉并重启清理内存
            env: {
                NODE_ENV: "production",
            },
            log_date_format: "YYYY-MM-DD HH:mm:ss Z",
            error_file: "./logs/engine-error.log", // 崩溃日志单独隔离
            out_file: "./logs/engine-out.log",     // 正常输出日志
            merge_logs: true
        }
    ]
};
