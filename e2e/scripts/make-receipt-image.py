"""Renders a plain Walmart-style receipt as a photo for the scan E2E flow (Choose photo).

Usage: python3 e2e/scripts/make-receipt-image.py e2e/assets/walmart-receipt.png
"""
import sys

from PIL import Image, ImageDraw, ImageFont

LINES = [
    ("Walmart", 64, "center"),
    ("Save money. Live better.", 34, "center"),
    ("ST# 01043 OP# 00009 TE# 09 TR# 07211", 30, "center"),
    ("", 30, "left"),
    ("AIR FRYER 5.8QT              89.00 N", 34, "left"),
    ("SUBTOTAL                     89.00", 34, "left"),
    ("TAX 1  7.250 %                0.00", 34, "left"),
    ("TOTAL                        89.00", 40, "left"),
    ("VISA TEND                    89.00", 34, "left"),
    ("", 30, "left"),
    ("11/12/26 14:14:07", 34, "center"),
    ("RETURN WITHIN 90 DAYS WITH RECEIPT", 28, "center"),
]

W, H = 1000, 1400
img = Image.new("RGB", (W, H), "white")
draw = ImageDraw.Draw(img)
y = 80
for text, size, align in LINES:
    font = ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", size)
    width = draw.textlength(text, font=font)
    x = (W - width) / 2 if align == "center" else 80
    draw.text((x, y), text, fill="black", font=font)
    y += int(size * 1.9)
img.save(sys.argv[1])
