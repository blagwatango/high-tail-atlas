"""Build web/public/og.png — static Open Graph card WITH the caveat banner.

Not a naked map. Not ImageResponse. Run from web/: python scripts/generate_og.py
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parents[1] / "public" / "og.png"
W, H = 1200, 630

BG = (250, 250, 249)
INK = (28, 25, 23)
MUTED = (68, 64, 60)
BANNER_BG = (255, 251, 235)
BANNER_BORDER = (252, 211, 77)
BADGE_BG = (180, 83, 9)
WHITE = (255, 255, 255)

TITLE = "High-Tail Atlas"
SUBTITLE = "Modeled estimates of the population share at IQ ≥ 130"
TAGLINE = "estimates, not measurements."
CAVEAT = (
    "These figures are modeled estimates, not measurements. "
    "Each percentage is the right tail of a normal distribution given a "
    "published or assumed country mean and SD (default 15), applied to UN "
    "population counts. National IQ compilations are incomplete and contested. "
    "This is not a ranking of people, nations, or worth. Read the methodology."
)
BADGE = "DEMO DATA"

FONT_CANDIDATES = [
    Path(r"C:\Windows\Fonts\segoeui.ttf"),
    Path(r"C:\Windows\Fonts\arial.ttf"),
    Path(r"C:\Windows\Fonts\calibri.ttf"),
    Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    Path("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"),
    Path("/System/Library/Fonts/Supplemental/Arial.ttf"),
]
BOLD_CANDIDATES = [
    Path(r"C:\Windows\Fonts\segoeuib.ttf"),
    Path(r"C:\Windows\Fonts\arialbd.ttf"),
    Path(r"C:\Windows\Fonts\calibrib.ttf"),
    Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    Path("/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"),
    Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf"),
]


def load_font(candidates: list[Path], size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in candidates:
        if path.is_file():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def wrap(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, max_width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    cur = ""
    for word in words:
        trial = f"{cur} {word}".strip()
        if draw.textlength(trial, font=font) <= max_width:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def main() -> None:
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)

    font_banner = load_font(FONT_CANDIDATES, 22)
    font_title = load_font(BOLD_CANDIDATES, 64)
    font_sub = load_font(FONT_CANDIDATES, 28)
    font_tag = load_font(BOLD_CANDIDATES, 26)
    font_badge = load_font(BOLD_CANDIDATES, 18)

    pad = 48
    max_text = W - pad * 2
    banner_lines = wrap(draw, CAVEAT, font_banner, max_text)
    line_h = 30
    banner_h = 36 + len(banner_lines) * line_h + 20

    draw.rectangle([(0, 0), (W, banner_h)], fill=BANNER_BG)
    draw.rectangle([(0, banner_h - 3), (W, banner_h)], fill=BANNER_BORDER)

    y = 20
    for line in banner_lines:
        draw.text((pad, y), line, font=font_banner, fill=INK)
        y += line_h

    y = banner_h + 40
    badge_pad_x, badge_pad_y = 14, 8
    bw = draw.textlength(BADGE, font=font_badge) + badge_pad_x * 2
    bh = 18 + badge_pad_y * 2
    draw.rounded_rectangle(
        [(pad, y), (pad + bw, y + bh)],
        radius=6,
        fill=BADGE_BG,
    )
    draw.text((pad + badge_pad_x, y + badge_pad_y - 1), BADGE, font=font_badge, fill=WHITE)

    y += bh + 28
    draw.text((pad, y), TITLE, font=font_title, fill=INK)
    y += 80
    draw.text((pad, y), SUBTITLE, font=font_sub, fill=MUTED)
    y += 48
    draw.text((pad, y), TAGLINE, font=font_tag, fill=INK)

    footer = "Modeled estimates — not a map of national worth."
    draw.text((pad, H - 48), footer, font=font_banner, fill=MUTED)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT, "PNG", optimize=True)
    size = OUT.stat().st_size
    if size >= 500_000:
        raise SystemExit(f"{OUT} is {size} bytes; must stay under 500 KB")
    print(f"wrote {OUT} ({size} bytes)")


if __name__ == "__main__":
    main()
