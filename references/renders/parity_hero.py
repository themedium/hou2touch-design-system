#!/usr/bin/env python3
"""
PARITY render of the h2t website hero ink-cloud shader.

Reproduces, in Python/NumPy, the *actual* GPU fragment shader shipped in
`en/index.html` (the `fs` template literal, line ~4119).  The shader source is
kept verbatim in `parity_shader.glsl` next to this file.

Uniforms used (as captured in the GPU reference):
    R = (1439, 739)   viewport
    I = (1440, 900)   hero_school.webp native size
    M = (0.5, 0.5)    loupe centre
    t = 6.0          time (static frame)
    h = 0.0          loupe strength (off)
    A = 0.0          audio level (off)
    C = 4            cell size px  = max(3, round(739/170))
    P = 0.6          image centre x
    K = 1.0          halftone reveal (fully revealed)
    B = 197.0        cloud mask baseline

Pipeline: GLSL -> NumPy -> sRGB float -> Display-P3 encode -> 8-bit PNG.
(The GPU reference PNG stores Display-P3 encoded bytes; see PARITY_NOTES.md.)
"""

import json
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
TEX_PATH = os.path.join(SITE, "img", "hero_school.webp")
REF_PATH = os.path.join(HERE, "REFERENCE_gpu_hero_1439x739.png")
OUT_PNG = os.path.join(HERE, "parity_hero_1439x739.png")
OUT_MANIFEST = os.path.join(HERE, "parity_hero_manifest.json")

# ---------------------------------------------------------------- uniforms
W, H = 1439, 739
Iw, Ih = 1440, 900
MU = (0.5, 0.5)
T_TIME = 6.0
H_LOUPE = 0.0
A_LVL = 0.0
C_CELL = 4.0
P_IMG = 0.6
K_REVEAL = 1.0
B_MASK = 197.0

PAP = np.array([0.914, 0.906, 0.878])
INK = np.array([0.043, 0.043, 0.047])
ORG = np.array([0.898, 0.314, 0.118])
DC = INK + ((np.array([0.16, 0.2, 0.27]) - INK) * 0.35)   # mix(INK, vec3(.16,.2,.27), .35)
ORG_MIX = PAP + (ORG - PAP) * 0.9                        # mix(PAP, ORG, .9)

LUMA = np.array([0.299, 0.587, 0.114])


# ------------------------------------------------------------------ GLSL lib
def fract(x):
    return np.modf(x)[0]


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def hs(p):
    """vec3 hs(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(vec3(p.x*p.y*p.z,p.x+p.y*p.z,p.x*p.y+p.z));}"""
    p = fract(p * 0.3183099 + 0.1) * 17.0
    x, y, z = p[..., 0], p[..., 1], p[..., 2]
    return np.stack([fract(x * y * z), fract(x + y * z), fract(x * y + z)], axis=-1)


def n3(x):
    """float n(vec3 x) - trilinear value noise, smoothstep fade."""
    i = np.floor(x)
    f = fract(x)
    f = f * f * (3.0 - 2.0 * f)

    def c(ox, oy, oz):
        return hs(i + np.array([ox, oy, oz], dtype=x.dtype))[..., 0]

    x00 = c(0, 0, 0) * (1 - f[..., 0]) + c(1, 0, 0) * f[..., 0]
    x10 = c(0, 1, 0) * (1 - f[..., 0]) + c(1, 1, 0) * f[..., 0]
    x01 = c(0, 0, 1) * (1 - f[..., 0]) + c(1, 0, 1) * f[..., 0]
    x11 = c(0, 1, 1) * (1 - f[..., 0]) + c(1, 1, 1) * f[..., 0]
    y0 = x00 * (1 - f[..., 1]) + x10 * f[..., 1]
    y1 = x01 * (1 - f[..., 1]) + x11 * f[..., 1]
    return y0 * (1 - f[..., 2]) + y1 * f[..., 2]


def b2(a):
    """float b2(vec2 a){a=floor(a);return fract(dot(a,vec2(.5,a.y*.75)));}

    The GPU evaluates this in 32-bit float: dot(a, vec2(.5, a.y*.75)) reaches
    ~4e5 for the Bayer cell rows, where a float32 mantissa already carries ~0.03
    of error before fract() is taken.  The same 32-bit rounding is reproduced
    here, otherwise the dither pattern (and therefore the dot grid) drifts.
    """
    a = np.floor(a).astype(np.float32)
    d = (a[..., 0] * np.float32(0.5) + a[..., 1] * (a[..., 1] * np.float32(0.75))).astype(np.float32)
    return np.modf(d)[0].astype(np.float64)


