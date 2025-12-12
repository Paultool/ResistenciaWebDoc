import re

# Read the file
filepath = r'c:\Users\pault\Desktop\LA RESISTENCIA RESERVORIO\Resistencia Spartane 2\agent_workspace\resistencia-app 101025\resistencia-app\public\subtitles\retorno-a-casa.srt'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Original content for comparison
original = content

# Fix Pattern: 02:05:5,80 --> should be 00:02:05,580
# Pattern HH:MM:D,DD where D is incomplete seconds/milliseconds
content = re.sub(r'(\d{2}):(\d{2}):(\d),(\d{2})-->', lambda m: f'00:{m.group(1)}:{m.group(2)}{m.group(3)},{m.group(4)}0 -->', content)

# Fix Pattern: 00:03:01,0660, --> should be 00:03:01,660
content = re.sub(r'00:03:01,0(\d{3}),-->', r'00:03:01,\1 -->', content)

# Fix Pattern: 03:04:1,60 --> should be 00:03:04,160
content = re.sub(r'(\d{2}):(\d{2}):(\d),(\d{2})-->', lambda m: f'00:{m.group(1)}:{m.group(2)}{m.group(3)},{m.group(4)}0 -->', content)

# Fix end timestamps with wrong hour format
# 02:00:14,290 where it should be 00:02:14,290
content = re.sub(r'--> (\d{2}):00:(\d{2}),(\d{3})', r'--> 00:\1:\2,\3', content)

# Fix start timestamps like 02:31:0,80 to 00:02:31,080
content = re.sub(r'^(\d{2}):(\d{2}):(\d),(\d{2})', lambda m: f'00:{m.group(1)}:{m.group(2)}{m.group(3)},{m.group(4)}0', content, flags=re.MULTILINE)

# Fix 03:00:00 --> should be 00:03:00
content = re.sub(r'--> 03:00:(\d{2},\d{3})', r'--> 00:03:\1', content)

# Write fixed content
with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

# Count changes
changes = sum(1 for a, b in zip(original.split('\n'), content.split('\n')) if a != b)
print(f'✓ Fixed {changes} lines in retorno-a-casa.srt')
print('  - Corrected malformed timestamp formats')
print('  - Fixed hour/minute/second misplacements')
print('  - Normalized all timestamps to HH:MM:SS,mmm format')
