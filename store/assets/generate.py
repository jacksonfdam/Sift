#!/usr/bin/env python3
"""Generate Chrome Web Store assets for Sift with Pillow.

Screenshots and promo tiles are built in RGB mode (no alpha channel), as the
store requires. The store icon reuses the extension's own 128px icon. Colors
mirror the product's dark theme in packages/core/src/ui/style.css.

Run: python3 store/assets/generate.py
"""
import os
import shutil
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
ICON_SRC = os.path.join(ROOT, "apps", "extension", "icons", "icon128.png")

# ---- palette (from style.css dark theme) -------------------------------------
BG = "#14181f"
BG_ALT = "#1a1f28"
BG_SUNKEN = "#10141a"
BORDER = "#2a313c"
TEXT = "#e4e8ee"
DIM = "#9aa4b2"
FAINT = "#6b7480"
ACCENT = "#5b9dff"
SEL = "#1e3a5f"
S2, S3, S4, S5 = "#4ade80", "#22d3ee", "#fbbf24", "#f87171"
MASK = "#fbbf24"
TOK_KEY, TOK_STR, TOK_NUM, TOK_PUNCT = "#5dd5e8", "#6ee7a8", "#f0a868", "#9aa4b2"
GRAD_A, GRAD_B = "#2563eb", "#5b9dff"
WHITE = "#ffffff"

SANS = "/System/Library/Fonts/Supplemental/Arial.ttf"
SANS_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
MONO = "/System/Library/Fonts/Menlo.ttc"

_font_cache = {}


def font(size, bold=False, mono=False):
    key = (size, bold, mono)
    if key not in _font_cache:
        path = MONO if mono else (SANS_BOLD if bold else SANS)
        _font_cache[key] = ImageFont.truetype(path, size)
    return _font_cache[key]


def tw(draw, s, f):
    return draw.textlength(s, font=f)


def chip(draw, x, y, label, color, fill=None, pad=8, h=20, fsize=11, bold=False):
    f = font(fsize, bold=bold)
    w = tw(draw, label, f) + pad * 2
    draw.rounded_rectangle((x, y, x + w, y + h), radius=h // 2,
                           fill=fill, outline=color, width=1)
    draw.text((x + pad, y + h / 2), label, font=f, fill=color, anchor="lm")
    return w


def button(draw, x, y, label, h=24, pad=11, fsize=12, active=False):
    f = font(fsize)
    w = tw(draw, label, f) + pad * 2
    fill = "#1b2b48" if active else BG
    outline = ACCENT if active else BORDER
    txt = ACCENT if active else TEXT
    draw.rounded_rectangle((x, y, x + w, y + h), radius=5, fill=fill, outline=outline, width=1)
    draw.text((x + pad, y + h / 2), label, font=f, fill=txt, anchor="lm")
    return w


def gradient(size, c1, c2):
    """Diagonal RGB gradient, no alpha."""
    base = Image.new("RGB", size, c1)
    top = Image.new("RGB", size, c2)
    mask = Image.linear_gradient("L").rotate(-45, expand=True).resize(size)
    return Image.composite(top, base, mask)


def funnel(draw, cx, cy, w, h, color):
    """A simple sieve/funnel glyph from shapes (no emoji)."""
    half = w / 2
    # Funnel body: wide top tapering to a narrow stem.
    draw.line((cx - half, cy - h / 2, cx - w * 0.12, cy + h * 0.18), fill=color, width=6)
    draw.line((cx + half, cy - h / 2, cx + w * 0.12, cy + h * 0.18), fill=color, width=6)
    draw.line((cx - half, cy - h / 2, cx + half, cy - h / 2), fill=color, width=6)
    draw.line((cx - w * 0.12, cy + h * 0.18, cx - w * 0.12, cy + h * 0.5), fill=color, width=6)
    draw.line((cx + w * 0.12, cy + h * 0.18, cx + w * 0.12, cy + h * 0.5), fill=color, width=6)
    # Three falling drops below the stem.
    for i, dy in enumerate((0.62, 0.78, 0.94)):
        r = 5 - i
        draw.ellipse((cx - r, cy + h * dy - r, cx + r, cy + h * dy + r), fill=color)