def b4(a):
    return b2(0.5 * a) * 0.25 + b2(a)


def b8(a):
    return b4(0.5 * a) * 0.25 + b2(a)


def pk(a):
    """float pk(vec2 c){return fract(sin(dot(c,vec2(12.9898,78.233)))*43758.5453);}

    dot() reaches ~1.2e5 for the rotated halftone grid, so the 32-bit argument
    is reproduced before sin() is taken (GPU: highp float = IEEE binary32).
    """
    x = a[..., 0].astype(np.float32)
    y = a[..., 1].astype(np.float32)
    d = (x * np.float32(12.9898) + y * np.float32(78.233)).astype(np.float32)
    return np.modf(np.sin(d.astype(np.float64)) * 43758.5453)[0].astype(np.float64)


def vn(x):
    """float vn(float x){float i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(pk(vec2(i,3.1)),pk(vec2(i+1.,3.1)),f);}"""
    i = np.floor(x)
    f = fract(x)
    f = f * f * (3.0 - 2.0 * f)
    p0 = fract(np.sin(i * 12.9898 + 3.1 * 78.233) * 43758.5453)
    p1 = fract(np.sin((i + 1.0) * 12.9898 + 3.1 * 78.233) * 43758.5453)
    return p0 * (1 - f) + p1 * f


def mk(px, py):
    """float mk(vec2 p){float y=R.y-p.y;if(y>B+72.)return 1.;y+=16.*(.5*vn(p.x/61.)+.3*vn(p.x/19.)+.2*vn(p.x/7.)-.5);return smoothstep(B,B+28.+28.*vn(p.x/83.+5.),y);}"""
    y = H - py
    wob = 16.0 * (0.5 * vn(px / 61.0) + 0.3 * vn(px / 19.0) + 0.2 * vn(px / 7.0) - 0.5)
    ya = y + wob
    hi = B_MASK + 28.0 + 28.0 * vn(px / 83.0 + 5.0)
    out = smoothstep(B_MASK, hi, ya)
    return np.where(y > B_MASK + 72.0, 1.0, out)


def gate(cx, cy, y):
    """float gate(vec2 c,float y){return step(.62*pk(c)+.38*(1.-y),K*1.0001);}"""
    c = np.stack(np.broadcast_arrays(cx, cy), axis=-1)
    return np.where(K_REVEAL * 1.0001 >= (0.62 * pk(c) + 0.38 * (1.0 - y)), 1.0, 0.0)


# ------------------------------------------------------------------ colour
def srgb_to_display_p3(rgb):
    """Encode sRGB values as Display-P3 (the GPU reference PNG stores P3 bytes)."""
    srgb_to_xyz = np.array([
        [0.41239079926595934, 0.357584339383878, 0.1804807884018343],
        [0.21263900587151027, 0.715168678767756, 0.07219231536073371],
        [0.019330818715591851, 0.11919477979462598, 0.9505321522496607],
    ])
    p3_to_xyz = np.array([
        [0.4865709486482162, 0.26566769316909306, 0.1982172852343625],
        [0.2289745640697488, 0.6917385218365064, 0.079286914093745],
        [0.0, 0.04511338185890264, 1.043944368900976],
    ])
    xyz_to_p3 = np.linalg.inv(p3_to_xyz)

    c = np.clip(np.asarray(rgb, dtype=np.float64), 0.0, 1.0)
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    xyz = lin @ srgb_to_xyz.T
    p3 = xyz @ xyz_to_p3.T
    enc = np.where(p3 <= 0.0031308, p3 * 12.92, 1.055 * np.power(np.clip(p3, 0, None), 1 / 2.4) - 0.055)
    return np.clip(enc, 0.0, 1.0)


# ------------------------------------------------------------------ texture
def make_sampler(tex):
    """bilinear + CLAMP_TO_EDGE, exactly like TEXTURE_MIN_FILTER=LINEAR."""
    def sample(u, r):
        """u: [0,1] column; r: [0,1] row in file space (0 = first row of the image)."""
        sx = u * Iw - 0.5
        sr = r * Ih - 0.5
        i0 = np.floor(sx)
        j0 = np.floor(sr)
        fx = (sx - i0)[..., None]
        fr = (sr - j0)[..., None]
        i0 = i0.astype(np.int64)
        j0 = j0.astype(np.int64)
        i1 = np.clip(i0 + 1, 0, Iw - 1)
        j1 = np.clip(j0 + 1, 0, Ih - 1)
        i0 = np.clip(i0, 0, Iw - 1)
        j0 = np.clip(j0, 0, Ih - 1)
        c00 = tex[j0, i0]
        c10 = tex[j0, i1]
        c01 = tex[j1, i0]
        c11 = tex[j1, i1]
        top = c00 * (1 - fx) + c10 * fx
        bot = c01 * (1 - fx) + c11 * fx
        return top * (1 - fr) + bot * fr

    return sample


