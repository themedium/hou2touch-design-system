#!/usr/bin/env python3
"""
photo_field.py — the PHOTOGRAPHIC path of the Hou2Touch 1-bit field, outside the browser.

Proof that a real photograph can be turned into a compliant 1-bit ordered-dither
field with integer nearest-neighbour upscale and no resampling of the field.

Source photograph: hou2touch_redesign/img/hero_school.webp  (the same file the
site's hero shader samples: HERO_TEX = IMG("hero_school")).

Pipeline
--------
 1. load the photo, convert to RGB
 2. centre-crop to 16:9  (no stretching)
 3. resample the CROP to CELL resolution (960 x 540 cells)   <- the only resample,
    and it happens on the photograph, upstream of the field
 4. luminance per cell:  L = 0.299R + 0.587G + 0.114B   (0..1)
 5. tile tone: mean L over every 8x8 block of the cell grid  (see NOTES)
 6. ordered 8x8 Bayer threshold at cell resolution:
        B8 built recursively:  M' = 4M + [[0,2],[3,1]] tiled 2x2  (3 iterations)
        th(y,x) = (B8[y&7][x&7] + 0.5) / 64
        a cell is INK when its tone falls below th  ->  ink = the cells whose
        Bayer value exceeds the tile's cut, i.e. the HIGH-threshold positions
        are the ones that carry ink (classic ordered dithering of a greyscale)
 7. two tones only: paper #e9e7e0, ink #0b0b0c.  No accent: a photograph enters
    the system dithered and desaturated, and it is the subject of the frame.
 8. upscale x2 with nearest neighbour only (np.repeat) -> 1920 x 1080
"""

import json
import os

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
SRC = os.path.join(ROOT, "img", "hero_school.webp")

PAPER = (233, 231, 224)   # #e9e7e0
INK = (11, 11, 12)        # #0b0b0c

CELL_W, CELL_H = 960, 540
UPSCALE = 2
ASPECT = 16.0 / 9.0


def bayer8():
    """Canonical recursion: M' = 4M + [[0,2],[3,1]] tiled 2x2, three iterations."""
    m = np.array([[0]], dtype=np.int32)
    while m.shape[0] < 8:
        m = np.block([[4 * m, 4 * m + 2], [4 * m + 3, 4 * m + 1]])
    return m


def main():
    im = Image.open(SRC)
    im.load()
    native = im.size
    im = im.convert("RGB")

    # --- 2. centre-crop to 16:9, no stretching -------------------------
    w, h = im.size
    if w / h > ASPECT:                     # too wide -> crop width
        cw = int(round(h * ASPECT))
        ch = h
    else:                                 # too tall -> crop height
        cw = w
        ch = int(round(w / ASPECT))
    x0 = (w - cw) // 2
    y0 = (h - ch) // 2
    box = (x0, y0, x0 + cw, y0 + ch)
    cropped = im.crop(box)

    # --- 3. resample the crop down to CELL resolution ------------------
    cell = cropped.resize((CELL_W, CELL_H), Image.LANCZOS)
    arr = np.asarray(cell).astype(np.float64) / 255.0

    # --- 4. luminance --------------------------------------------------
    lum = 0.299 * arr[:, :, 0] + 0.587 * arr[:, :, 1] + 0.114 * arr[:, :, 2]

    # --- 5. tile tone: mean luminance over each 8x8 block of cells -----
    # The cell grid is 960x540; the last tile row is a partial tile (4 rows
    # high). A partial tile is still dithered with its own 8x8 Bayer matrix,
    # so its ink set stays a suffix of the Bayer ordering.
    tb = 8
    th_, tw_ = int(np.ceil(CELL_H / tb)), int(np.ceil(CELL_W / tb))
    padded = np.full((th_ * tb, tw_ * tb), np.nan)
    padded[:CELL_H, :CELL_W] = lum
    with np.errstate(invalid="ignore"):
        tone = np.nanmean(padded.reshape(th_, tb, tw_, tb), axis=(1, 3))

    # --- 6. ordered 8x8 Bayer threshold at cell resolution ------------
    B8 = bayer8()
    rows = (np.arange(CELL_H) & 7)
    cols = (np.arange(CELL_W) & 7)
    th = (B8[rows][:, cols].astype(np.float64) + 0.5) / 64.0

    tile_tone = tone[np.arange(CELL_H) // tb][:, np.arange(CELL_W) // tb]
    ink = tile_tone < th                  # INK where tone falls below threshold

    # --- 7. two tones --------------------------------------------------
    rgb = np.empty((CELL_H, CELL_W, 3), dtype=np.uint8)
    rgb[...] = PAPER
    rgb[ink] = INK

    # --- 8. nearest-neighbour x2 --------------------------------------
    up = np.repeat(np.repeat(rgb, UPSCALE, axis=0), UPSCALE, axis=1)
    out_path = os.path.join(HERE, "photo_field_16x9.png")
    Image.fromarray(up, "RGB").save(out_path, format="PNG", optimize=True)

    ink_frac = float(ink.mean())

    manifest = {
        "artifact": "photo_field_16x9.png",
        "generator": "photo_field.py",
        "source_photo": os.path.relpath(SRC, HERE),
        "source_native_size": [native[0], native[1]],
        "crop_box_xyxy": list(box),
        "crop_size": [cw, ch],
        "crop_centre": True,
        "aspect": "16:9",
        "cell_width": CELL_W,
        "cell_height": CELL_H,
        "upscale": UPSCALE,
        "output_width": CELL_W * UPSCALE,
        "output_height": CELL_H * UPSCALE,
        "png_format": "8-bit truecolour RGB (colour type 2), non-interlaced",
        "colours": {
            "paper": "#e9e7e0",
            "ink": "#0b0b0c",
        },
        "unique_colours": 2,
        "accents": 0,
        "accent_colour": None,
        "dither": {
            "type": "ordered 8x8 Bayer",
            "matrix_build": "M' = 4M + [[0,2],[3,1]] tiled 2x2, 3 iterations",
            "threshold": "(B8[y&7][x&7] + 0.5) / 64",
            "row_index": "cell_row & 7 (top-down)",
            "col_index": "cell_col & 7",
            "ink_rule": "cell is INK when its tone < threshold",
            "tone": "mean luminance of each 8x8 block of the cell grid",
        },
        "luminance": "L = 0.299R + 0.587G + 0.114B, normalised 0..1",
        "upscale_mode": "nearest neighbour only (np.repeat), integer factor 2",
        "ink_fraction": ink_frac,
        "ink_fraction_note": "fraction of CELLS that are ink (pixel fraction is identical)",
    }
    with open(os.path.join(HERE, "photo_field_manifest.json"), "w") as fh:
        json.dump(manifest, fh, indent=2)
        fh.write("\n")

    print("source      :", SRC, native)
    print("crop        :", box, "->", (cw, ch))
    print("cell        :", (CELL_W, CELL_H), " upscale x%d ->" % UPSCALE,
          (CELL_W * UPSCALE, CELL_H * UPSCALE))
    print("ink fraction: %.6f" % ink_frac)
    print("written     :", out_path)


if __name__ == "__main__":
    main()
