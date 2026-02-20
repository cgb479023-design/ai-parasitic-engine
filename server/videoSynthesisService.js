// h:\AI_Neural_Engine_Clean_v3.5\server\videoSynthesisService.js
import ffmpeg from 'fluent-ffmpeg';
import { fileURLToPath } from 'url';
import { generateElevenLabsVoiceover } from './adapters/vocalAdapter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMP_DIR = path.join(__dirname, 'temp_assets');

// 确保临时工作目录存在
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * 主工作流：从脚本文本到最终的成品短视频
 * @param {string} scriptText - Gemini 生成的爆款剧本
 * @param {string} rawVideoPath - geminigen.ai 生成的原始无声视频素材路径
 * @param {string} outputFilename - 输出的最终文件名
 * @param {Function} vocalAdapter - [V11.3] 可选的声线适配器 (默认为 ElevenLabs)
 */
export async function synthesizeShortsVideo(scriptText, rawVideoPath, outputFilename, vocalAdapter = generateElevenLabsVoiceover) {
  console.log(`\n🎬 [Muxer Engine] 开始进行工业级音视频合成...`);
  const audioOutputPath = path.join(TEMP_DIR, `${Date.now()}_voiceover.mp3`);
  const finalVideoPath = path.join(TEMP_DIR, outputFilename);

  try {
    // Step 1: 调用适配器提炼极具感染力的人声 (符合 Open-Closed 原则)
    console.log(`[Step 1] 正在通过适配器生成神经语音...`);
    await vocalAdapter(scriptText, audioOutputPath);
    console.log(`[Step 1] ✅ 语音轨道生成完毕: ${audioOutputPath}`);

    // Step 2: 使用 FFmpeg 进行底层音视频轨道合并 (Muxing)
    console.log(`[Step 2] 正在启动 FFmpeg 引擎，合并画面与声音...`);
    await muxVideoAndAudio(rawVideoPath, audioOutputPath, finalVideoPath);
    console.log(`[Step 2] ✅ 成片压制成功: ${finalVideoPath}`);

    // Clean up audio
    if (fs.existsSync(audioOutputPath)) {
      fs.unlinkSync(audioOutputPath);
    }

    return finalVideoPath;
  } catch (error) {
    console.error(`❌ [Muxer Error] 合成流水线崩溃:`, error.message);
    throw error;
  }
}

/**
 * 引擎 2：FFmpeg 轨道压制机 (Muxer)
 * 工业级设定：如果视频比音频短，视频将自动循环播放以匹配语音长度！
 */
function muxVideoAndAudio(videoPath, audioPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(videoPath)
      .inputOptions(['-stream_loop -1']) // 🔄 视频轨道死循环
      .input(audioPath)
      .outputOptions([
        '-c:v libx264',   // 使用 H.264 编码以确保 YouTube 完美兼容
        '-preset fast',   // 编码速度
        '-c:a aac',       // 音频使用 AAC 编码
        '-b:a 192k',      // 高质量音频比特率
        '-map 0:v:0',     // 🛡️ 强制提取输入 1 (视频文件) 的第一条视频轨
        '-map 1:a:0',     // 🛡️ 强制提取输入 2 (音频文件) 的第一条音频轨
        '-shortest',      // 🎧 核心设定：当最短的流（通常是音频）结束时，立刻停止编码
        '-pix_fmt yuv420p'// 确保色彩空间被所有播放器兼容
      ])
      .save(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', (err) => {
        console.error('FFmpeg 报错日志:', err.message);
        reject(err);
      });
  });
}
