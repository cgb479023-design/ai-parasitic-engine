
import os

file_path = r'e:\ai-内容创作智能化平台\gemini-extension\content.js'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Lines are 0-indexed in python list
# We want to remove lines 453 to 507 (1-based)
# So indices 452 to 507 (exclusive of end index in slice? No, 453 is index 452)
# Range is 453..507.
# Index 452 is line 453.
# Index 506 is line 507.
# We want to keep line 452 (index 451) and line 508 (index 507).

# Let's verify the content of the lines we are about to remove to be safe
start_index = 452
end_index = 507 # This will be the index of the first line to KEEP after deletion if we slice

# Check if lines are indeed empty or whitespace
for i in range(start_index, end_index):
    if lines[i].strip() != '':
        print(f"Warning: Line {i+1} is not empty: {lines[i]}")
        # exit(1) # Optional: abort if not empty

# Create new list of lines
new_lines = lines[:start_index] + lines[end_index:]

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Successfully removed lines.")
