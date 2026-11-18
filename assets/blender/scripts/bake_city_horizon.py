"""Bake the city horizon from Blender's shipped v1 GLB. Python 3, no dependencies."""
import json
import math
import random
import struct
from functools import cache
from pathlib import Path

MAPS = Path(__file__).resolve().parents[3] / "public/assets/maps"
FORMATS = {5121: "B", 5123: "H", 5125: "I", 5126: "f"}
SIZES = {"SCALAR": 1, "VEC3": 3, "VEC4": 4}


def chunks(path):
    data = path.read_bytes()
    magic, version, length, size, kind = struct.unpack_from("<4sIII4s", data)
    assert (magic, version, length, kind) == (b"glTF", 2, len(data), b"JSON")
    doc = json.loads(data[20:20 + size])
    length, kind = struct.unpack_from("<I4s", data, 20 + size)
    blob = data[28 + size:]
    assert kind == b"BIN\0" and len(blob) == length
    return doc, blob


def write_chunks(path, doc, blob):
    doc["buffers"] = [dict(byteLength=len(blob))]
    blob.extend(bytes(-len(blob) % 4))
    doc["asset"]["generator"] = "Swarm Front / bake_city_horizon.py"
    header = json.dumps(doc, separators=(",", ":")).encode()
    header += b" " * (-len(header) % 4)
    path.write_bytes(struct.pack("<4sIII4s", b"glTF", 2, 28+len(header)+len(blob), len(header), b"JSON")
                     + header + struct.pack("<I4s", len(blob), b"BIN\0") + blob)


def load_glb(path):
    doc, blob = chunks(path)

    def read(i):
        a = doc["accessors"][i]
        v = doc["bufferViews"][a["bufferView"]]
        fmt = struct.Struct("<" + FORMATS[a["componentType"]] * SIZES[a["type"]])
        assert not a.get("byteOffset") and not v.get("byteStride")
        offset = v.get("byteOffset", 0)
        rows = list(fmt.iter_unpack(blob[offset:offset + v["byteLength"]]))
        assert len(rows) == a["count"]
        return rows

    meshes = {}
    for mesh in doc["meshes"]:
        p, = mesh["primitives"]
        attrs = {name: read(i) for name, i in p["attributes"].items()}
        meshes[mesh["name"]] = dict(attrs, indices=[v for v, in read(p["indices"])])
    return doc, meshes


def save_glb(path, doc, meshes):
    doc["accessors"], doc["bufferViews"] = [], []
    blob = bytearray()

    def accessor(rows, kind, component, target, position=False):
        blob.extend(bytes(-len(blob) % 4))
        offset = len(blob)
        fmt = struct.Struct("<" + FORMATS[component] * SIZES[kind])
        for row in rows:
            blob.extend(fmt.pack(*row))
        i = len(doc["bufferViews"])
        doc["bufferViews"].append(dict(buffer=0, byteOffset=offset, byteLength=len(blob)-offset, target=target))
        a = dict(bufferView=i, componentType=component, type=kind, count=len(rows))
        if position:
            a.update(min=list(map(min, zip(*rows))), max=list(map(max, zip(*rows))))
        if component == 5121:
            a["normalized"] = True
        doc["accessors"].append(a)
        return i

    for mesh in doc["meshes"]:
        m = meshes[mesh["name"]]
        p, = mesh["primitives"]
        p["attributes"] = {name: accessor(m[name], "VEC3", 5126, 34962, name == "POSITION")
                           for name in ("POSITION", "NORMAL") if name in m}
        if "COLOR_0" in m:
            p["attributes"]["COLOR_0"] = accessor(m["COLOR_0"], "VEC4", 5121, 34962)
            material = doc["materials"][p["material"]]["pbrMetallicRoughness"]
            material["baseColorFactor"] = [1, 1, 1, 1]
        assert max(m["indices"]) < len(m["POSITION"]) <= 65535
        p["indices"] = accessor([(i,) for i in m["indices"]], "SCALAR", 5123, 34963)
    write_chunks(path, doc, blob)


def bounds(vertices):
    return tuple((min(axis), max(axis)) for axis in zip(*vertices))


def rgba(rgb, light=1):
    return tuple(round(max(0, min(1, c * light)) * 255) for c in rgb) + (255,)


def add_quad(mesh, points, normal, colors):
    first = len(mesh["POSITION"])
    mesh["POSITION"].extend(points)
    mesh["NORMAL"].extend([normal] * 4)
    mesh["COLOR_0"].extend(colors)
    mesh["indices"].extend(first + i for i in (0, 1, 2, 0, 2, 3))


