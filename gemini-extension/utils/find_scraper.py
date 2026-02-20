
import re

file_path = r"H:\ai-内容创作智能化平台\gemini-extension\youtube-analytics.js"

try:
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    print(f"File read successfully. Total lines: {len(lines)}")
    
    for i, line in enumerate(lines):
        if "scrapeAnalyticsData" in line:
            print(f"Line {i+1}: {line.strip()}")
            
except Exception as e:
    print(f"Error: {e}")
