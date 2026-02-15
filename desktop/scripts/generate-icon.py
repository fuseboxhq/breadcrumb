#!/usr/bin/env python3
"""Generate a 1024x1024 placeholder app icon for Breadcrumb Desktop IDE."""

from PIL import Image, ImageDraw, ImageFont
import os

SIZE = 1024
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'icon.png')

img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# Background: rounded rectangle with dark gradient feel
# Using a rich dark blue-purple (#1a1a2e) as base
bg_color = (22, 22, 42, 255)
accent = (99, 102, 241, 255)      # Indigo-500
accent_light = (165, 180, 252, 255)  # Indigo-300

# Draw rounded rectangle background
radius = 200
draw.rounded_rectangle(
    [(40, 40), (SIZE - 40, SIZE - 40)],
    radius=radius,
    fill=bg_color,
)

# Subtle inner border
draw.rounded_rectangle(
    [(44, 44), (SIZE - 44, SIZE - 44)],
    radius=radius - 4,
    outline=(255, 255, 255, 20),
    width=2,
)

# Draw three "breadcrumb" dots in a trail — the brand motif
# Arranged diagonally from bottom-left to top-right
dots = [
    (300, 680, 70),   # x, y, radius — largest (current)
    (512, 512, 55),   # medium
    (700, 360, 40),   # smallest (past)
]

for x, y, r in dots:
    # Glow
    for glow_r in range(r + 30, r, -3):
        alpha = int(40 * (1 - (glow_r - r) / 30))
        draw.ellipse(
            [(x - glow_r, y - glow_r), (x + glow_r, y + glow_r)],
            fill=(99, 102, 241, alpha),
        )
    # Solid dot
    draw.ellipse(
        [(x - r, y - r), (x + r, y + r)],
        fill=accent,
    )
    # Inner highlight
    highlight_r = int(r * 0.5)
    draw.ellipse(
        [(x - highlight_r, y - highlight_r - int(r * 0.15)),
         (x + highlight_r, y + highlight_r - int(r * 0.15))],
        fill=accent_light,
    )

# Connecting lines between dots (trail effect)
line_color = (99, 102, 241, 100)
draw.line([(300, 680), (512, 512)], fill=line_color, width=8)
draw.line([(512, 512), (700, 360)], fill=line_color, width=6)

# Small chevrons after the last dot (indicating continuation)
chevron_color = (99, 102, 241, 60)
for offset in [0, 35]:
    cx = 770 + offset
    cy = 305 - offset // 2
    draw.line([(cx, cy - 15), (cx + 15, cy), (cx, cy + 15)], fill=chevron_color, width=4)

# "B" letter overlay — subtle, large
try:
    font = ImageFont.truetype("/System/Library/Fonts/SFCompact.ttf", 220)
except (OSError, IOError):
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 220)
    except (OSError, IOError):
        font = ImageFont.load_default()

# Position the B in the lower-right area
b_color = (255, 255, 255, 35)
bbox = draw.textbbox((0, 0), "B", font=font)
bw, bh = bbox[2] - bbox[0], bbox[3] - bbox[1]
draw.text(
    (SIZE - bw - 160, SIZE - bh - 140),
    "B",
    fill=b_color,
    font=font,
)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
img.save(OUT, 'PNG')
print(f"Icon saved to {OUT} ({SIZE}x{SIZE})")