# --------------------------------------------------------------------- main
def render(flip_texture_y):
    """flip_texture_y: True  -> file row 0 == texture v=1 (WebGL UNPACK_FLIP_Y_WEBGL=true)
                          False -> file row 0 == texture v=0
    """
    tex = np.asarray(Image.open(TEX_PATH).convert("RGB")).astype(np.float64) / 255.0
    if tex.shape != (Ih, Iw, 3):
        raise SystemExit("texture size mismatch: %s" % (tex.shape,))
    sample = make_sampler(tex)

    # ---- gl_FragCoord (pixel centre, y up)
    fx = np.arange(W, dtype=np.float64) + 0.5
    fy = np.arange(H, dtype=np.float64) + 0.5
    FX, FY = np.meshgrid(fx, fy)

    # ---- loupe (h = 0 -> inl = 0 -> cell = C)
    d = np.hypot((FX - MU[0] * W) / H, (FY - MU[1] * H) / H)
    inl = np.where(H_LOUPE * 0.15 >= d, 1.0, 0.0)
    cell = C_CELL * (1 - inl) + max(2.0, np.floor(C_CELL * 0.5)) * inl   # h = 0 -> cell = C
    cell = float(C_CELL)          # h = 0 => inl = 0 everywhere, so cell is constant

    # ---- fl : per-cell flow noise (cell grid)
    gx = np.arange(0, W, int(C_CELL))
    gy = np.arange(0, H, int(C_CELL))
    shape = (len(gy), len(gx))
    ar = W / H
    tt = T_TIME * 0.08
    VX = np.broadcast_to(((gx + 0.5) * C_CELL / W) * ar * 2.2, shape)
    VY = np.broadcast_to(((gy + 0.5) * C_CELL / H)[:, None] * 2.2, shape)
    TT = np.full(shape, tt)
    flx_g = n3(np.stack([VX, VY, TT], axis=-1)) - 0.5
    fly_g = n3(np.stack([VX + 7.3, VY, TT], axis=-1)) - 0.5

    ix4 = np.floor(FX / C_CELL).astype(np.int64)
    iy4 = np.floor(FY / C_CELL).astype(np.int64)
    fl_x = flx_g[iy4, ix4]
    fl_y = fly_g[iy4, ix4]

    # ---- aspect-cover transform (cov)
    ar = W / H
    ir = Iw / Ih
    if ar > ir:
        sx, sy = 1.0, ir / ar
    else:
        sx, sy = ar / ir, 1.0

    def cov(uvx, uvy):
        cx = (uvx - 0.5) * sx + P_IMG + (0.5 - P_IMG) * sx
        cy = (uvy - 0.5) * sy + 0.48 + (0.5 - 0.48) * sy
        return cx, 1.0 - cy

    def to_row(v):
        """texture v (1 = top of the uploaded texture) -> file row coordinate."""
        return (1.0 - v) if flip_texture_y else v

    # ---- rotated halftone grid (rt / ri)
    hc = C_CELL * 1.25
    rp_x = 0.7071 * (FX - FY)
    rp_y = 0.7071 * (FX + FY)
    ixr = np.floor(rp_x / hc).astype(np.int64)
    iyr = np.floor(rp_y / hc).astype(np.int64)
    x0, x1 = int(ixr.min()), int(ixr.max())
    y0, y1 = int(iyr.min()), int(iyr.max())
    IXr = np.arange(x0, x1 + 1, dtype=np.float64)
    IYr = np.arange(y0, y1 + 1, dtype=np.float64)
    hq_x_g = (IXr + 0.5) * hc
    hq_y_g = (IYr + 0.5) * hc
    cen_x_g = 0.7071 * (hq_x_g[None, :] + hq_y_g[:, None])
    cen_y_g = 0.7071 * (-hq_x_g[None, :] + hq_y_g[:, None])
    PKg = pk(np.stack(np.broadcast_arrays(hq_x_g[None, :] + 0.5, hq_y_g[:, None] + 0.5), axis=-1))
    m_g = mk(cen_x_g, cen_y_g)
    step_g = np.where(m_g >= PKg * 0.9 + 0.05, 1.0, 0.0)
    rad_base_g = hc * 0.5 * np.sqrt(m_g) * step_g

    cen_x_p = cen_x_g[iyr - y0, ixr - x0]
    cen_y_p = cen_y_g[iyr - y0, ixr - x0]
    hq_x_p = hq_x_g[ixr - x0]
    hq_y_p = hq_y_g[iyr - y0]
    rad_base_p = rad_base_g[iyr - y0, ixr - x0]

    # ---- ink layer (per pixel, texture sampled at the rotated cell centre)
    cx, v = cov(cen_x_p / W, cen_y_p / H)
    U = cx + fl_x * (0.012 + A_LVL * 0.03)
    V = v + fl_y * (0.012 + A_LVL * 0.03)
    ch = sample(U, to_row(V))
    lh = 1.0 - (ch * LUMA).sum(axis=-1)
    ink = np.clip((lh - 0.1) / 0.62, 0.0, 1.0) ** 1.35
    rad = rad_base_p * np.sqrt(np.clip(ink + A_LVL * 0.12, 0.0, 1.0))
    dist = np.hypot(rp_x - hq_x_p, rp_y - hq_y_p)
    dm = smoothstep(rad + 0.7, rad - 0.7, dist)
    dm = dm * gate(hq_x_p, hq_y_p, cen_y_p / H)

    # ---- Bayer background (2 px cells)
    cb = max(2.0, np.floor(H / 300.0))
    cb = 2.0
    gx2 = np.arange(int(np.ceil(W / cb)))
    gy2 = np.arange(int(np.ceil(H / cb)))
    qb_x = (gx2 + 0.5) * cb
    qb_y = (gy2 + 0.5) * cb
    shape2 = (len(gy2), len(gx2))
    cx2, v2 = cov(np.broadcast_to(qb_x / W, shape2).copy(),
                   np.broadcast_to((qb_y / H)[:, None], shape2).copy())
    flx4 = np.broadcast_to(flx_g[np.floor(qb_y / C_CELL).astype(np.int64)[:, None],
                                 np.floor(qb_x / C_CELL).astype(np.int64)[None, :]], shape2)
    fly4 = np.broadcast_to(fly_g[np.floor(qb_y / C_CELL).astype(np.int64)[:, None],
                                 np.floor(qb_x / C_CELL).astype(np.int64)[None, :]], shape2)
    U2 = cx2 + flx4 * 0.012
    V2 = v2 + fly4 * 0.012
    cs = sample(U2, to_row(V2))
    luma2 = (cs * LUMA).sum(axis=-1)
    lb = np.clip(((1.0 - luma2) - 0.05) * 3.2 + A_LVL * 0.18, 0.0, 1.0) * 2.0
    bs = np.floor(lb)
    a_cell = np.stack(np.broadcast_arrays(np.broadcast_to(qb_x / cb, shape2).copy(),
                                           np.broadcast_to((qb_y / cb)[:, None], shape2).copy()), axis=-1)
    b8v = b8(a_cell)
    lev = bs + np.where(lb - bs >= b8v, 1.0, 0.0)
    m2 = mk(np.broadcast_to(qb_x, shape2).copy(), np.broadcast_to(qb_y[:, None], shape2).copy())
    ss = smoothstep(0.96, 1.0, m2)
    g2 = gate(np.broadcast_to(np.floor(a_cell[..., 0]), shape2).copy(),
              np.broadcast_to(np.floor(a_cell[..., 1]), shape2).copy(),
              np.broadcast_to((qb_y / H)[:, None], shape2).copy())
    amt = g2 * np.where(ss >= b8v, 1.0, 0.0)
    orange = PAP[None, None, :] + (ORG_MIX - PAP)[None, None, :] * amt[..., None]
    bg2 = np.where(lev[..., None] < 0.5, PAP[None, None, :],
                   np.where(lev[..., None] < 1.5, orange, PAP[None, None, :]))

    ix2 = np.floor(FX / cb).astype(np.int64)
    iy2 = np.floor(FY / cb).astype(np.int64)
    bg = bg2[iy2, ix2]

    # ---- composite
    out = bg + (DC[None, None, :] - bg) * dm[..., None]
    return out


