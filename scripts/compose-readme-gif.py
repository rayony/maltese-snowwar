#!/usr/bin/env python3
"""Crop canvas frames to 480x270, optional finger overlay, write gif via ffmpeg."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

from PIL import Image

OUT_W, OUT_H = 480, 270
WORLD_W, WORLD_H = 960, 540
FINGER = Path("/workspace/scripts/readme-finger.png")


def crop_world(im: Image.Image, wx: float, wy: float, zoom: float) -> Image.Image:
    iw, ih = im.size
    vw = WORLD_W / zoom
    vh = WORLD_H / zoom * (OUT_H / OUT_W * WORLD_W / WORLD_H)
    # 16:9 crop in world units
    vw = WORLD_W / zoom
    vh = vw * OUT_H / OUT_W
    x0 = wx - vw / 2
    y0 = wy - vh / 2
    x0 = max(0, min(x0, WORLD_W - vw))
    y0 = max(0, min(y0, WORLD_H - vh))
    sx0 = int(x0 / WORLD_W * iw)
    sy0 = int(y0 / WORLD_H * ih)
    sx1 = int((x0 + vw) / WORLD_W * iw)
    sy1 = int((y0 + vh) / WORLD_H * ih)
    return im.crop((sx0, sy0, max(sx0 + 8, sx1), max(sy0 + 8, sy1))).resize((OUT_W, OUT_H), Image.Resampling.LANCZOS)


def world_to_crop(wx: float, wy: float, cx: float, cy: float, zoom: float) -> tuple[int, int]:
    vw = WORLD_W / zoom
    vh = vw * OUT_H / OUT_W
    x0 = cx - vw / 2
    y0 = cy - vh / 2
    x0 = max(0, min(x0, WORLD_W - vw))
    y0 = max(0, min(y0, WORLD_H - vh))
    px = int((wx - x0) / vw * OUT_W)
    py = int((wy - y0) / vh * OUT_H)
    return px, py


def stamp_finger(im: Image.Image, px: int, py: int) -> None:
    if not FINGER.exists():
        return
    hand = Image.open(FINGER).convert("RGBA")
    hand = hand.resize((44, 44), Image.Resampling.LANCZOS)
    # hang the hand below the contact point so the dog stays visible
    im.alpha_composite(hand, (px - 14, py + 6))


def contain_on_canvas(src: Image.Image) -> Image.Image:
    src = src.convert("RGBA")
    canvas = Image.new("RGBA", (OUT_W, OUT_H), (21, 32, 43, 255))
    scale = min((OUT_W - 24) / src.width, (OUT_H - 24) / src.height)
    nw = max(1, int(src.width * scale))
    nh = max(1, int(src.height * scale))
    put = src.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas.alpha_composite(put, ((OUT_W - nw) // 2, (OUT_H - nh) // 2))
    return canvas


def write_gif(frames_dir: Path, dest: Path, fps: int) -> None:
    r = subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-framerate",
            str(fps),
            "-i",
            str(frames_dir / "%03d.png"),
            "-vf",
            "scale=480:270:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=full[p];[s1][p]paletteuse=dither=bayer",
            "-loop",
            "0",
            str(dest),
        ],
        capture_output=True,
        text=True,
    )
    if r.returncode != 0:
        raise SystemExit(r.stderr)


def main() -> None:
    meta_path = Path(sys.argv[1])
    dest = Path(sys.argv[2])
    fps = int(sys.argv[3]) if len(sys.argv) > 3 else 12
    meta = json.loads(meta_path.read_text())
    src_dir = Path(meta["dir"])
    out_dir = src_dir / "out"
    out_dir.mkdir(exist_ok=True)
    mode = meta.get("mode", "world")
    for i, fr in enumerate(meta["frames"], start=1):
        src = Image.open(src_dir / f"{i:03d}.png").convert("RGBA")
        if mode == "contain":
            framed = contain_on_canvas(src)
        else:
            framed = crop_world(src, fr["x"], fr["y"], fr.get("zoom", 1.3)).convert("RGBA")
            if fr.get("finger"):
                fx, fy = world_to_crop(fr.get("fx", fr["x"]), fr.get("fy", fr["y"]), fr["x"], fr["y"], fr.get("zoom", 1.3))
                stamp_finger(framed, fx, fy)
        framed.convert("RGB").save(out_dir / f"{i:03d}.png")
    write_gif(out_dir, dest, fps)
    print("wrote", dest, "frames", len(meta["frames"]))


if __name__ == "__main__":
    main()
