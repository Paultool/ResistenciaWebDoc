import re

filepath = r'c:\Users\pault\Desktop\LA RESISTENCIA RESERVORIO\Resistencia Spartane 2\agent_workspace\resistencia-app 101025\resistencia-app\public\subtitles\retorno-a-casa.srt'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the specific malformed timestamps like 00:02:055,800
# Pattern: HH:MM:SSS,mmm where SSS is 3 digits instead of 2
# Should become: HH:MM:SS,mmm
content = re.sub(r'(\d{2}):(\d{2}):(\d)(\d{2}),(\d)00', r'\1:\2:0\3,\4\500', content)

# Another pattern: 00:02:310,800 --> 00:02:31,080
content = re.sub(r'(\d{2}):(\d{2}):(\d{2})(\d),(\d)00', r'\1:\2:\3,\400', content)

# Save
with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print('✓ Final timestamp corrections applied!')
