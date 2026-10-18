# -*- coding: utf-8 -*-
"""Post-process renders: white compositing, labelled model sheet, GIF."""

import os
import glob
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
R = os.path.join(ROOT, "renders")

BG = (255, 255, 255)
INK = (52, 44, 36)
MUTED = (140, 128, 112)


def font(size, cn=False):
    candidates = (
        [r"C:\Windows\Fonts\msyhbd.ttc", r"C:\Windows\Fonts\msyh.ttc"]
        if cn else [r"C:\Windows\Fonts\arialbd.ttf", r"C:\Windows\Fonts\arial.ttf"]
    )
    for c in candidates:
        if os.path.exists(c):
            return ImageFont.truetype(c, size)
    return ImageFont.load_default()


def flatten(path):
    im = Image.open(path).convert("RGBA")
    bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
    bg.alpha_composite(im)
    out = bg.convert("RGB")
    out.save(path)
    return out


def model_sheet():
    views = [("front.png", "FRONT", "正视图"),
             ("side.png", "SIDE", "侧视图"),
             ("back.png", "BACK", "背视图")]
    imgs = []
    for fn, en, cn in views:
        p = os.path.join(R, fn)
        if not os.path.exists(p):
            return
        imgs.append((flatten(p), en, cn))

    cell_w, cell_h = 940, 1316
    canvas = Image.new("RGB", (3200, 1720), BG)
    d = ImageDraw.Draw(canvas)
    d.text((110, 76), "奶蛙  NAIWA", font=font(92, True), fill=INK)
    d.text((114, 190), "3D CHARACTER  ·  FRONT / SIDE / BACK",
           font=font(30), fill=MUTED)
    d.rectangle((110, 240, 3090, 245), fill=(232, 226, 216))

    x0 = 110
    gap = 150
    for i, (im, en, cn) in enumerate(imgs):
        im = im.resize((cell_w, cell_h), Image.LANCZOS)
        x = x0 + i * (cell_w + gap)
        canvas.paste(im, (x, 300))
        d.text((x, 1648), en, font=font(26), fill=MUTED)
        d.text((x + 120, 1642), "·  " + cn, font=font(28, True), fill=INK)

    canvas.save(os.path.join(R, "model_sheet.png"))
    print("saved model_sheet.png", canvas.size)


def gif():
    frames = sorted(glob.glob(os.path.join(R, "turntable", "*.png")))
    if len(frames) < 8:
        print("turntable not finished:", len(frames))
        return
    out = []
    for f in frames:
        im = Image.open(f).convert("RGBA")
        bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
        bg.alpha_composite(im)
        out.append(bg.convert("RGB").resize((480, 615), Image.LANCZOS))
    out[0].save(os.path.join(R, "turntable.gif"), save_all=True,
                append_images=out[1:], duration=70, loop=0, optimize=True)
    print("saved turntable.gif", len(out), "frames")


if __name__ == "__main__":
    model_sheet()
    gif()
