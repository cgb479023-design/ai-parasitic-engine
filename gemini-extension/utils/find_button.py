
import os

file_path = r"H:\ai-内容创作智能化平台\src\components\YouTubeAnalytics.tsx"
search_text = "Collect Full Analytics Report (Ask AI)"

try:
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    print(f"Checking {file_path} for '{search_text}'...")
    found = False
    for i, line in enumerate(lines):
        if search_text in line:
            print(f"Found at line {i+1}: {line.strip()}")
            found = True
            
    if not found:
        print("Text not found.")
        
except Exception as e:
    print(f"Error: {e}")
