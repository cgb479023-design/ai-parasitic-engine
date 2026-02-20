
import os

files_to_check = [
    r"H:\ai-内容创作智能化平台\src\components\YouTubeAnalytics.tsx",
    r"H:\ai-内容创作智能化平台\gemini-extension\youtube-analytics.js"
]

for file_path in files_to_check:
    print(f"Checking {file_path}...")
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        for i, line in enumerate(lines):
            line_content = line.strip()
            if "YouTubeAnalytics.tsx" in file_path:
                if "YOUTUBE_ANALYTICS_DIRECT_RESULT" in line_content:
                    print(f"Match in {os.path.basename(file_path)}:{i+1}: {line_content}")
            if "youtube-analytics.js" in file_path:
                if i > 6250 and i < 6500 and "views" in line_content:
                     print(f"Match in {os.path.basename(file_path)}:{i+1}: {line_content}")
                    
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
