

import json


# Vosges:  curl "https://overpass-api.de/api/interpreter?data=%5Bout%3Ajson%5D%3Bnode%5B%22natural%22%3D%22peak%22%5D(47.6%2C6.3.0%2C48.8%2C7.5)%3Bout%3B" > /tmp/vosges.json

def main():
    with open("data.json") as d:
        alps = json.load(d)
    with open("vosges.json") as v:
        vosges = json.load(v)

    #print (vosges)

    for v in vosges['elements']:
        print (v)
    
    v2 = [
        {
            "type": "Feature",
            "properties": {
                "name": v['tags']['name'],
                "ele": v['tags']['ele'],
                "natural": "peak"
            },
            "geometry": {
                "coordinates": [
                    v['lon'],
                    v['lat']
                ]
            }
        }
        for v in vosges['elements'] if 'name' in v['tags'] and 'ele' in v['tags']]
    a_names = [ v['properties']['name'] for v in v2]

    print ("before: "+str(len(alps['features'])))
    
    for v in v2:
        found = False
        for a in alps['features']:
            if 'name' in a['properties'] and v['properties']['name'] == a['properties']['name']:
                found = True
                break
        if not found:
            alps['features'].append(v)
        else:
            print (".", end="")

    print ("After: "+str(len(alps['features'])))
            #print (json.dumps(v2, indent=4))

    with open("data2.json", "w") as dd:
        dd.write(json.dumps(alps))
    return


if __name__ == "__main__":
    main()
