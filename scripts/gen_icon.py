"""
Steward App Icon Generator — v2
Royal Burgundy design: deep burgundy bg + glow, concentric gold rings, serif 'S' lettermark.
"""

import math, os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

SIZE    = 1024
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'images')

BG_DARK   = (26,   5,   5)
BG_MID    = (46,  20,  19)
BURG      = (78,  11,  11)
GOLD      = (212, 175,  55)
GOLD_DIM  = (150, 120,  35)
GOLD_LITE = (240, 208,  96)
WHITE     = (255, 255, 255)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(len(a)))


def rounded_rect_mask(size, radius):
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return mask


def make_bg(size):
    """Deep burgundy radial gradient background."""
    img  = Image.new('RGBA', (size, size), BG_DARK + (255,))
    draw = ImageDraw.Draw(img)
    cx = cy = size // 2
    steps = 80
    for i in range(steps, 0, -1):
        t = i / steps
        r = int(size * 0.58 * t)
        c = lerp(BURG, BG_DARK, t ** 0.7)
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=c + (255,))
    return img, draw, cx, cy


def draw_rings(img, cx, cy, size):
    """3 concentric gold rings with soft glow."""
    rings = [
        (0.415, 0.020, 210),
        (0.305, 0.025, 170),
        (0.195, 0.030, 130),
    ]
    for rfrac, wfrac, alpha in rings:
        r = int(size * rfrac)
        w = max(int(size * wfrac), 7)

        # Soft glow layer
        glow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        gd   = ImageDraw.Draw(glow)
        for off in range(int(w * 2.2), 0, -1):
            a_val = int(alpha * 0.35 * ((off / (w * 2.2)) ** 1.8))
            gd.ellipse(
                [cx - r - off, cy - r - off, cx + r + off, cy + r + off],
                outline=GOLD_LITE + (a_val,), width=1,
            )
        img = Image.alpha_composite(img, glow)

        # Main ring
        draw = ImageDraw.Draw(img)
        draw.ellipse(
            [cx - r - w // 2, cy - r - w // 2, cx + r + w // 2, cy + r + w // 2],
            outline=GOLD + (alpha,), width=w,
        )

        # Highlight arc (top-right quadrant, lighter)
        draw.arc(
            [cx - r - w // 2, cy - r - w // 2, cx + r + w // 2, cy + r + w // 2],
            start=300, end=60,
            fill=GOLD_LITE + (min(alpha + 40, 255),), width=max(w // 2, 3),
        )
    return img


def draw_S_lettermark(img, cx, cy, size):
    """Render a bold gold 'S' using a system serif font, with glow underneath."""
    font_path = 'C:/Windows/Fonts/georgiab.ttf'
    font_size = int(size * 0.42)

    try:
        font = ImageFont.truetype(font_path, font_size)
    except Exception:
        font = ImageFont.load_default()

    # Measure the S glyph
    tmp_draw = ImageDraw.Draw(img)
    bbox     = tmp_draw.textbbox((0, 0), 'S', font=font)
    tw       = bbox[2] - bbox[0]
    th       = bbox[3] - bbox[1]
    tx       = cx - tw // 2 - bbox[0]
    ty       = cy - th // 2 - bbox[1] - int(size * 0.01)  # slight upward nudge

    # ── Glow pass (blurred gold layer behind the S) ──────────────────────────
    glow_layer = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    gd         = ImageDraw.Draw(glow_layer)
    gd.text((tx, ty), 'S', font=font, fill=GOLD_DIM + (180,))
    glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(radius=int(size * 0.018)))
    img = Image.alpha_composite(img, glow_layer)

    # ── Shadow outline (dark, offset slightly) ──────────────────────────────
    shadow_layer = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    sd           = ImageDraw.Draw(shadow_layer)
    for off in [(3, 4), (-2, 3), (4, 2)]:
        sd.text((tx + off[0], ty + off[1]), 'S', font=font, fill=BG_DARK + (120,))
    img = Image.alpha_composite(img, shadow_layer)

    # ── Main gold S ─────────────────────────────────────────────────────────
    s_layer = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    sd2     = ImageDraw.Draw(s_layer)
    sd2.text((tx, ty), 'S', font=font, fill=GOLD + (255,))
    img = Image.alpha_composite(img, s_layer)

    # ── Lighter highlight pass (slightly smaller, offset up-left) ────────────
    hl_layer = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    hd       = ImageDraw.Draw(hl_layer)
    hd.text((tx - 2, ty - 3), 'S', font=font, fill=GOLD_LITE + (90,))
    img = Image.alpha_composite(img, hl_layer)

    return img


def make_icon(size=1024, rounded=True):
    img, draw, cx, cy = make_bg(size)
    img = draw_rings(img, cx, cy, size)
    img = draw_S_lettermark(img, cx, cy, size)

    # Subtle vignette
    vig = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    vd  = ImageDraw.Draw(vig)
    for i in range(40):
        t = i / 40
        r = int(size * 0.50 * (1 - t * 0.25))
        vd.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(0, 0, 0, int(50 * t)), width=2)
    img = Image.alpha_composite(img, vig)

    if rounded:
        radius = int(size * 0.22)
        mask   = rounded_rect_mask(size, radius)
        result = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        result.paste(img, mask=mask)
        return result
    return img


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    print('Generating icon.png …')
    icon      = make_icon(1024, rounded=True)
    icon_rgb  = Image.new('RGB', (1024, 1024), BG_DARK)
    icon_rgb.paste(icon, mask=icon.split()[3])
    icon_rgb.save(os.path.join(OUT_DIR, 'icon.png'), 'PNG', optimize=True)

    print('Generating adaptive-icon.png …')
    adp = make_icon(1024, rounded=False)
    adp.save(os.path.join(OUT_DIR, 'adaptive-icon.png'), 'PNG', optimize=True)

    print('Generating favicon.png …')
    icon_rgb.resize((48, 48), Image.LANCZOS).save(os.path.join(OUT_DIR, 'favicon.png'), 'PNG')

    print('Done:', os.path.abspath(OUT_DIR))


if __name__ == '__main__':
    main()
