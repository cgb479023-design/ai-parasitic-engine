
export default {
  "header": {
    "title": "AI 内容创作平台",
    "subtitle": "您的全流程 AI 创作助手。",
    "export": "导出",
    "settings": "设置"
  },
  "form": {
    "defaults": {
      "prompt": "一只雄鹰在日出时分翱翔于迷雾缭绕的山脉之上，电影感，4K",
      "externalHookText": "增长10倍的秘密是...",
      "thumbnailTitle": "你绝对想不到！",
      "embeddedHookText": "...就在那一刻，一切都变了。",
      "editingInstructions": "把这个做成一段15秒的TikTok病毒视频。添加字幕和一个吸引人的标题。"
    },
    "section": {
      "mode": "1. 选择生成模式",
      "concept": "2. 定义核心概念",
      "strategy": "3. 设定病毒传播策略",
      "specs": "4. 配置技术规格",
      "engine": "5. 选择生成引擎"
    },
    "submitButton": {
      "aiGen": "生成视频",
      "prompt": "生成提示词",
      "editor": "开始编辑"
    },
    "prompt": {
      "label": "提示词",
      "placeholder": "输入您想创建的视频描述..."
    },
    "editingInstructions": {
      "label": "编辑指令",
      "placeholder": "例如：'剪掉前5秒，在开头添加标题“我的旅行”，并添加字幕。'"
    },
    "duration": { "label": "时长 (秒)" },
    "aspectRatio": { "label": "宽高比" },
    "visualStyle": {
      "label": "视觉风格",
      "description": "最多选择3种风格。"
    },
    "externalHook": {
      "label": "外部钩子文本",
      "description": "用于社交媒体帖子、标题。"
    },
    "thumbnailTitle": {
      "label": "缩略图标题",
      "description": "缩略图上的文字覆盖。"
    },
    "internalHook": {
      "label": "嵌入式钩子文本",
      "description": "视频中嵌入的短语。"
    },
    "processAudio": {
      "label": "应用录音室音效",
      "description": "AI 驱动的音频清洁和增强。"
    },
    "hookType": { "label": "钩子类型" },
    "gmicloud": {
      "apiKey": {
        "label": "GMICLOUD API 密钥",
        "description": "输入您的密钥以访问 GMICLOUD 模型。",
        "placeholder": "在此粘贴您的 API 密钥",
        "invalidError": "API 密钥似乎无效。请检查并重试。"
      },
      "baseUrl": {
        "label": "自定义 API 基础地址 (可选)",
        "description": "覆盖默认端点 (例如用于 CORS 代理)。",
        "placeholder": "默认: https://console.gmicloud.ai"
      },
      "model": {
        "label": "GMICLOUD 模型",
        "placeholder": "输入 API 密钥以加载模型"
      },
      "loadModels": "加载模型"
    },
    "geminigen": {
      "apiKey": {
        "label": "GeminiGen API 密钥",
        "description": "输入您的密钥以访问 GeminiGen 生成服务。",
        "placeholder": "在此粘贴您的 API 密钥"
      },
      "baseUrl": {
        "label": "自定义 API 基础地址 (可选)",
        "description": "覆盖默认端点。",
        "placeholder": "默认: https://api.geminigen.ai"
      },
      "model": {
        "label": "GeminiGen 模型",
        "placeholder": "手动输入模型 ID (例如 kling-v1)"
      },
      "loadModels": "加载模型"
    },
    "veo": {
      "apiKey": {
        "title": "Gemini API 密钥",
        "description": "要使用 Veo 生成视频，您必须选择 API 密钥。有关计费的更多详细信息，请参阅<a href='https://ai.google.dev/gemini-api/docs/billing' target='_blank' rel='noopener noreferrer' class='underline text-yellow-300 hover:text-yellow-200'>官方文档</a>。",
        "select": "选择 API 密钥",
        "checking": "等待选择...",
        "active": "Veo API 密钥已激活",
        "change": "更改密钥"
      },
      "manual": {
        "title": "手动输入 API 密钥",
        "description": "如果弹出窗口无法使用，您可以在此处手动粘贴 API 密钥。此密钥仅保存在您的浏览会话中。",
        "valid": "API 密钥格式有效"
      }
    },
    "smartEditor": {
      "info": "点击“开始编辑”后，系统将提示您上传视频文件。"
    },
    "upload": {
      "button": "选择文件",
      "drag": "或拖放文件",
      "limit": "MP4 或 WEBM，最大 100MB。",
      "checking": "正在检查文件兼容性...",
      "checkSuccess": "文件就绪"
    }
  },
  "loading": {
    "generating": "AI 正在施展魔法...",
    "visualizing": "可视化中...",
    "progress": {
      "generatePrompt": "正在生成创意提示词...",
      "generateAnalysis": "正在生成内容分析...",
      "initiateVeo": "正在启动 Veo 引擎...",
      "veoSubmitted": "任务已提交至 Veo...",
      "veoWorking": "Veo 正在生成视频...",
      "veoFinalizing": "正在完成视频...",
      "veoPrependingThumbnail": "正在附加病毒式缩略图...",
      "veoTrimming": "正在强制执行精确时长...",
      "gmicloudSubmitted": "任务已提交至 GMICloud...",
      "gmicloudWorking": "{model} 正在为您生成视频...",
      "geminigenSubmitted": "任务已提交至 GeminiGen...",
      "geminigenWorking": "GeminiGen 正在为您生成视频...",
      "upload": {
        "parsing": "正在解析 AI 编辑指令...",
        "analyzing": "正在分析视频文件...",
        "cropping": "正在应用智能裁剪...",
        "trimming": "正在修剪至最佳长度...",
        "effects": "正在添加 AI 特效...",
        "generatingThumbnailPrompt": "正在设计病毒式缩略图概念...",
        "generatingThumbnailImage": "正在生成缩略图图像...",
        "prependingThumbnail": "正在将缩略图附加到视频...",
        "encoding": "正在编码最终视频..."
      },
      "complete": "生成完成！"
    }
  },
  "output": {
    "title": "生成完成！",
    "subtitle": "您的资产已准备就绪，准备征服世界。",
    "videoTitle": "生成的视频",
    "thumbnailTitle": "生成的缩略图",
    "thumbnailAlt": "AI 生成的视频缩略图",
    "downloadButton": "下载视频",
    "downloadButtonWait": "处理中...",
    "downloadThumbnailButton": "下载缩略图",
    "muxingAudio": "正在添加音频...",
    "viralityReport": {
      "title": "病毒传播预测报告"
    },
    "viralityScore": "病毒传播分数",
    "predictions": {
      "title": "24小时表现预测",
      "playCount": "预估播放量",
      "ctr": "预估点击率",
      "retention": "预估留存率"
    },
    "advice": {
      "title": "发布建议",
      "recommendedTimes": "推荐发布时间",
      "publishingSchedule": "发布时间表",
      "thumbnailAdvice": "缩略图建议",
      "ctaAdvice": "行动号召建议"
    },
    "marketingCopyCard": {
      "title": "营销文案"
    },
    "card": {
      "title": "标题",
      "description": "描述"
    },
    "viralTagsCard": {
      "title": "病毒标签 & 话题"
    },
    "communityHooksCard": {
      "title": "社区钩子"
    },
    "fullPromptCard": {
      "title": "扩展 AI 提示词",
      "uploadPlaceholder": "上传视频不适用。"
    },
    "resetButton": "创作另一个杰作",
    "shareResults": "分享病毒传播报告"
  },
  "promptOutput": {
    "title": "提示词生成完成！",
    "subtitle": "将此详细提示词用于您最喜欢的视频生成工具。",
    "resetButton": "创建另一个提示词"
  },
  "uploadStep": {
    "title": "智能编辑器：上传您的素材",
    "instructions": {
      "title": "说明",
      "step1": "复制生成的提示词以供参考。",
      "step2": "上传您的原始视频文件 (MP4/WebM)。",
      "step3": "AI 将把您的视频修剪至 {duration} 秒的目标时长。",
      "step4": "它将应用您的编辑指令和策略。",
      "step5": "点击“处理视频”开始。"
    },
    "promptCard": {
      "title": "生成的 AI 提示词 / 指令"
    },
    "uploadArea": {
      "backButton": "返回",
      "button": "处理视频",
      "processing": "处理中..."
    },
    "error": {
      "invalidFile": "无效的文件类型。请上传 MP4 或 WEBM。",
      "fileTooLarge": "文件过大。最大大小为 100MB。",
      "noFile": "请选择要上传的文件。"
    },
    "warning": {
      "title": "潜在的兼容性问题",
      "unseekable": "此视频文件可能具有不寻常的编码，可能导致处理失败或非常缓慢。<br/><br/>我们建议重新编码为标准 MP4 (H.264) 格式以获得最佳效果。您仍要继续吗？",
      "cancel": "取消上传",
      "proceedAnyway": "仍然继续"
    }
  },
  "upload": {
    "title": "智能视频编辑器",
    "description": "将视频文件拖放到此处以开始使用 AI 编辑。",
    "button": "从电脑选择",
    "fileTypes": "支持 MP4, WebM, MOV"
  },
  "trimming": {
    "preview": "预览修剪：{currentTime}秒 / {trimDuration}秒"
  },
  "error": {
    "title": "发生错误",
    "apiKeyMissing": "API 密钥未配置。",
    "modelNotFound": "所选模型 ({model}) 不存在或您的 API 密钥无权访问。请在设置中点击“检查连接”并选择其他模型。",
    "apiKeyInvalid": "所选 API 密钥无效或项目未启用计费 (错误: Requested entity was not found). Please select a project with an <b>active billing account</b>. Check the <a href='https://ai.google.dev/gemini-api/docs/billing' target='_blank' rel='noopener noreferrer' class='underline text-blue-300 hover:text-blue-200'>文档</a>了解更多详情。",
    "geminiParse": "无法从 AI 解析出有效响应。服务器可能繁忙，请重试。",
    "veoUriMissing": "Veo 生成成功，但在响应中未找到视频/缩略图 URL。",
    "veoFetchFailed": "从 URI 获取生成的视频失败。状态：{status}",
    "veoVideoEmpty": "AI 生成的视频文件为空。这可能是暂时的服务问题，请稍后重试。",
    "veoProcessingFailed": "视频处理失败。请稍后再试。",
    "videoApiNotSupported": "您的浏览器不支持智能编辑器所需的高级 API。请在桌面端尝试使用 Chrome 或 Edge 浏览器。",
    "quotaExceeded": "您已超出 API 请求配额。请稍后重试，或检查您的账单和速率限制详情。更多信息请访问 <a href='https://ai.google.dev/gemini-api/docs/rate-limits' target='_blank' rel='noopener noreferrer' class='underline text-blue-300 hover:text-blue-200'>Google API 文档</a>。",
    "systemError": "发生了一个系统错误，我们的团队已收到通知。请稍后再试。"
  },
  "gemini": {
    "error": {
      "transcriptGeneration": "转录生成失败",
      "planGeneration": "编辑计划生成失败"
    },
    "prompt": {
      "createPlan": "你是一个专业的视频编辑。用户请求：“{instructions}”。基于此请求和提供的视频转录，创建一个详细的编辑计划。返回 JSON。",
      "createThumbnailPrompt": "基于以下视频描述，创建一个用于生成高质量缩略图的提示词：{description}"
    },
    "systemInstruction": {
      "editorAnalysis": "你是一个视频内容分析专家。分析视频的病毒传播潜力。",
      "createPlan": "你是一个专业的视频编辑助手。请输出 JSON 格式的编辑计划。",
      "createThumbnailPrompt": "你是一个专业的视觉设计师。请输出 JSON 格式的提示词。"
    }
  },
  "copy": {
    "copied": "已复制！",
    "resultsCopied": "报告已复制！"
  },
  "share": {
    "title": "🚀 我的 AI 视频病毒传播报告 🚀",
    "score": "病毒传播分数：{score}/100 (等级：{grade})",
    "playCount": "播放量 (24h)：{count}K",
    "ctr": "点击率：{ctr}%",
    "retention": "留存率：{retention}%",
    "footer": "由 AI 内容创作平台生成"
  },
  "manual": {
    "title": "平台操作与能力指南 v3.1",
    "close": "关闭指南",
    "content": `
    <div class="space-y-8">
        <!-- 核心价值 -->
        <section>
            <div class="flex items-center gap-3 mb-4">
                <div class="w-1 h-6 bg-purple-500 rounded-full"></div>
                <h3 class="text-xl font-bold text-white tracking-wide">我们为您解决什么？</h3>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="p-4 bg-white/5 border border-white/10 rounded-xl">
                    <div class="flex items-center gap-2 mb-2 text-purple-400 font-bold text-sm uppercase tracking-wider">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                        解决创意枯竭
                    </div>
                    <p class="text-slate-400 text-sm">不知道拍什么？只需输入一个简单的想法（如“咖啡广告”），AI 会自动扩展为完整的电影级分镜脚本。</p>
                </div>
                <div class="p-4 bg-white/5 border border-white/10 rounded-xl">
                    <div class="flex items-center gap-2 mb-2 text-blue-400 font-bold text-sm uppercase tracking-wider">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z"></path></svg>
                        突破流量瓶颈
                    </div>
                    <p class="text-slate-400 text-sm">不仅仅是生成视频，我们内置的算法引擎会预测“病毒传播分数”，并提供发布时间、标签和互动钩子建议。</p>
                </div>
                <div class="p-4 bg-white/5 border border-white/10 rounded-xl">
                    <div class="flex items-center gap-2 mb-2 text-pink-400 font-bold text-sm uppercase tracking-wider">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                        降低技术门槛
                    </div>
                    <p class="text-slate-400 text-sm">无需学习复杂的剪辑软件（Pr/Ae）。从缩略图设计到音频混合，AI 全自动处理技术细节。</p>
                </div>
                 <div class="p-4 bg-white/5 border border-white/10 rounded-xl">
                    <div class="flex items-center gap-2 mb-2 text-green-400 font-bold text-sm uppercase tracking-wider">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        全流程极速交付
                    </div>
                    <p class="text-slate-400 text-sm">从构思到成片下载，传统流程需要数小时，我们只需几分钟。包括营销文案一键复制。</p>
                </div>
            </div>
        </section>

        <!-- 操作步骤 -->
        <section>
            <div class="flex items-center gap-3 mb-4">
                 <div class="w-1 h-6 bg-blue-500 rounded-full"></div>
                <h3 class="text-xl font-bold text-white tracking-wide">操作流程</h3>
            </div>
            
            <div class="relative border-l border-slate-700 ml-3 space-y-8 py-2">
                <div class="relative pl-8">
                    <div class="absolute -left-3 top-0 w-6 h-6 bg-slate-800 border-2 border-purple-500 rounded-full flex items-center justify-center text-xs font-bold text-purple-400">1</div>
                    <h4 class="font-bold text-slate-200 mb-1">选择模式 (Mode Selection)</h4>
                    <p class="text-slate-400 text-sm mb-2">根据您的需求选择入口：</p>
                    <ul class="list-disc list-inside text-xs text-slate-500 space-y-1 ml-2">
                        <li><strong class="text-slate-300">AI 生成:</strong> 适合从零开始，只有创意没有素材。</li>
                        <li><strong class="text-slate-300">智能编辑器:</strong> 适合已有拍摄素材，需要 AI 剪辑、配字幕和配乐。</li>
                        <li><strong class="text-slate-300">仅生成提示词:</strong> 适合生成用于 Midjourney 或 Runway 的专业指令。</li>
                    </ul>
                </div>

                <div class="relative pl-8">
                    <div class="absolute -left-3 top-0 w-6 h-6 bg-slate-800 border-2 border-purple-500 rounded-full flex items-center justify-center text-xs font-bold text-purple-400">2</div>
                    <h4 class="font-bold text-slate-200 mb-1">定义与配置 (Strategy & Specs)</h4>
                    <p class="text-slate-400 text-sm mb-2">这是决定视频质量的关键：</p>
                    <ul class="list-disc list-inside text-xs text-slate-500 space-y-1 ml-2">
                        <li><strong class="text-slate-300">核心概念:</strong> 描述越具体越好（主体、环境、动作、氛围）。</li>
                        <li><strong class="text-slate-300">病毒钩子:</strong> 设置前3秒的吸引力文本（如“你不知道的秘密...”）。</li>
                        <li><strong class="text-slate-300">视觉风格:</strong> 选择如“VHS复古”或“赛博朋克”来定调。</li>
                        <li><strong class="text-slate-300">时长与画幅:</strong> TikTok 选 9:16，YouTube 选 16:9。</li>
                    </ul>
                </div>

                <div class="relative pl-8">
                    <div class="absolute -left-3 top-0 w-6 h-6 bg-slate-800 border-2 border-purple-500 rounded-full flex items-center justify-center text-xs font-bold text-purple-400">3</div>
                    <h4 class="font-bold text-slate-200 mb-1">引擎生成 (AI Engine Processing)</h4>
                    <p class="text-slate-400 text-sm">点击生成后，系统将并行处理：</p>
                    <div class="flex gap-2 mt-2">
                        <span class="px-2 py-1 bg-slate-800 rounded text-xs border border-slate-700 text-slate-400">脚本扩展</span>
                        <span class="px-2 py-1 bg-slate-800 rounded text-xs border border-slate-700 text-slate-400">视频生成 (Veo)</span>
                        <span class="px-2 py-1 bg-slate-800 rounded text-xs border border-slate-700 text-slate-400">缩略图设计</span>
                        <span class="px-2 py-1 bg-slate-800 rounded text-xs border border-slate-700 text-slate-400">流量预测</span>
                    </div>
                </div>

                <div class="relative pl-8">
                     <div class="absolute -left-3 top-0 w-6 h-6 bg-slate-800 border-2 border-green-500 rounded-full flex items-center justify-center text-xs font-bold text-green-400">4</div>
                    <h4 class="font-bold text-slate-200 mb-1">任务报告与导出 (Mission Report)</h4>
                    <p class="text-slate-400 text-sm">最终页面不仅仅是下载链接，而是一份战略报告：</p>
                    <ul class="list-disc list-inside text-xs text-slate-500 space-y-1 ml-2 mt-2">
                        <li>下载 1080P 高清无水印视频。</li>
                        <li>获取高点击率 (CTR) 封面图。</li>
                        <li>复制 AI 撰写的爆款标题和描述。</li>
                        <li>查看发布时间建议和流量预测评分。</li>
                    </ul>
                </div>
            </div>
        </section>
    </div>
    `
  },
  "editor": {
    "modal": {
      "title": "描述您的视频",
      "description": "为了生成准确的字幕，请简要描述视频内容。",
      "placeholder": "例如：'一个人在屏幕录制中解释新软件功能。'",
      "button": "生成字幕"
    },
    "transcribing": "AI 正在转录您的视频...",
    "transcript": {
      "title": "字幕",
      "addSpeaker": "添加发言人",
      "placeholder": "正在生成字幕..."
    },
    "canvas": {
      "write": "文字",
      "layout": "布局",
      "background": "背景"
    },
    "previewMode": "预览模式：红色区域将被跳过。点击“导出”以获取最终视频。",
    "rightPanel": {
      "underlord": "Underlord AI",
      "planTitle": "AI 编辑计划",
      "applyButton": "应用编辑",
      "processing": "思考中...",
      "initialPlan": "我准备好帮您编辑这个视频了。告诉我您想做什么。例如：\n* '把这个做成一段15秒的TikTok病毒视频。'\n* '添加字幕和一个标题。'\n* '剪掉我咳嗽的部分。'",
      "askPlaceholder": "要求 AI 编辑...",
      "disclaimer": "AI 可能会产生不准确的信息。",
      "project": "项目",
      "aiTools": "AI 工具",
      "properties": "属性",
      "elements": "元素",
      "captions": "字幕",
      "media": "媒体"
    },
    "timeline": {
      "split": "分割"
    }
  },
  "constants": {
    "visualStyle": {
      "cctv": "CCTV 监控风",
      "nightVision": "夜视仪风格",
      "daylight": "自然日光",
      "vhsRetro": "VHS 复古录像带",
      "documentaryNature": "自然纪录片",
      "sciFiHologram": "科幻全息投影"
    },
    "aspectRatio": {
      "vertical": "9:16 竖屏",
      "horizontal": "16:9 横屏",
      "square": "1:1 正方形"
    },
    "hookType": {
      "timeBased": "基于时间",
      "visualCue": "视觉提示",
      "timeBasedDescription": "基于特定时间点的钩子。",
      "visualCueDescription": "基于视觉事件的钩子。"
    },
    "generationMode": {
      "aiGeneration": "AI 视频生成",
      "aiGenerationDescription": "基于提示词使用 AI 生成视频。",
      "smartEditor": "智能编辑器",
      "smartEditorDescription": "上传素材进行 AI 辅助剪辑。",
      "promptOnly": "仅生成提示词",
      "promptOnlyDescription": "生成用于外部工具的详细提示词。"
    },
    "engine": {
      "veo": "Veo",
      "gmicloud": "GMICLOUD",
      "geminigen": "GeminiGen",
      "googlevids": "Google Vids"
    }
  }
}