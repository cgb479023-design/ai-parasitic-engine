
import os

file_path = r"H:\ai-内容创作智能化平台\src\components\YouTubeAnalytics.tsx"
search_text = "handleCollectAnalytics"

try:
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    print(f"Checking {file_path} for definition of '{search_text}'...")
    for i, line in enumerate(lines):
        if search_text in line and ("const" in line or "function" in line or "=" in line):
            print(f"Found at line {i+1}: {line.strip()}")
            
except Exception as e:
    print(f"Error: {e}")