# ---- inspector shell (shared by both screenshots) ----------------------------
ROWS = [
    ("GET", 200, "api.example.com", "/v1/users", "application/json", "1.2 KB", "124 ms"),
    ("GET", 200, "example.com", "/", "text/html", "4 KB", "30 ms"),
    ("GET", 200, "example.com", "/assets/app.css", "text/css", "512 B", "20 ms"),
    ("GET", 200, "example.com", "/assets/app.js", "application/javascript", "2 KB", "22 ms"),
    ("POST", 201, "api.example.com", "/v1/posts", "application/json", "20 B", "60 ms"),
    ("POST", 303, "example.com", "/login", "—", "—", "80 ms"),
    ("GET", 200, "example.com", "/dashboard", "text/html", "60 B", "18 ms"),
    ("GET", 200, "cdn.example.com", "/pixel.png", "image/png", "68 B", "15 ms"),
    ("GET", 404, "api.example.com", "/v1/missing", "application/json", "27 B", "12 ms"),
    ("GET", 500, "api.example.com", "/v1/boom", "text/html", "40 B", "200 ms"),
    ("GET", 200, "api.example.com", "/v1/orders", "application/json", "8 KB", "95 ms"),
    ("PUT", 200, "api.example.com", "/v1/users/1", "application/json", "256 B", "70 ms"),
    ("DELETE", 204, "api.example.com", "/v1/posts/42", "—", "—", "40 ms"),
    ("GET", 200, "api.example.com", "/v1/search", "application/json", "16 KB", "140 ms"),
]


