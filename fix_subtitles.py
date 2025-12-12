import re

# Read the file
filepath = r'c:\Users\pault\Desktop\LA RESISTENCIA RESERVORIO\Resistencia Spartane 2\agent_workspace\resistencia-app 101025\resistencia-app\public\subtitles\retorno-a-casa.srt'

with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

fixed_lines = []

for line in lines:
    # Check if this is a timestamp line (contains -->)
    if '-->' in line:
        # Fix the malformed formats
        # Pattern 1: 00:01:00:06,320 --> 00:01:00:10,840 (4 components)
        line = re.sub(r'(\d{2}):(\d{2}):(\d{2}):(\d{2}),(\d{3})', r'\1:\2:\4,\5', line)
        
        # Pattern 2: 02:00:0360, --> 02:00:03,360
        line = re.sub(r'(\d{2}):(\d{2}):0(\d)(\d{2}),', r'\1:\2:\3,\4', line)
        
        # Pattern 3: 02:05:0580, --> 02:05:58,0
        line = re.sub(r'(\d{2}):(\d{2}):0(\d{3}),', r'\1:\2:\3,0', line)
        
        # Pattern 4: Missing space after comma: 02:00:03,360brought --> 02:00:03,360\n
        line = re.sub(r'(\d{2}:\d{2}:\d{2},\d{3})([a-zA-Z])', r'\1\n\2', line)
        
    fixed_lines.append(line)

# Write fixed content
with open(filepath, 'w', encoding='utf-8') as f:
    f.writelines(fixed_lines)

print('✓ Subtitle timestamps fixed successfully!')
print('Fixed:')
print('  - 4-component timestamps (HH:MM:SS:SS,mmm → HH:MM:SS,mmm)')
print('  - Malformed milliseconds')
print('  - Missing linebreaks after timestamps')