def rooftop_box(mesh, x, z, bottom, height, width, depth, rgb):
    # Corner order gives exterior front faces. Omit the underside resting on a roof.
    corners = [(x+a*width/2, bottom+b*height, z+c*depth/2)
               for b in (0, 1) for a, c in ((-1,-1), (1,-1), (1,1), (-1,1))]
    faces = [((1,0,4,5), (0,0,-1)), ((2,1,5,6), (1,0,0)), ((3,2,6,7), (0,0,1)),
             ((0,3,7,4), (-1,0,0)), ((7,6,5,4), (0,1,0))]
    for ids, normal in faces:
        add_quad(mesh, [corners[i] for i in ids], normal,
                 [rgba(rgb, .78 if i < 4 else 1) for i in ids])


def service_towers(meshes, buildings):
    # Tall infrastructure in three widely spaced districts, with lower shoulders nearby.
    for i, top in ((57,76), (58,105), (87,103), (88,83), (102,76), (103,96)):
        (left,right), (_,h), (back,front) = buildings[i]
        x, z = (left+right)/2, (back+front)/2
        w, d = right-left, front-back
        wall, roof, steel = (meshes[name] for name in ("wall", "roof", "steel"))
        bottom = h+1
        core = (.25,.31,.35)
        cap = (.115,.18,.215)
        rooftop_box(wall, x, z, bottom, top-bottom, w*.70, d*.75, core)
        for y in range(math.ceil(bottom)+5, top-3, 8):
            rooftop_box(roof, x, z, y, 1.5, w*.74, d*.79, cap)
        step = x-w*.10
        rooftop_box(roof, step, z, top, 6, w*.44, d*.49, cap)
        if i in (58, 87, 103):
            rooftop_box(steel, step, z, top+6, 5, w*.24, d*.26, (.21,.28,.32))
            for offset, length in ((-1.0,13), (1.0,8)):
                rooftop_box(steel, step+offset, z, top+11, length, .65, .65, (.17,.23,.27))


def overcast(mesh):
    # One closed horizon in the far ridge draw, behind both ridgelines. A constant
    # lighting normal lets the painted sky stay continuous under the game's sun.
    columns = 112
    start = len(mesh["POSITION"])
    levels = (-5, 0, 5, 9, 12, 15, 17, 19, 22, 25, 29, 32, 36, 41, 48, 56, 65)
    for row, level in enumerate(levels):
        for col in range(columns):
            a = math.tau*col/columns
            wave = math.sin(a*2+.4) + .55*math.sin(a*5-1) + .30*math.cos(a*11+.2)
            ragged = .55*math.sin(a*13+level*.055) + .24*math.sin(a*23-level*.07)
            e = level + min(1, max(0,(level-2)/7), max(0,(50-level)/10)) * (2*wave+ragged)
            phi = math.atan(math.tan(math.radians(e))*715/490)
            radius, height = 715*math.cos(phi), 490*math.sin(phi)
            mesh["POSITION"].append((radius*math.sin(a),height,radius*math.cos(a)))
            mesh["NORMAL"].append((0,1,0))
            dawn = (.5+.5*math.cos(a-3.96))**2
            fade = math.exp(-max(e,0)/22)
            clear = (.12 + fade*(.56+.25*dawn), .26 + fade*(.40+.05*dawn), .40 + fade*.17)
            # Two broken banks of stratus. Their lower grey bellies catch a narrow
            # rim of pale daylight; each bank dies out in different azimuths.
            low = .50+.26*math.sin(a*3+.6)+.15*math.cos(a*7-.8)+.08*math.sin(a*17)
            high = .46+.27*math.sin(a*2-1.3)+.17*math.sin(a*9)+.09*math.cos(a*19)
            density = low*math.exp(-((level-18)/2.5)**2) + high*math.exp(-((level-34)/4.3)**2)
            rim = low*math.exp(-((level-15)/1.5)**2) + high*math.exp(-((level-29)/2.4)**2)
            color = [v*(1-density*.73) + rim*k for v,k in zip(clear,(.35+.19*dawn,.32,.24))]
            mesh["COLOR_0"].append(rgba(color))
            if row:
                i = start+(row-1)*columns+col
                j = start+(row-1)*columns+(col+1)%columns
                mesh["indices"].extend((i,i+columns,j, j,i+columns,j+columns))
    # Cap above the play area. All perimeter vertices stay outside the city's
    # existing 180 m clearance, including those of this flat zenith.
    ring = start + (len(levels)-1)*columns
    for k in range(1,columns-1):
        mesh["indices"].extend((ring,ring+k+1,ring+k))


