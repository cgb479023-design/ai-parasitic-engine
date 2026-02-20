// h:\AI_Neural_Engine_Clean_v3.5\server\videoSynthesisService.js
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import ffmpeg from 'fluent-ffmpeg';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- 配置参数 (建议写入 .env 文件) ---
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
// 选择一个极具煽动性的声音 ID (比如 Adam 或特定的解说员声音)
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "pNInz6obpgDQGcFmaJcg";
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
 */
export async function synthesizeShortsVideo(scriptText, rawVideoPath, outputFilename) {
  console.log(`\n🎬 [Muxer Engine] 开始进行工业级音视频合成...`);
  const audioOutputPath = path.join(TEMP_DIR, `${Date.now()}_voiceover.mp3`);
  const finalVideoPath = path.join(TEMP_DIR, outputFilename);

  try {
    // Step 1: 调用 ElevenLabs 提炼极具感染力的人声
    console.log(`[Step 1] 正在唤醒 ElevenLabs 生成神经语音...`);
    await generateVoiceover(scriptText, audioOutputPath);
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
 * 引擎 1：ElevenLabs 语音生成器
 */
async function generateVoiceover(text, outputPath) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'xi-api-key': ELEVENLABS_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: text,
      model_id: "eleven_multilingual_v2", // 支持多语言，发音极其自然
      voice_settings: {
        stability: 0.5,       // 降低稳定性以增加情绪波动和“人味”
        similarity_boost: 0.75,
        style: 0.2
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs API 拒绝访问: ${response.statusText} - ${errorText}`);
  }

  // 将音频流写入本地文件
  const dest = fs.createWriteStream(outputPath);
  response.body.pipe(dest);

  return new Promise((resolve, reject) => {
    dest.on('finish', resolve);
    dest.on('error', reject);
  });
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
