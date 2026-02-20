
export default {
  "header": {
    "title": "AI Content Creation Platform",
    "subtitle": "Your AI assistant for the entire content creation workflow.",
    "export": "Export"
  },
  "form": {
    "defaults": {
      "prompt": "A majestic eagle soaring over a misty mountain range at sunrise, cinematic, 4K",
      "externalHookText": "The secret to 10x growth is...",
      "thumbnailTitle": "You Won't Believe This!",
      "embeddedHookText": "...and that's when everything changed.",
      "editingInstructions": "Make this a 15 second viral clip for TikTok. Add subtitles and a catchy title."
    },
    "section": {
      "mode": "1. Select Generation Mode",
      "concept": "2. Define Your Core Concept",
      "strategy": "3. Set Your Virality Strategy",
      "specs": "4. Configure Technical Specs",
      "engine": "5. Choose Generation Engine"
    },
    "submitButton": {
      "aiGen": "Generate Video",
      "prompt": "Generate Prompt",
      "editor": "Start Editing"
    },
    "prompt": {
      "label": "Prompt",
      "placeholder": "Enter a description of the video you want to create..."
    },
    "editingInstructions": {
      "label": "Editing Instructions",
      "placeholder": "e.g., 'Cut the first 5 seconds, add a title 'My Trip' at the beginning, and add subtitles.'"
    },
    "duration": {
      "label": "Duration (seconds)"
    },
    "aspectRatio": {
      "label": "Aspect Ratio"
    },
    "visualStyle": {
      "label": "Visual Style",
      "description": "Select up to 3 styles."
    },
    "externalHook": {
      "label": "External Hook Text",
      "description": "Text for social media posts, titles."
    },
    "thumbnailTitle": {
      "label": "Thumbnail Title",
      "description": "Text overlay for the thumbnail."
    },
    "internalHook": {
      "label": "Embedded Hook Text",
      "description": "A phrase to be visually embedded in the video."
    },
    "processAudio": {
      "label": "Apply Studio Sound",
      "description": "AI-powered audio cleaning and enhancement."
    },
    "hookType": { "label": "Hook Type" },
    "gmicloud": {
      "apiKey": {
        "label": "GMICLOUD API Key",
        "description": "Enter your key to access GMICLOUD models.",
        "placeholder": "Paste your API key here",
        "invalidError": "API Key seems invalid. Please check and try again."
      },
      "baseUrl": {
        "label": "Custom API Base URL (Optional)",
        "description": "Override default endpoint (e.g. for CORS proxy).",
        "placeholder": "Default: https://console.gmicloud.ai"
      },
      "model": {
        "label": "GMICLOUD Model",
        "placeholder": "Enter API Key to load models"
      },
      "loadModels": "Load Models"
    },
    "geminigen": {
      "apiKey": {
        "label": "GeminiGen API Key",
        "description": "Enter your key to access GeminiGen generation.",
        "placeholder": "Paste your API key here"
      },
      "baseUrl": {
        "label": "Custom API Base URL (Optional)",
        "description": "Override default endpoint.",
        "placeholder": "Default: https://api.geminigen.ai"
      },
      "model": {
        "label": "GeminiGen Model",
        "placeholder": "Enter Model ID manually (e.g. kling-v1)"
      },
      "loadModels": "Load Models"
    },
    "veo": {
      "apiKey": {
        "title": "Veo Engine Requires API Key",
        "description": "To generate videos with Veo, you must select an API key. For more details on billing, please see the <a href='https://ai.google.dev/gemini-api/docs/billing' target='_blank' rel='noopener noreferrer' class='underline text-yellow-300 hover:text-yellow-200'>official documentation</a>.",
        "select": "Select API Key",
        "checking": "Waiting for selection...",
        "active": "Veo API Key Active",
        "change": "Change Key"
      }
    },
    "smartEditor": {
      "info": "You will be prompted to upload your video file after clicking 'Start Editing'."
    },
    "upload": {
      "button": "Choose a file",
      "drag": "or drag and drop",
      "limit": "MP4 or WEBM, max 100MB.",
      "checking": "Checking file compatibility...",
      "checkSuccess": "File ready",
    }
  },
  "loading": {
    "generating": "AI is Working Its Magic...",
    "visualizing": "VISUALIZING...",
    "progress": {
      "generatePrompt": "Generating creative prompt...",
      "generateAnalysis": "Generating content analysis...",
      "initiateVeo": "Initiating Veo engine...",
      "veoSubmitted": "Job submitted to Veo...",
      "veoWorking": "Veo is generating video...",
      "veoFinalizing": "Finalizing video...",
      "veoPrependingThumbnail": "Attaching viral thumbnail...",
      "veoTrimming": "Enforcing exact duration...",
      "gmicloudSubmitted": "Job submitted to GMICloud...",
      "gmicloudWorking": "{model} is generating your video...",
      "geminigenSubmitted": "Job submitted to GeminiGen...",
      "geminigenWorking": "GeminiGen is generating your video...",
      "upload": {
        "parsing": "Parsing AI editing instructions...",
        "analyzing": "Analyzing video file...",
        "cropping": "Applying smart crop...",
        "trimming": "Trimming to optimal length...",
        "effects": "Adding AI effects...",
        "generatingThumbnailPrompt": "Designing viral thumbnail concept...",
        "generatingThumbnailImage": "Generating thumbnail image...",
        "prependingThumbnail": "Attaching thumbnail to video...",
        "encoding": "Encoding final video...",
      },
      "complete": "Generation complete!"
    }
  },
  "output": {
    "title": "Generation Complete!",
    "subtitle": "Here are your assets, ready for world domination.",
    "videoTitle": "Generated Video",
    "thumbnailTitle": "Generated Thumbnail",
    "thumbnailAlt": "AI-generated video thumbnail",
    "downloadButton": "Download Video",
    "downloadButtonWait": "Processing...",
    "downloadThumbnailButton": "Download Thumbnail",
    "muxingAudio": "Adding Audio...",
    "viralityReport": {
      "title": "Virality Prediction Report"
    },
    "viralityScore": "Virality Score",
    "predictions": {
      "title": "24h Performance Predictions",
      "playCount": "Est. Plays",
      "ctr": "Est. CTR",
      "retention": "Est. Retention"
    },
    "advice": {
      "title": "Publishing Advice",
      "recommendedTimes": "Recommended Post Times",
      "publishingSchedule": "Publishing Schedule",
      "thumbnailAdvice": "Thumbnail Advice",
      "ctaAdvice": "CTA Advice"
    },
    "marketingCopyCard": {
      "title": "Marketing Copy"
    },
    "card": {
      "title": "Title",
      "description": "Description"
    },
    "viralTagsCard": {
      "title": "Viral Tags & Hashtags"
    },
    "communityHooksCard": {
      "title": "Community Hooks"
    },
    "fullPromptCard": {
      "title": "Expanded AI Prompt",
      "uploadPlaceholder": "N/A for uploaded videos."
    },
    "resetButton": "Create Another Masterpiece",
    "shareResults": "Share Virality Report"
  },
  "promptOutput": {
    "title": "Prompt Generation Complete!",
    "subtitle": "Use this detailed prompt with your favorite video generation tool.",
    "resetButton": "Create Another Prompt"
  },
  "uploadStep": {
    "title": "Smart Editor: Upload Your Footage",
    "instructions": {
      "title": "Instructions",
      "step1": "Copy the generated prompt for reference.",
      "step2": "Upload your raw video file (MP4/WebM).",
      "step3": "The AI will trim your video to the target duration of {duration}s.",
      "step4": "It will apply your editing instructions and strategy.",
      "step5": "Click 'Process Video' to begin."
    },
    "promptCard": {
      "title": "Generated AI Prompt / Instructions"
    },
    "uploadArea": {
      "backButton": "Back",
      "button": "Process Video",
      "processing": "Processing..."
    },
    "error": {
      "invalidFile": "Invalid file type. Please upload MP4 or WEBM.",
      "fileTooLarge": "File is too large. Maximum size is 100MB.",
      "noFile": "Please select a file to upload."
    },
    "warning": {
      "title": "Potential Compatibility Issue",
      "unseekable": "This video file may have an unusual encoding that could cause processing to fail or be very slow. This often happens with screen recordings or videos from specific conversion tools.<br/><br/>We recommend re-encoding the video to a standard MP4 (H.264) format for best results. Would you like to proceed anyway?",
      "cancel": "Cancel Upload",
      "proceed Anyway": "Proceed Anyway"
    }
  },
  "upload": {
    "title": "Smart Video Editor",
    "description": "Drag & drop a video file here to start editing with AI.",
    "button": "Select from computer",
    "fileTypes": "Supports MP4, WebM, MOV"
  },
  "trimming": {
    "preview": "Previewing Trim: {currentTime}s / {trimDuration}s"
  },
  "error": {
    "title": "An Error Occurred",
    "apiKeyMissing": "API Key is not configured.",
    "apiKeyInvalid": "The selected API key project may not have billing enabled or the Veo API is not active (Error: Requested entity was not found). Please select a project with an <b>active billing account</b>. Check the <a href='https://ai.google.dev/gemini-api/docs/billing' target='_blank' rel='noopener noreferrer' class='underline text-blue-300 hover:text-blue-200'>official documentation</a> for more details.",
    "geminiParse": "Failed to parse a valid response from the AI. It might be overloaded. Please try again.",
    "veoUriMissing": "Veo generation succeeded, but the video/thumbnail URL was not found in the response.",
    "veoFetchFailed": "Failed to fetch the generated video from the URI. Status: {status}",
    "veoVideoEmpty": "The AI-generated video file is empty. This might be a temporary service issue, please try again later.",
    "videoApiNotSupported": "Your browser does not support the advanced APIs required for the Smart Editor. Please try Chrome or Edge on a desktop.",
    "quotaExceeded": "You have exceeded your API request quota. Please wait a moment and try again, or check your billing and rate limit details. For more information, visit <a href='https://ai.google.dev/gemini-api/docs/rate-limits' target='_blank' rel='noopener noreferrer' class='underline text-blue-300 hover:text-blue-200'>Google's API documentation</a>.",
    "systemError": "A system error occurred. Our team has been notified. Please try again later."
  },
  "copy": {
    "copied": "Copied!",
    "resultsCopied": "Report Copied!"
  },
  "share": {
    "title": "🚀 My AI Video Virality Report 🚀",
    "score": "Virality Score: {score}/100 (Grade: {grade})",
    "playCount": "Plays (24h): {count}K",
    "ctr": "CTR: {ctr}%",
    "retention": "Retention: {retention}%",
    "footer": "Generated by AI Content Creation Platform"
  },
  "manual": {
    "title": "Platform Operational Protocol v3.1",
    "close": "Close Protocol",
    "content": `
    <div class="space-y-8">
        <!-- Core Capabilities -->
        <section>
            <div class="flex items-center gap-3 mb-4">
                <div class="w-1 h-6 bg-purple-500 rounded-full"></div>
                <h3 class="text-xl font-bold text-white tracking-wide">Mission Capabilities</h3>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="p-4 bg-white/5 border border-white/10 rounded-xl">
                    <div class="flex items-center gap-2 mb-2 text-purple-400 font-bold text-sm uppercase tracking-wider">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                        Creative Block Elimination
                    </div>
                    <p class="text-slate-400 text-sm">Stuck? Input a basic idea (e.g., "Coffee Ad") and the neural engine expands it into a cinematic script automatically.</p>
                </div>
                <div class="p-4 bg-white/5 border border-white/10 rounded-xl">
                    <div class="flex items-center gap-2 mb-2 text-blue-400 font-bold text-sm uppercase tracking-wider">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z"></path></svg>
                        Algorithmic Virality
                    </div>
                    <p class="text-slate-400 text-sm">We don't just make videos. We predict "Virality Scores" and provide release schedules, tags, and engagement hooks.</p>
                </div>
                <div class="p-4 bg-white/5 border border-white/10 rounded-xl">
                    <div class="flex items-center gap-2 mb-2 text-pink-400 font-bold text-sm uppercase tracking-wider">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                        Technical Automation
                    </div>
                    <p class="text-slate-400 text-sm">Bypass complex software (Pr/Ae). AI handles thumbnail design, audio mixing, and aspect ratio compliance instantly.</p>
                </div>
                 <div class="p-4 bg-white/5 border border-white/10 rounded-xl">
                    <div class="flex items-center gap-2 mb-2 text-green-400 font-bold text-sm uppercase tracking-wider">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        Rapid Deployment
                    </div>
                    <p class="text-slate-400 text-sm">From concept to downloadable asset in minutes, including ready-to-paste marketing copy.</p>
                </div>
            </div>
        </section>

        <!-- Steps -->
        <section>
            <div class="flex items-center gap-3 mb-4">
                 <div class="w-1 h-6 bg-blue-500 rounded-full"></div>
                <h3 class="text-xl font-bold text-white tracking-wide">Execution Protocol</h3>
            </div>
            
            <div class="relative border-l border-slate-700 ml-3 space-y-8 py-2">
                <div class="relative pl-8">
                    <div class="absolute -left-3 top-0 w-6 h-6 bg-slate-800 border-2 border-purple-500 rounded-full flex items-center justify-center text-xs font-bold text-purple-400">1</div>
                    <h4 class="font-bold text-slate-200 mb-1">Initialize Mode</h4>
                    <p class="text-slate-400 text-sm mb-2">Select your entry point:</p>
                    <ul class="list-disc list-inside text-xs text-slate-500 space-y-1 ml-2">
                        <li><strong class="text-slate-300">AI Generation:</strong> Zero-to-one creation using Generative AI.</li>
                        <li><strong class="text-slate-300">Smart Editor:</strong> Upload existing footage for AI enhancement/editing.</li>
                        <li><strong class="text-slate-300">Prompt Only:</strong> Generate pro-level prompts for external tools.</li>
                    </ul>
                </div>

                <div class="relative pl-8">
                    <div class="absolute -left-3 top-0 w-6 h-6 bg-slate-800 border-2 border-purple-500 rounded-full flex items-center justify-center text-xs font-bold text-purple-400">2</div>
                    <h4 class="font-bold text-slate-200 mb-1">Configure Strategy</h4>
                    <p class="text-slate-400 text-sm mb-2">Define the parameters of success:</p>
                    <ul class="list-disc list-inside text-xs text-slate-500 space-y-1 ml-2">
                        <li><strong class="text-slate-300">Concept:</strong> Be specific (Subject, Setting, Action, Mood).</li>
                        <li><strong class="text-slate-300">Hooks:</strong> Text displayed in the first 3s to grab attention.</li>
                        <li><strong class="text-slate-300">Style:</strong> Visual tone (e.g., VHS Retro, Cyberpunk).</li>
                        <li><strong class="text-slate-300">Specs:</strong> 9:16 for TikTok, 16:9 for YouTube.</li>
                    </ul>
                </div>

                <div class="relative pl-8">
                    <div class="absolute -left-3 top-0 w-6 h-6 bg-slate-800 border-2 border-purple-500 rounded-full flex items-center justify-center text-xs font-bold text-purple-400">3</div>
                    <h4 class="font-bold text-slate-200 mb-1">Processing</h4>
                    <p class="text-slate-400 text-sm">Upon submission, the system executes parallel tasks:</p>
                    <div class="flex gap-2 mt-2">
                        <span class="px-2 py-1 bg-slate-800 rounded text-xs border border-slate-700 text-slate-400">Scripting</span>
                        <span class="px-2 py-1 bg-slate-800 rounded text-xs border border-slate-700 text-slate-400">Video Gen (Veo)</span>
                        <span class="px-2 py-1 bg-slate-800 rounded text-xs border border-slate-700 text-slate-400">Thumbnail Design</span>
                        <span class="px-2 py-1 bg-slate-800 rounded text-xs border border-slate-700 text-slate-400">Analysis</span>
                    </div>
                </div>

                <div class="relative pl-8">
                     <div class="absolute -left-3 top-0 w-6 h-6 bg-slate-800 border-2 border-green-500 rounded-full flex items-center justify-center text-xs font-bold text-green-400">4</div>
                    <h4 class="font-bold text-slate-200 mb-1">Mission Report</h4>
                    <p class="text-slate-400 text-sm">Receive your strategic assets:</p>
                    <ul class="list-disc list-inside text-xs text-slate-500 space-y-1 ml-2 mt-2">
                        <li>Download 1080P Video.</li>
                        <li>High-CTR Thumbnail.</li>
                        <li>Viral Titles & Descriptions.</li>
                        <li>Performance Prediction Score.</li>
                    </ul>
                </div>
            </div>
        </section>
    </div>
    `
  },
  "editor": {
    "modal": {
      "title": "Describe Your Video",
      "description": "To generate an accurate transcript, please briefly describe the video content.",
      "placeholder": "Example: 'A person explaining a new software feature in a screen recording.'",
      "button": "Generate Transcript"
    },
    "transcribing": "AI is transcribing your video...",
    "transcript": {
      "title": "Transcript",
      "addSpeaker": "Add speaker",
      "placeholder": "Generating transcript..."
    },
    "canvas": {
      "write": "Write",
      "layout": "Layout",
      "background": "Background"
    },
    "rightPanel": {
      "underlord": "Underlord AI",
      "planTitle": "AI Editing Plan",
      "applyButton": "Apply Edits",
      "processing": "Thinking...",
      "initialPlan": "I'm ready to help you edit this video. Tell me what you'd like to do. For example:\n* 'Make this a 15 second viral clip for TikTok.'\n* 'Add subtitles and a title.'\n* 'Cut out the part where I cough.'",
      "askPlaceholder": "Ask AI to edit...",
      "disclaimer": "AI may produce inaccurate information.",
      "project": "Project",
      "aiTools": "AI Tools",
      "properties": "Properties",
      "elements": "Elements",
      "captions": "Captions",
      "media": "Media"
    },
    "timeline": {
      "split": "Split"
    }
  },
  "gemini": {
    "systemInstruction": {
      "main": "You are an AI assistant for a video content creation platform. Your task is to expand a user's simple prompt and strategic choices into a detailed, executable plan for an AI video generator and a comprehensive virality analysis. You MUST strictly adhere to the provided JSON schema.",
      "editorAnalysis": "You are an AI assistant for a video content creation platform. Your task is to analyze user's editing instructions and provide a comprehensive virality analysis and marketing copy. You MUST strictly adhere to the provided JSON schema which does NOT include a creative prompt.",
      "createPlan": "You are an AI video editing assistant. Your task is to interpret a user's natural language editing instructions and extract key technical specifications. You MUST return a JSON object strictly conforming to the provided schema. The instructions might be vague, so you use your best judgment to determine a specific duration and aspect ratio.",
      "createThumbnailPrompt": "You are an expert YouTube strategist specializing in creating high-CTR thumbnails. Based on the video's content description, you must generate a detailed image prompt for an AI image generator. This prompt should aim to produce a thumbnail that is intriguing, visually striking, and algorithmically favored. It should describe a single, powerful visual moment, focusing on emotion, curiosity, and clarity. You MUST strictly adhere to the provided JSON schema.",
      "createTranscript": "You are an AI video analysis assistant. Your task is to generate a plausible spoken-word transcript for a video based ONLY on its filename and duration. You must create a series of timed text segments that logically fit the filename's topic and fill the entire duration. The timestamps must be accurate and sequential. Adhere strictly to the JSON schema.",
      "createStepByStepPlan": "You are an AI video editor. You will be given a video transcript and a user's request. Create a step-by-step editing plan in human-readable markdown and a machine-readable array of actions. The plan should be clear and actionable. Adhere strictly to the JSON schema, which requires both a 'displayPlan' (string) and 'actions' (array of action objects)."
    },
    "prompt": {
      "main": "User input is provided as a JSON object. Generate a response based on this input, following the schema. User Input: {formData}",
      "editorAnalysis": "User input is provided as a JSON object containing their video editing instructions. Generate a response based on this input, following the schema. User Input: {formData}",
      "createPlan": "Parse the following user instructions and extract the technical details. Instructions: '{instructions}'",
      "createThumbnailPrompt": "The video is about: '{description}'. Generate a detailed image prompt for a viral thumbnail based on this.",
      "createTranscript": "Generate a plausible transcript for a video named '{filename}' with a duration of {duration} seconds.",
      "createStepByStepPlan": "User Request: '{userPrompt}'. Video Transcript: {transcript}"
    },
    "error": {
      "transcriptGeneration": "Failed to generate transcript.",
      "planGeneration": "Failed to generate editing plan."
    }
  },
  "constants": {
    "visualStyle": {
      "cctv": "CCTV",
      "nightVision": "Night Vision",
      "daylight": "Daylight",
      "vhsRetro": "VHS Retro",
      "documentaryNature": "Documentary Nature",
      "sciFiHologram": "Sci-Fi Hologram"
    },
    "aspectRatio": {
      "vertical": "9:16 Vertical",
      "horizontal": "16:9 Horizontal",
      "square": "1:1 Square"
    },
    "hookType": {
      "timeBased": "Time-based",
      "visualCue": "Visual Cue",
      "timeBasedDescription": "Hook is based on a specific time.",
      "visualCueDescription": "Hook is based on a visual event."
    },
    "generationMode": {
      "aiGeneration": "AI Generation",
      "aiGenerationDescription": "Generate video using AI based on a prompt.",
      "smartEditor": "Smart Editor",
      "smartEditorDescription": "Upload your own footage for AI-powered editing.",
      "promptOnly": "Prompt Only",
      "promptOnlyDescription": "Generate a detailed prompt for external use."
    },
    "engine": {
      "veo": "Veo",
      "gmicloud": "GMICLOUD",
      "geminigen": "GeminiGen",
      "googlevids": "Google Vids"
    }
  }
}