def to_png(out_srgb):
    p3 = srgb_to_display_p3(out_srgb)
    b = np.clip(np.rint(p3 * 255.0), 0, 255).astype(np.uint8)
    b = b[::-1]                      # GL y-up -> PNG y-down
    return Image.fromarray(b, "RGB")


def main():
    # The texture row convention (WebGL UNPACK_FLIP_Y_WEBGL) is a property of the capture
    # pipeline, not of the shader: both conventions are rendered and the one that matches the
    # GPU reference is used (and recorded in the manifest).
    flip = False
    best = None
    ref = None
    if os.path.exists(REF_PATH):
        ref = np.asarray(Image.open(REF_PATH).convert("RGB")).astype(np.float64)
        for f in (True, False):
            img = to_png(render(f))
            a = np.asarray(img).astype(np.float64)
            mae = np.abs(a - ref).mean()
            print("texture row convention flip=%s -> MAE vs reference = %.4f" % (f, mae))
            if best is None or mae < best[0]:
                best = (mae, f)
        flip = best[1]
        print("chosen flip_texture_y = %s (MAE %.4f)" % (flip, best[0]))

    img = to_png(render(flip))
    img.save(OUT_PNG)

    arr = np.asarray(img).reshape(-1, 3)
    cols, counts = np.unique(arr, axis=0, return_counts=True)
    tot = arr.shape[0]

    def pct(mask):
        return 100.0 * counts[mask].sum() / tot

    paper = (cols[:, 0] == 233) & (cols[:, 1] == 231) & (cols[:, 2] == 225)
    ink0 = (cols[:, 0] == 11) & (cols[:, 1] == 11) & (cols[:, 2] == 12)
    orange = (cols[:, 0] > 150) & (cols[:, 1] < 120) & (cols[:, 2] < 90)

    manifest = {
        "file": os.path.basename(OUT_PNG),
        "size": [W, H],
        "shader_source": "parity_shader.glsl (verbatim from en/index.html, `fs` literal)",
        "uniforms": {"R": [W, H], "I": [Iw, Ih], "M": list(MU), "t": T_TIME, "h": H_LOUPE,
                     "A": A_LVL, "C": C_CELL, "P": P_IMG, "K": K_REVEAL, "B": B_MASK},
        "texture": os.path.relpath(TEX_PATH, SITE),
        "texture_row_convention": "flip_texture_y=%s (file row 0 == texture v=%s)"
                                  % (flip, "1" if flip else "0"),
        "output_colour_space": "Display-P3 (byte values), as in the GPU reference PNG",
        "stats": {
            "unique_colours": int(len(cols)),
            "paper_e9e7e1_pct": round(float(pct(paper)), 4),
            "ink_0b0b0c_pct": round(float(pct(ink0)), 4),
            "orange_pct": round(float(pct(orange)), 4),
        },
    }

    if os.path.exists(REF_PATH):
        ref = np.asarray(Image.open(REF_PATH).convert("RGB")).astype(np.float64)
        a = np.asarray(img).astype(np.float64)
        d = np.abs(a - ref)

        def stats_of(arr):
            cols_, counts_ = np.unique(arr.reshape(-1, 3), axis=0, return_counts=True)
            n = arr.shape[0] * arr.shape[1]

            def pc(mask):
                return round(100.0 * counts_[mask].sum() / n, 4)

            return {
                "unique_colours": int(len(cols_)),
                "paper_e9e7e1_pct": pc((cols_[:, 0] == 233) & (cols_[:, 1] == 231) & (cols_[:, 2] == 225)),
                "paper_e9e7e0_pct": pc((cols_[:, 0] == 233) & (cols_[:, 1] == 231) & (cols_[:, 2] == 224)),
                "ink_0b0b0c_pct": pc((cols_[:, 0] == 11) & (cols_[:, 1] == 11) & (cols_[:, 2] == 12)),
                "orange_pct": pc((cols_[:, 0] > 150) & (cols_[:, 1] < 120) & (cols_[:, 2] < 90)),
            }

        manifest["reference_stats"] = stats_of(ref)
        manifest["vs_reference"] = {
            "mae_per_channel": round(float(d.mean()), 4),
            "max_channel_diff": int(d.max()),
            "pixels_within_12_pct": round(float(100.0 * (d.max(axis=2) <= 12).sum() / d.shape[0] / d.shape[1]), 4),
        }

    with open(OUT_MANIFEST, "w") as fh:
        json.dump(manifest, fh, indent=2)
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
