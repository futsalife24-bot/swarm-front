"""Read received producer files; never rebuild, rewrite, or upload their images.

Optional expected-hashes JSON: {"standard/adv-sortie.apng": "sha256", ...}.
It must cover all 28 image files to mark source-hash comparison as verified.
"""
import argparse
import hashlib
import json
import struct
import zlib
from fractions import Fraction
from pathlib import Path

from PIL import Image

TIMES = {
    "adv-sortie": 1980,
    "adv-extract": 2460,
    "adv-failed": 2860,
    "adv-complete": 3040,
    "srv-sortie": 2120,
    "srv-extract": 2520,
    "srv-ended": 2640,
}


def chunks(data):
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("not a PNG/APNG")
    offset = 8
    result = []
    while offset < len(data):
        if offset + 12 > len(data):
            raise ValueError("truncated chunk")
        length = struct.unpack_from(">I", data, offset)[0]
        end = offset + 12 + length
        if end > len(data):
            raise ValueError("truncated chunk data")
        name = data[offset + 4:offset + 8]
        payload = data[offset + 8:offset + 8 + length]
        crc = struct.unpack_from(">I", data, offset + 8 + length)[0]
        if zlib.crc32(name + payload) & 0xffffffff != crc:
            raise ValueError(f"CRC mismatch: {name!r}")
        result.append((name, payload))
        offset = end
        if name == b"IEND":
            if offset != len(data):
                raise ValueError("unexpected trailing data")
            return result
    raise ValueError("IEND missing")


def inspect_image(path, variant, animated, expected_ms):
    data = path.read_bytes()
    parsed = chunks(data)
    width, height, bits, color, compression, filter_method, interlace = struct.unpack(
        ">IIBBBBB", parsed[0][1]
    )
    wanted = (960, 336) if variant == "standard" else (640, 224)
    if parsed[0][0] != b"IHDR" or (width, height) != wanted:
        raise ValueError(f"dimensions differ: {(width, height)} != {wanted}")
    if (bits, color, compression, filter_method, interlace) != (8, 6, 0, 0, 0):
        raise ValueError("expected 8-bit non-interlaced RGBA PNG")
    acts = [payload for name, payload in parsed if name == b"acTL"]
    controls = [payload for name, payload in parsed if name == b"fcTL"]
    result = {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(),
              "width": width, "height": height, "rgba": True}
    with Image.open(path) as image:
        if animated:
            if len(acts) != 1:
                raise ValueError("APNG must contain one acTL")
            frames, loops = struct.unpack(">II", acts[0])
            if frames != len(controls) or frames < 2 or loops != 1:
                raise ValueError("APNG frame count or play-once contract differs")
            duration = Fraction(0)
            for control in controls:
                if len(control) != 26:
                    raise ValueError("invalid fcTL")
                num, den = struct.unpack_from(">HH", control, 20)
                duration += Fraction(num * 1000, den or 100)
            if abs(float(duration) - expected_ms) > 2:
                raise ValueError(f"APNG duration differs: {float(duration)}ms != {expected_ms}ms")
            image.seek(image.n_frames - 1)
            if image.convert("RGBA").getchannel("A").getbbox() is not None:
                raise ValueError("final frame is not fully transparent")
            image.seek(0)
            with Image.open(path.with_suffix(".png")) as still:
                if image.convert("RGBA").tobytes() != still.convert("RGBA").tobytes():
                    raise ValueError("APNG default image differs from original static PNG")
            result.update({"encodedFrames": frames, "loops": loops,
                           "durationMs": float(duration), "finalTransparent": True,
                           "defaultMatchesPng": True,
                           "estimatedRgbaFrameBytes": width * height * 4 * frames})
        elif acts or controls or getattr(image, "is_animated", False):
            raise ValueError("static PNG contains animation")
        else:
            image.load()
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path,
                        default=Path("public/assets/event-banners"))
    parser.add_argument("--out", type=Path,
                        default=Path("dist-validation/event-banners-received.json"))
    parser.add_argument("--expected-hashes", type=Path)
    args = parser.parse_args()
    expected = json.loads(args.expected_hashes.read_text(encoding="utf-8")) if args.expected_hashes else None
    report = {"root": str(args.root.resolve()), "images": {}, "documents": {},
              "sourceHashComparison": "pending", "browserMemoryMeasured": False,
              "errors": []}
    paths = {f"{variant}/{event}.{ext}"
             for variant in ("standard", "mobile") for event in TIMES
             for ext in ("apng", "png")}
    if expected is not None and set(expected) != paths:
        report["errors"].append("Expected source hashes must cover exactly all 28 image paths")
    for relative in sorted(paths):
        variant, filename = relative.split("/")
        event, ext = filename.rsplit(".", 1)
        try:
            details = inspect_image(args.root / relative, variant, ext == "apng", TIMES[event])
            report["images"][relative] = details
            if expected is not None and details["sha256"] != expected.get(relative):
                report["errors"].append(f"{relative}: source SHA256 mismatch")
        except Exception as error:
            report["errors"].append(f"{relative}: {error}")
    for name in ("README.md", "consumer-manifest.json", "validation.json"):
        try:
            data = (args.root / name).read_bytes()
            if name.endswith(".json"):
                json.loads(data.decode("utf-8"))
            else:
                data.decode("utf-8")
            report["documents"][name] = {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
        except Exception as error:
            report["errors"].append(f"{name}: {error}")
    if expected is not None and not report["errors"]:
        report["sourceHashComparison"] = "verified"
    report["structurePassed"] = not report["errors"]
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"structurePassed": report["structurePassed"],
                      "imageCount": len(report["images"]),
                      "sourceHashComparison": report["sourceHashComparison"],
                      "errors": len(report["errors"]), "out": str(args.out)}, ensure_ascii=False))
    return 0 if report["structurePassed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
