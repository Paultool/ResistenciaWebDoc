import json

# Load KML names
with open('kml_names.json', 'r', encoding='utf-8') as f:
    kml_names = json.load(f)

# Load existing JSON
try:
    with open('colonias_data.json', 'r', encoding='utf-8') as f:
        existing_data = json.load(f)
except FileNotFoundError:
    existing_data = {}

existing_keys = set(existing_data.keys())
kml_set = set(kml_names)

missing_colonies = sorted(list(kml_set - existing_keys))
extra_colonies = sorted(list(existing_keys - kml_set))

print(f"Total existing colonies: {len(existing_keys)}")
print(f"Total KML colonies: {len(kml_set)}")
print(f"Missing count: {len(missing_colonies)}")

print("\n--- MISSING COLONIES (Need Data) ---")
with open('missing_colonies_list.txt', 'w', encoding='utf-8') as f:
    for name in missing_colonies:
        print(name)
        f.write(name + "\n")

print(f"Saved list to missing_colonies_list.txt")
