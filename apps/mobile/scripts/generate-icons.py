#!/usr/bin/env python3
"""
Generate every Android launcher-icon asset for the app.

Source of truth: LOGO.png at the REPOSITORY ROOT. If it exists it's used;
drop your real logo there and re-run:
    python3 apps/mobile/scripts/generate-icons.py
If LOGO.png is absent, a brand placeholder is drawn (gold roof/A mark on
deep navy) so the project always builds with a proper rounded icon.

Outputs (rounded everywhere):
  - Legacy mipmaps ic_launcher.png / ic_launcher_round.png in all densities
    with rounded corners baked in (radius 22% like modern launchers)
  - Adaptive icons (Android 8+): logo foreground inside the safe zone on a
    brand-navy background; the launcher mask rounds it automatically
  - iOS AppIcon 1024 (square, no alpha — iOS rounds it itself)

Requires: pillow  (pip install pillow)
"""
import os
import sys

try:
    from PIL import Image, ImageDraw
except ImportError:
    sys.exit("pillow is required: pip install pillow")

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
MOBILE = os.path.join(ROOT, "apps", "mobile")
LOGO = os.path.join(ROOT, "LOGO.png")
RES = os.path.join(MOBILE, "android", "app", "src", "main", "res")

NAVY = (11, 18, 32, 255)
GOLD = (232, 163, 61, 255)
WHITE = (255, 255, 255, 255)

DENSITIES = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
ADAPTIVE = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}


def rounded_mask(size, radius_ratio=0.22):
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * radius_ratio), fill=255)
    return mask


def circle_mask(size):
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.ellipse([0, 0, size - 1, size - 1], fill=255)
    return mask


def brand_placeholder(size):
    """Gold roof + A-frame mark on navy, drawn at 1024 then downscaled."""
    S = 1024
    img = Image.new("RGBA", (S, S), NAVY)
    d = ImageDraw.Draw(img)
    d.polygon([(212, 420), (512, 190), (812, 420), (742, 420), (512, 268), (282, 420)], fill=GOLD)
    d.polygon([(300, 812), (452, 360), (540, 360), (392, 812)], fill=WHITE)
    d.polygon([(724, 812), (632, 812), (484, 360), (572, 360)], fill=WHITE)
    d.rectangle([352, 618, 672, 668], fill=GOLD)
    d.rounded_rectangle([262, 812, 762, 848], radius=18, fill=GOLD)
    if size != S:
        img = img.resize((size, size), Image.LANCZOS)
    return img


def load_source(size):
    if os.path.exists(LOGO):
        src = Image.open(LOGO).convert("RGBA")
        tile = Image.new("RGBA", (size, size), NAVY)
        src.thumbnail((int(size * 0.82), int(size * 0.82)), Image.LANCZOS)
        tile.alpha_composite(src, ((size - src.width) // 2, (size - src.height) // 2))
        return tile
    return brand_placeholder(size)


def main():
    master = load_source(1024)
    source_note = LOGO if os.path.exists(LOGO) else "brand placeholder (LOGO.png not found at repo root)"
    for name, size in DENSITIES.items():
        out_dir = os.path.join(RES, f"mipmap-{name}")
        os.makedirs(out_dir, exist_ok=True)
        icon = master.resize((size, size), Image.LANCZOS)
        rounded = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        rounded.paste(icon, (0, 0), rounded_mask(size))
        rounded.save(os.path.join(out_dir, "ic_launcher.png"))
        round_icon = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        round_icon.paste(icon, (0, 0), circle_mask(size))
        round_icon.save(os.path.join(out_dir, "ic_launcher_round.png"))
        asize = ADAPTIVE[name]
        fg = Image.new("RGBA", (asize, asize), (0, 0, 0, 0))
        inner = master.resize((int(asize * 0.62), int(asize * 0.62)), Image.LANCZOS)
        fg.alpha_composite(inner, ((asize - inner.width) // 2, (asize - inner.height) // 2))
        fg.save(os.path.join(out_dir, "ic_launcher_foreground.png"))

    anydpi = os.path.join(RES, "mipmap-anydpi-v26")
    os.makedirs(anydpi, exist_ok=True)
    adaptive_xml = """<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
"""
    open(os.path.join(anydpi, "ic_launcher.xml"), "w").write(adaptive_xml)
    open(os.path.join(anydpi, "ic_launcher_round.xml"), "w").write(adaptive_xml)
    values = os.path.join(RES, "values")
    os.makedirs(values, exist_ok=True)
    colors_path = os.path.join(values, "ic_launcher_background.xml")
    if not os.path.exists(colors_path):
        open(colors_path, "w").write(
            '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#0B1220</color>\n</resources>\n'
        )

    ios_dir = os.path.join(MOBILE, "ios", "AnantaInfratech", "Images.xcassets", "AppIcon.appiconset")
    if os.path.isdir(ios_dir):
        flat = Image.new("RGBA", (1024, 1024), NAVY)
        flat.alpha_composite(master, (0, 0))
        flat.convert("RGB").save(os.path.join(ios_dir, "AppIcon-1024.png"))
    print(f"Icons generated from: {source_note}")


if __name__ == "__main__":
    main()
