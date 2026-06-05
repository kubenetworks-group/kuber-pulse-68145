#!/usr/bin/env python3
"""Generates public/og-image.png with the official Kodo logo."""

from PIL import Image, ImageDraw, ImageFilter
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGO_PATH = os.path.join(BASE_DIR, "src/assets/kodo-logo.png")
OUTPUT_PATH = os.path.join(BASE_DIR, "public/og-image.png")
FONT_DIR = os.path.join(BASE_DIR, "public/fonts")

W, H = 1200, 630

# ── Background gradient (dark navy → slightly lighter) ──────────────────────
bg = Image.new("RGB", (W, H))
draw = ImageDraw.Draw(bg)

top_color    = (6, 12, 30)    # #060C1E
bottom_color = (12, 24, 54)   # #0C1836

for y in range(H):
    t = y / H
    r = int(top_color[0] + (bottom_color[0] - top_color[0]) * t)
    g = int(top_color[1] + (bottom_color[1] - top_color[1]) * t)
    b = int(top_color[2] + (bottom_color[2] - top_color[2]) * t)
    draw.line([(0, y), (W, y)], fill=(r, g, b))

# Subtle radial glow in the center
glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
glow_draw = ImageDraw.Draw(glow)
cx, cy = W // 2, H // 2
for radius in range(350, 0, -1):
    alpha = int(30 * (1 - radius / 350))
    glow_draw.ellipse(
        [cx - radius, cy - radius, cx + radius, cy + radius],
        fill=(15, 60, 165, alpha),
    )
glow_blurred = glow.filter(ImageFilter.GaussianBlur(radius=60))
bg = bg.convert("RGBA")
bg = Image.alpha_composite(bg, glow_blurred)
bg = bg.convert("RGB")

# ── Logo ────────────────────────────────────────────────────────────────────
logo = Image.open(LOGO_PATH).convert("RGBA")
logo_size = 180
logo = logo.resize((logo_size, logo_size), Image.LANCZOS)

# Position: center horizontally together with the text block
# Layout: [logo] [Kodo\ntagline] — group width estimated below
# We'll render text with PIL default font first, then adjust
# Total group: logo(180) + gap(32) + text_block
# Center of canvas: 600

try:
    from PIL import ImageFont
    font_bold   = ImageFont.truetype(os.path.join(FONT_DIR, "Aileron-Bold.otf"), 110)
    font_tagline = ImageFont.truetype(os.path.join(FONT_DIR, "Aileron-Light.otf"), 36)
except Exception:
    font_bold   = ImageFont.load_default()
    font_tagline = ImageFont.load_default()

# Measure text
draw_tmp = ImageDraw.Draw(Image.new("RGB", (1, 1)))
bbox_kodo = draw_tmp.textbbox((0, 0), "Kodo", font=font_bold)
text_w = bbox_kodo[2] - bbox_kodo[0]
text_h = bbox_kodo[3] - bbox_kodo[1]

gap = 36
group_w = logo_size + gap + text_w
group_x = (W - group_w) // 2  # left edge of the group

logo_y = (H - logo_size) // 2 - 18
text_x = group_x + logo_size + gap
text_y = (H - text_h) // 2 - 20

# Paste logo
bg.paste(logo, (group_x, logo_y), logo)

# Draw "Kodo" wordmark
draw = ImageDraw.Draw(bg)
draw.text((text_x, text_y), "Kodo", font=font_bold, fill=(255, 255, 255))

# Tagline — centered under the group
tagline = "Gestão Kubernetes com IA"
bbox_tag = draw_tmp.textbbox((0, 0), tagline, font=font_tagline)
tag_w = bbox_tag[2] - bbox_tag[0]
tag_x = (W - tag_w) // 2
tag_y = text_y + text_h + 28
draw.text((tag_x, tag_y), tagline, font=font_tagline, fill=(160, 185, 220))

bg.save(OUTPUT_PATH, "PNG", optimize=True)
print(f"Saved → {OUTPUT_PATH}")
