import xml.etree.ElementTree as ET
import json
import os

try:
    ns = {'kml': 'http://www.opengis.net/kml/2.2'}
    tree = ET.parse('bj.kml')
    root = tree.getroot()

    names = []
    # Find all Placemarks and their names
    for placemark in root.findall('.//kml:Placemark', ns):
        name_tag = placemark.find('kml:name', ns)
        if name_tag is not None:
            names.append(name_tag.text.strip())
            
    # Filter out empty names or the main document name if captured inappropriately
    # The Document name comes from Document/name, but we are looking at Placemarks. 
    # Usually strictly Placemarks are what we want.
    
    # Write to file
    with open('kml_names.json', 'w', encoding='utf-8') as f:
        json.dump(names, f, indent=2, ensure_ascii=False)
    
    print(f"Extracted {len(names)} names to kml_names.json")

except Exception as e:
    print(f"Error: {e}")