def bake_daylight(doc, mesh, ridge_count):
    # The distant ridge and sky never cast shadows. Match the game's fixed outdoor
    # hemisphere and key light once; the runtime still applies the same depth fog.
    def linear(channels):
        return [((c/255 + .055)/1.055)**2.4 for c in channels]

    sky, ground, sun = (linear(rgb) for rgb in ((216,244,250), (38,55,60), (255,237,219)))
    direction = [v/math.hypot(-65,110,-50) for v in (-65,110,-50)]
    for i, (n, pos) in enumerate(zip(mesh.pop("NORMAL"), mesh["POSITION"])):
        if i < ridge_count and sum(a*b for a,b in zip(n,pos)) > 0:
            n = tuple(-v for v in n)  # Double-sided ridge observed from the arena.
        hemi = .5+.5*n[1]
        direct = max(0,sum(a*b for a,b in zip(n,direction)))
        color = mesh["COLOR_0"][i]
        mesh["COLOR_0"][i] = rgba([
            (color[k]/255 * (1.8*(ground[k]*(1-hemi)+sky[k]*hemi) + 3*sun[k]*direct)
             + .04*sun[k]*direct) / math.pi for k in range(3)])
    doc.setdefault("extensionsUsed", []).append("KHR_materials_unlit")
    material, = (m for m in doc["materials"] if m["name"] == "far")
    material["extensions"] = {"KHR_materials_unlit": {}}


