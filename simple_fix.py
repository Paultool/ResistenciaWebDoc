import re

filepath = r'c:\Users\pault\Desktop\LA RESISTENCIA RESERVORIO\Resistencia Spartane 2\agent_workspace\resistencia-app 101025\resistencia-app\public\subtitles\retorno-a-casa.srt'

# Read all lines
with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Fix each line that contains a timestamp
fixed_lines = []
for line in lines:
    if '-->' in line:
        # Fix malformed seconds like 00:02:055,800 --> 00:02:05,580
        line = re.sub(r'(\d{2}:\d{2}:)0(\d{2}),(\d)00', r'\g<1>\2,\g<3>80', line)
        # Fix 00:02:310,800 --> 00:02:31,080
        line = re.sub(r'(\d{2}:\d{2}:)(\d{2})(\d),(\d)00', r'\g<1>\2,\g<4>\g<3>0', line)
    fixed_lines.append(line)

# Save 
with open(filepath, 'w', encoding='utf-8') as f:
    f.writelines(fixed_lines)

print('Timestamps fixed!')