def status_color(code):
    return {2: S2, 3: S3, 4: S4, 5: S5}.get(code // 100, DIM)


def draw_shell(active_tab):
    W, H = 1280, 800
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    LIST_W = 600

    # Toolbar
    d.rectangle((0, 0, W, 50), fill=BG_ALT)
    d.line((0, 50, W, 50), fill=BORDER)
    d.text((16, 25), "Sift", font=font(16, bold=True), fill=TEXT, anchor="lm")
    # search box
    d.rounded_rectangle((66, 12, 430, 38), radius=5, fill=BG, outline=BORDER)
    d.text((78, 25), "Filter URL, headers, body...", font=font(12), fill=FAINT, anchor="lm")
    x = 446
    x += chip(d, x, 16, "GET", DIM) + 6
    x += chip(d, x, 16, "POST", DIM) + 12
    for cls, col in (("2xx", S2), ("3xx", S3), ("4xx", S4), ("5xx", S5)):
        x += chip(d, x, 16, cls, col) + 6

    # right-aligned action group
    rx = W - 16
    count_f = font(11)
    cnt = "14 flows"
    rx -= tw(d, cnt, count_f)
    d.text((rx, 25), cnt, font=count_f, fill=FAINT, anchor="lm")
    rx -= 14
    for label, active in (("Clear", False), ("Open…", False),
                          ("Export sanitized HAR", False), ("Reveal all", False)):
        f = font(12)
        w = tw(d, label, f) + 22
        rx -= w
        button(d, rx, 13, label, active=active)
        rx -= 8

    # List header
    d.rectangle((0, 50, LIST_W, 76), fill=BG_SUNKEN)
    d.line((LIST_W, 50, LIST_W, H), fill=BORDER)
    hf = font(10, bold=True)
    cols = [(16, "METHOD"), (84, "STATUS"), (150, "URL"),
            (LIST_W - 188, "TYPE"), (LIST_W - 96, "SIZE"), (LIST_W - 44, "TIME")]
    for cx, label in cols:
        d.text((cx, 63), label, font=hf, fill=DIM, anchor="lm")

    # Rows
    y = 76
    rh = 30
    for i, (method, code, host, path, mime, size, t) in enumerate(ROWS):
        if i == 0:
            d.rectangle((0, y, LIST_W, y + rh), fill=SEL)
        d.line((0, y + rh, LIST_W, y + rh), fill=BG_ALT)
        d.text((16, y + rh / 2), method, font=font(11, mono=True), fill=TEXT, anchor="lm")
        d.text((84, y + rh / 2), str(code), font=font(12, bold=True),
               fill=status_color(code), anchor="lm")
        url = host + path
        if tw(d, url, font(12)) > LIST_W - 150 - 196:
            while tw(d, url + "…", font(12)) > LIST_W - 150 - 196 and len(url) > 4:
                url = url[:-1]
            url += "…"
        d.text((150, y + rh / 2), url, font=font(12), fill=TEXT, anchor="lm")
        mt = mime
        if tw(d, mt, font(11)) > 86:
            while tw(d, mt + "…", font(11)) > 86 and len(mt) > 3:
                mt = mt[:-1]
            mt += "…"
        d.text((LIST_W - 188, y + rh / 2), mt, font=font(11), fill=DIM, anchor="lm")
        d.text((LIST_W - 50, y + rh / 2), size, font=font(11), fill=DIM, anchor="rm")
        d.text((LIST_W - 8, y + rh / 2), t, font=font(11), fill=DIM, anchor="rm")
        y += rh
        if y > H - rh:
            break

    # Detail header (request line)
    dx = LIST_W + 16
    d.rounded_rectangle((dx, 62, W - 16, 96), radius=5, fill=BG_SUNKEN)
    rl = font(12, mono=True)
    d.text((dx + 10, 79), "GET", font=font(12, mono=True), fill=TEXT, anchor="lm")
    gw = tw(d, "GET ", rl)
    d.text((dx + 10 + gw, 79),
           "https://api.example.com/v1/users?token=…&page=1",
           font=rl, fill=DIM, anchor="lm")
    d.text((W - 26, 79), "200 OK", font=font(12, mono=True, ), fill=S2, anchor="rm")

    # Tabs
    tabs = ["Headers", "Query", "Cookies", "Request body", "Response body", "Timing"]
    tx = dx
    ty = 112
    for tab in tabs:
        f = font(12)
        w = tw(d, tab, f) + 24
        is_active = tab == active_tab
        if is_active:
            d.rounded_rectangle((tx, ty, tx + w, ty + 26), radius=5, fill=BG, outline=BORDER)
        d.text((tx + 12, ty + 13), tab, font=f, fill=(TEXT if is_active else DIM), anchor="lm")
        tx += w + 2
    d.line((dx, ty + 27, W - 16, ty + 27), fill=BORDER)

    return img, d, dx, W


def screenshot_headers():
    img, d, dx, W = draw_shell("Headers")
    y = 162
    d.text((dx, y), "REQUEST HEADERS", font=font(10, bold=True), fill=DIM, anchor="lm")
    y += 20
    rows = [("Host", "api.example.com", False),
            ("Authorization", None, True),
            ("Accept", "application/json", False)]
    y = kv_rows(d, dx, y, W, rows)
    y += 16
    d.text((dx, y), "RESPONSE HEADERS", font=font(10, bold=True), fill=DIM, anchor="lm")
    y += 20
    rows = [("Content-Type", "application/json; charset=utf-8", False),
            ("Set-Cookie", None, True)]
    kv_rows(d, dx, y, W, rows)
    return img


def kv_rows(d, dx, y, W, rows):
    kf = font(12, mono=True)
    for name, value, masked in rows:
        d.text((dx, y + 9), name, font=kf, fill=DIM, anchor="lm")
        vx = dx + 200
        if masked:
            d.text((vx, y + 9), "•" * 8, font=kf, fill=MASK, anchor="lm")
            lockx = vx + tw(d, "•" * 8, kf) + 8
            d.rounded_rectangle((lockx, y + 4, lockx + 9, y + 14), radius=2, outline=MASK, width=1)
            d.rectangle((lockx + 3, y + 8, lockx + 6, y + 12), fill=MASK)
        else:
            d.text((vx, y + 9), value, font=kf, fill=TEXT, anchor="lm")
        d.line((dx, y + 22, W - 16, y + 22), fill=BG_ALT)
        y += 24
    return y


def screenshot_body():
    img, d, dx, W = draw_shell("Response body")
    y = 158
    # body meta badges
    bx = dx
    for label, warn in (("application/json; charset=utf-8", False), ("1.2 KB", False),
                        ("gzip", False)):
        f = font(11)
        w = tw(d, label, f) + 16
        d.rounded_rectangle((bx, y, bx + w, y + 18), radius=3, fill=BG_SUNKEN)
        d.text((bx + 8, y + 9), label, font=f, fill=DIM, anchor="lm")
        bx += w + 8
    y += 34

    spans = [
        [("{", TOK_PUNCT)],
        [("  ", TOK_PUNCT), ('"users"', TOK_KEY), (": ", TOK_PUNCT), ("[", TOK_PUNCT)],
        [("    ", TOK_PUNCT), ("{ ", TOK_PUNCT), ('"id"', TOK_KEY), (": ", TOK_PUNCT),
         ("1", TOK_NUM), (", ", TOK_PUNCT), ('"name"', TOK_KEY), (": ", TOK_PUNCT),
         ('"Ada Lovelace"', TOK_STR), (", ", TOK_PUNCT), ('"role"', TOK_KEY), (": ", TOK_PUNCT),
         ('"admin"', TOK_STR), (" }", TOK_PUNCT), (",", TOK_PUNCT)],
        [("    ", TOK_PUNCT), ("{ ", TOK_PUNCT), ('"id"', TOK_KEY), (": ", TOK_PUNCT),
         ("2", TOK_NUM), (", ", TOK_PUNCT), ('"name"', TOK_KEY), (": ", TOK_PUNCT),
         ('"Alan Turing"', TOK_STR), (", ", TOK_PUNCT), ('"role"', TOK_KEY), (": ", TOK_PUNCT),
         ('"user"', TOK_STR), (" }", TOK_PUNCT)],
        [("  ", TOK_PUNCT), ("],", TOK_PUNCT)],
        [("  ", TOK_PUNCT), ('"page"', TOK_KEY), (": ", TOK_PUNCT), ("1", TOK_NUM), (",", TOK_PUNCT)],
        [("  ", TOK_PUNCT), ('"total"', TOK_KEY), (": ", TOK_PUNCT), ("2", TOK_NUM)],
        [("}", TOK_PUNCT)],
    ]
    mf = font(13, mono=True)
    lh = 22
    for line in spans:
        x = dx
        for text, color in line:
            d.text((x, y), text, font=mf, fill=color, anchor="lm")
            x += tw(d, text, mf)
        y += lh
    return img


# ---- promo tiles -------------------------------------------------------------
def promo(size, wordmark_size, summary_size, with_card):
    W, H = size
    img = gradient(size, GRAD_A, GRAD_B).convert("RGB")
    d = ImageDraw.Draw(img)
    pad = int(H * 0.12)

    funnel(d, pad + 34, H * 0.30, 52, 64, WHITE)

    d.text((pad + 80, H * 0.30), "Sift", font=font(wordmark_size, bold=True),
           fill=WHITE, anchor="lm")

    summary = "Privacy-first viewer for HAR, Fiddler SAZ, and Charles captures."
    sub = "Read-only. Parsed in memory. Nothing saved or sent."
    sf = font(summary_size, bold=False)
    # wrap summary to fit width
    maxw = (W - pad * 2) if not with_card else int(W * 0.56)
    lines = wrap(d, summary, sf, maxw)
    yy = H * 0.52
    for ln in lines:
        d.text((pad, yy), ln, font=sf, fill="#eaf1ff", anchor="lm")
        yy += summary_size + 8
    d.text((pad, yy + 6), sub, font=font(int(summary_size * 0.8)), fill="#cfe0ff", anchor="lm")

    if with_card:
        # faux inspector card on the right
        cw, ch = int(W * 0.34), int(H * 0.66)
        cx0, cy0 = W - cw - pad, (H - ch) // 2
        d.rounded_rectangle((cx0, cy0, cx0 + cw, cy0 + ch), radius=12, fill=BG, outline=BORDER, width=2)
        d.rectangle((cx0 + 2, cy0 + 2, cx0 + cw - 2, cy0 + 34), fill=BG_ALT)
        d.text((cx0 + 14, cy0 + 18), "Sift", font=font(13, bold=True), fill=TEXT, anchor="lm")
        ry = cy0 + 48
        sample = [("GET", 200, "/v1/users"), ("POST", 201, "/v1/posts"),
                  ("GET", 404, "/v1/missing"), ("GET", 500, "/v1/boom"),
                  ("PUT", 200, "/v1/users/1")]
        for method, code, path in sample:
            d.text((cx0 + 14, ry + 10), method, font=font(11, mono=True), fill=TEXT, anchor="lm")
            d.text((cx0 + 64, ry + 10), str(code), font=font(11, bold=True),
                   fill=status_color(code), anchor="lm")
            d.text((cx0 + 100, ry + 10), path, font=font(11, mono=True), fill=DIM, anchor="lm")
            d.line((cx0 + 10, ry + 24, cx0 + cw - 10, ry + 24), fill=BG_ALT)
            ry += 26
    return img


def wrap(d, text, f, maxw):
    words = text.split()
    lines, cur = [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if tw(d, trial, f) <= maxw:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


# ---- write everything --------------------------------------------------------
def save_rgb(img, name):
    assert img.mode == "RGB", f"{name} must be RGB, got {img.mode}"
    img.save(os.path.join(HERE, name))


def main():
    # 1) store icon: reuse the extension's own 128px icon (alpha allowed)
    shutil.copyfile(ICON_SRC, os.path.join(HERE, "store-icon-128.png"))

    save_rgb(screenshot_headers(), "screenshot-1-inspector-1280x800.png")
    save_rgb(screenshot_body(), "screenshot-2-response-body-1280x800.png")
    save_rgb(promo((440, 280), 64, 17, with_card=False), "small-promo-440x280.png")
    save_rgb(promo((1400, 560), 150, 30, with_card=True), "marquee-1400x560.png")

    # verify dimensions
    expect = {
        "store-icon-128.png": (128, 128),
        "screenshot-1-inspector-1280x800.png": (1280, 800),
        "screenshot-2-response-body-1280x800.png": (1280, 800),
        "small-promo-440x280.png": (440, 280),
        "marquee-1400x560.png": (1400, 560),
    }
    for name, dim in expect.items():
        im = Image.open(os.path.join(HERE, name))
        alpha = "alpha" if im.mode in ("RGBA", "LA") or "transparency" in im.info else "no-alpha"
        ok = "OK" if im.size == dim else "WRONG"
        print(f"{ok}  {name}  {im.size[0]}x{im.size[1]}  {im.mode}  {alpha}")


if __name__ == "__main__":
    main()
