import re
import sys

def clean_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.readlines()

        cleaned_content = []
        for line in content:
            # Remove patterns like "   1→", "  10→", and also "     1→     1→"
            # This regex targets any leading whitespace, followed by numbers, an arrow,
            # and potentially another set of numbers and an arrow, until the actual code starts.
            cleaned_line = re.sub(r'^[ \t]*(\d+→)*[ \t]*', '', line)
            cleaned_content.append(cleaned_line)

        with open(filepath, 'w', encoding='utf-8') as f:
            f.writelines(cleaned_content)
        print(f"Successfully cleaned: {filepath}")
    except Exception as e:
        print(f"Error cleaning {filepath}: {e}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        filepath_to_clean = sys.argv[1]
        clean_file(filepath_to_clean)
    else:
        print("Usage: python clean_file.py <filepath>")