def bake(doc, meshes):
    wall = meshes["wall"]["POSITION"]
    buildings = [bounds(wall[j:j+24]) for j in range(0, len(wall), 24)]
    assert len(buildings) == 112
    districts = [(.36,.40,.40), (.27,.35,.40), (.34,.35,.32), (.24,.30,.34)]
    rng = random.Random(9810)
    tint = []
    for (x,_), _, (z,_) in buildings:
        sector = int((math.atan2(x,z) % math.tau) / math.tau * 8)
        tint.append((districts[sector % 4], rng.uniform(.79, 1.15)))

    for name in ("wall", "roof", "steel"):
        m = meshes[name]
        colors = []
        for j, (x,y,z) in enumerate(m["POSITION"]):
            i = j//24
            base, variation = tint[i]
            if name == "wall":
                # Long top-to-bottom interpolation keeps the street level in shadow.
                light = .45 + .65 * y/buildings[i][1][1]
            else:
                light = .53 if name == "roof" else .68
            colors.append(rgba(base, variation * light))
        m["COLOR_0"] = colors

    for name, base in (("near", (.145,.22,.265)), ("far", (.35,.44,.52))):
        m = meshes[name]
        m["COLOR_0"] = [rgba(base, .8 + min(max(y,0)/130,1)*.27 +
                             .06*math.sin(math.atan2(x,z)*4))
                        for x,y,z in m["POSITION"]]
    far = meshes["far"]
    ridge_count = len(far["POSITION"])
    far_mesh, = (m for m in doc["meshes"] if m["name"] == "far")
    far_mesh.setdefault("extras", {})["ridgeIndexCount"] = len(far["indices"])
    overcast(far)
    bake_daylight(doc, far, ridge_count)

    old = meshes["window"]["POSITION"]
    windows = {k: [] for k in ("POSITION", "NORMAL", "COLOR_0", "indices")}
    meshes["window"] = windows
    coverage = set()
    for start in range(0, len(old), 24):
        box = bounds(old[start:start+24])
        center = [(lo+hi)/2 for lo,hi in box]
        axis = min((0,2), key=lambda a: box[a][1]-box[a][0])
        along = 2-axis
        # The ribbon is centered along its own wall. Matching that center and the
        # measured outer offset also rejects adjacent buildings with overlapping heights.
        matches = [(i, sign) for i, b in enumerate(buildings) for sign in (-1,1)
                   if abs(sum(b[along])/2-center[along]) < .001
                   and abs(box[axis][sign > 0] - b[axis][sign > 0] - sign*.07) < .001]
        (i,sign), = matches
        plane = box[axis][sign > 0]
        lo, hi = box[along]
        y0, y1 = box[1]
        floor = round(center[1]/5)
        coverage.add((i, floor, axis, sign))
        n = [0,0,0]
        n[axis] = sign
        dark = (.075,.125,.16)
        sky = (.185,.305,.37)
        variation = tint[i][1] * (.72 + .038*floor)
        # Break a few ribbons into occupied rooms. Most floors reflect a single
        # subdued patch of sky, with brighter glass on the upper levels.
        lit = rng.random() < .048
        if lit:
            a = rng.uniform(.12,.67)
            parts = [(0,a,dark), (a,a+.14,(.96,.50,.17)), (a+.14,1,dark)]
        elif i % 3 == 1:
            parts = [(0,.44,sky), (.44,.61,dark), (.61,1,sky)]
        else:
            parts = [(0,1,sky if (floor+i)%4 in (0,1) else dark)]
        for a,b,rgb in parts:
            points = []
            for t,y in ((a,y0),(b,y0),(b,y1),(a,y1)):
                p = [0,y,0]
                p[axis], p[along] = plane, lo + t*(hi-lo)
                points.append(tuple(p))
            scale = [variation*k for k in (.75,.86,1.05,.94)]
            if (axis == 0 and sign > 0) or (axis == 2 and sign < 0):
                points.reverse()
                scale.reverse()
            add_quad(windows, points, tuple(n), [rgba(rgb,k) for k in scale])
    expected = {(i,y//5,a,s) for i,b in enumerate(buildings) for y in range(5,int(b[1][1])-1,5)
                for a in (0,2) for s in (-1,1)}
    assert coverage == expected and len(coverage) * 24 == len(old)
    service_towers(meshes, buildings)


def replace_defense_horizon(defense, horizon, output):
    # Copy referenced buffer views verbatim, including texture files, and preserve
    # attribute/index sharing. Unreferenced v2 horizon data never enters the new BIN.
    sources = [chunks(defense), chunks(horizon)]
    scene, city = (s[0] for s in sources)
    scene["extensionsUsed"] = list(dict.fromkeys(scene["extensionsUsed"] + city["extensionsUsed"]))
    city_meshes = {n["name"]: city["meshes"][n["mesh"]] for n in city["nodes"]}
    assert {n["name"] for n in scene["nodes"] if n["name"].startswith("DISTANT_")} == city_meshes.keys()
    views, accessors, blob = [], [], bytearray()

    @cache
    def view(source, i):
        doc, data = sources[source]
        old = doc["bufferViews"][i]
        offset = old.get("byteOffset", 0)
        blob.extend(bytes(-len(blob) % 4))
        views.append(dict(old, byteOffset=len(blob)))
        blob.extend(data[offset:offset + old["byteLength"]])
        return len(views)-1

    @cache
    def accessor(source, i):
        old = sources[source][0]["accessors"][i]
        accessors.append(dict(old, bufferView=view(source, old["bufferView"])))
        return len(accessors)-1

    for image in scene["images"]:
        image["bufferView"] = view(0, image["bufferView"])
    near_materials = {p["material"] for n in scene["nodes"] if n["name"] not in city_meshes
                      for p in scene["meshes"][n["mesh"]]["primitives"]}
    assert len({n["mesh"] for n in scene["nodes"]}) == len(scene["nodes"]) == len(scene["meshes"])
    for node in scene["nodes"]:
        mesh = scene["meshes"][node["mesh"]]
        p, = mesh["primitives"]
        source, geometry = 0, p
        if node["name"] in city_meshes:
            assert all(abs(s-.6) < 1e-6 for s in node["scale"])
            assert p["material"] not in near_materials
            replacement = city_meshes[node["name"]]
            geometry, = replacement["primitives"]
            if "extras" in replacement:
                mesh.setdefault("extras", {}).update(replacement["extras"])
            material = city["materials"][geometry["material"]]
            assert scene["materials"][p["material"]]["name"] == material["name"]
            scene["materials"][p["material"]] = material
            source = 1
        p["attributes"] = {k: accessor(source,i) for k,i in geometry["attributes"].items()}
        p["indices"] = accessor(source, geometry["indices"])

    scene.update(accessors=accessors, bufferViews=views)
    write_chunks(output, scene, blob)


if __name__ == "__main__":
    document, source = load_glb(MAPS / "distant_0_v1.glb")
    bake(document, source)
    save_glb(MAPS / "distant_0_v2.glb", document, source)
    replace_defense_horizon(MAPS / "defense_0_v2.glb", MAPS / "distant_0_v2.glb", MAPS / "defense_0_v3.glb")
