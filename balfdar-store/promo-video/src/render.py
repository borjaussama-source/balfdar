#!/usr/bin/env python3
"""Render the editable BALFDAR promotional video from config.json and real product images."""

from __future__ import annotations

import json
import math
import os
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent.parent
CONFIG = json.loads((ROOT / "config.json").read_text(encoding="utf-8"))
VIDEO = CONFIG["video"]
W, H, FPS = int(VIDEO["width"]), int(VIDEO["height"]), int(VIDEO["fps"])
INTRO = float(VIDEO["introSeconds"])
PRODUCT_DURATION = float(VIDEO["productSeconds"])
OUTRO = float(VIDEO["outroSeconds"])
TRANSITION = float(VIDEO["transitionSeconds"])
PRODUCTS = CONFIG["products"]
DURATION = INTRO + len(PRODUCTS) * PRODUCT_DURATION + OUTRO
BRAND = CONFIG["brand"]
SILVER = (221, 220, 217)
MUTED = (165, 164, 162)
BLACK = (7, 7, 8)


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = []
    if os.name == "nt":
        fonts = Path(os.environ.get("WINDIR", r"C:\Windows")) / "Fonts"
        candidates += [fonts / ("georgiab.ttf" if bold else "georgia.ttf"), fonts / ("arialbd.ttf" if bold else "arial.ttf")]
    candidates += [Path("/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"), Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")]
    for candidate in candidates:
        try:
            if candidate.exists():
                return ImageFont.truetype(str(candidate), size=size)
        except OSError:
            pass
    return ImageFont.load_default()


FONTS = {
    "display": font(84), "title": font(74), "body": font(29), "small": font(20),
    "tiny": font(16), "price": font(33), "cta": font(28, True),
}


def load_photo(product: dict) -> Image.Image:
    image = ImageOps.exif_transpose(Image.open(ROOT / product["image"])).convert("RGB")
    crop_top = float(product.get("cropTop", 0))
    if crop_top > 0:
        top = min(image.height - 1, int(image.height * crop_top))
        image = image.crop((0, top, image.width, image.height))
    return image


PHOTOS = [load_photo(product) for product in PRODUCTS]
LOGO = ImageOps.exif_transpose(Image.open(ROOT / "assets" / "balfdar-logo.png")).convert("RGBA")


def fit_cover(image: Image.Image, size: tuple[int, int], zoom: float = 1.0, focus_x: float = .5, focus_y: float = .5) -> Image.Image:
    width, height = size
    scale = max(width / image.width, height / image.height) * zoom
    resized = image.resize((max(width, round(image.width * scale)), max(height, round(image.height * scale))), Image.Resampling.LANCZOS)
    left = round((resized.width - width) * min(1, max(0, focus_x)))
    top = round((resized.height - height) * min(1, max(0, focus_y)))
    return resized.crop((left, top, left + width, top + height))


def make_background(photo: Image.Image | None = None) -> Image.Image:
    if photo is None:
        base = Image.new("RGB", (W, H), BLACK)
    else:
        base = fit_cover(photo, (W, H), zoom=1.12)
        base = base.filter(ImageFilter.GaussianBlur(34))
        base = ImageEnhance.Brightness(base).enhance(.35)
    # Subtle monochrome spotlight and vignette, generated in code (no stock imagery).
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((W * .12, H * .06, W * .95, H * .78), fill=(177, 177, 177, 22))
    glow = glow.filter(ImageFilter.GaussianBlur(140))
    base = Image.alpha_composite(base.convert("RGBA"), glow)
    vignette = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    vd = ImageDraw.Draw(vignette)
    for index in range(22):
        inset = index * 18
        alpha = int(3 + index * 1.35)
        vd.rounded_rectangle((inset, inset, W - inset, H - inset), radius=50, outline=(0, 0, 0, alpha), width=22)
    return Image.alpha_composite(base, vignette).convert("RGB")


def draw_spaced(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, use_font, fill, spacing: int = 4) -> None:
    x, y = xy
    for char in text:
        draw.text((x, y), char, font=use_font, fill=fill)
        x += draw.textlength(char, font=use_font) + spacing


def draw_logo(canvas: Image.Image, box: tuple[int, int, int, int]) -> None:
    x, y, width, height = (int(value) for value in box)
    logo = LOGO.copy()
    logo.thumbnail((width, height), Image.Resampling.LANCZOS)
    canvas.alpha_composite(logo, (x + (width - logo.width) // 2, y + (height - logo.height) // 2))


def opening(progress: float) -> Image.Image:
    canvas = make_background().convert("RGBA")
    draw = ImageDraw.Draw(canvas)
    draw.line((W * .22, H * .28, W * .78, H * .28), fill=(164, 164, 164, 90), width=1)
    draw_logo(canvas, (W * .13, H * .34, W * .74, H * .36))
    draw_spaced(draw, (W * .25, H * .76), CONFIG["brandLine"], FONTS["small"], SILVER, 3)
    draw.text((W * .5, H * .81), CONFIG["tagline"], font=FONTS["body"], fill=MUTED, anchor="mm")
    draw.line((W * .34, H * .86, W * .66, H * .86), fill=(164, 164, 164, 90), width=1)
    draw.text((W * .5, H * .91), "COLLECTION · 01", font=FONTS["tiny"], fill=MUTED, anchor="mm")
    return canvas.convert("RGB")


def product_scene(index: int, progress: float) -> Image.Image:
    product = PRODUCTS[index]
    photo = PHOTOS[index]
    canvas = make_background(photo).convert("RGBA")
    draw = ImageDraw.Draw(canvas)

    # One slow, controlled push-in per real catalog image.
    zoom = 1.0 + .055 * min(1, max(0, progress))
    card_w, card_h = round(W * .86), round(H * .645)
    card_x, card_y = (W - card_w) // 2, round(H * .095)
    shot = fit_cover(photo, (card_w, card_h), zoom=zoom, focus_x=.5, focus_y=.45 + .04 * progress).convert("RGBA")
    canvas.alpha_composite(shot, (card_x, card_y))
    draw = ImageDraw.Draw(canvas, "RGBA")

    # Soft fade at the bottom of the picture keeps the type legible without covering the garment.
    shade = Image.new("RGBA", (card_w, 260), (0, 0, 0, 0))
    shade_draw = ImageDraw.Draw(shade)
    for y in range(260):
        shade_draw.line((0, y, card_w, y), fill=(0, 0, 0, round(180 * y / 259)))
    canvas.alpha_composite(shade, (card_x, card_y + card_h - 260))
    draw = ImageDraw.Draw(canvas, "RGBA")
    draw.rectangle((card_x, card_y, card_x + card_w, card_y + card_h), outline=(210, 210, 210, 100), width=1)

    top_label = f"BALFDAR     /     PIÈCE {index + 1:02d}"
    draw_spaced(draw, (W * .08, H * .055), top_label, FONTS["tiny"], (220, 220, 220, 225), 2)
    draw.line((W * .08, H * .067, W * .92, H * .067), fill=(200, 200, 200, 70), width=1)

    copy_y = card_y + card_h + 54
    draw_spaced(draw, (W * .08, copy_y), "LA SÉLECTION", FONTS["tiny"], MUTED, 3)
    title = str(product["name"]).strip().upper()
    draw.text((W * .08, copy_y + 47), title, font=FONTS["title"], fill=SILVER)
    description = str(product.get("description", "")).strip()
    if description:
        draw.text((W * .08, copy_y + 145), description, font=FONTS["body"], fill=(205, 204, 202, 235))
    price = f"{int(product['priceMad']):,} MAD".replace(",", " ")
    draw.text((W * .08, copy_y + 211), price, font=FONTS["price"], fill=SILVER)
    draw.line((W * .08, H * .91, W * .92, H * .91), fill=(200, 200, 200, 65), width=1)
    draw.text((W * .08, H * .928), "CASABLANCA · MAROC", font=FONTS["tiny"], fill=MUTED)
    draw.text((W * .92, H * .928), f"{index + 1:02d} / {len(PRODUCTS):02d}", font=FONTS["tiny"], fill=MUTED, anchor="ra")
    return canvas.convert("RGB")


def outro(progress: float) -> Image.Image:
    canvas = make_background().convert("RGBA")
    draw = ImageDraw.Draw(canvas, "RGBA")
    # Real uploaded product photographs appear as a restrained, balanced diptych.
    thumb_w, thumb_h = round(W * .385), round(H * .32)
    gap = 24
    y = round(H * .19)
    x1 = (W - (thumb_w * 2 + gap)) // 2
    for i, photo in enumerate(PHOTOS[:2]):
        x = x1 + i * (thumb_w + gap)
        thumb = fit_cover(photo, (thumb_w, thumb_h), zoom=1.02 + .025 * progress, focus_y=.42).convert("RGBA")
        canvas.alpha_composite(thumb, (x, y))
        draw.rectangle((x, y, x + thumb_w, y + thumb_h), outline=(220, 220, 220, 110), width=1)
    draw = ImageDraw.Draw(canvas, "RGBA")
    draw_logo(canvas, (W * .25, H * .54, W * .50, H * .17))
    draw = ImageDraw.Draw(canvas, "RGBA")
    draw.line((W * .20, H * .74, W * .80, H * .74), fill=(190, 190, 190, 100), width=1)
    draw.text((W * .5, H * .785), "DÉCOUVRIR LA SÉLECTION", font=FONTS["cta"], fill=SILVER, anchor="mm")
    draw.text((W * .5, H * .835), "COMMANDER VIA WHATSAPP", font=FONTS["small"], fill=MUTED, anchor="mm")
    draw.text((W * .5, H * .88), CONFIG["contact"], font=FONTS["body"], fill=SILVER, anchor="mm")
    draw.text((W * .5, H * .94), CONFIG["brandLine"], font=FONTS["tiny"], fill=MUTED, anchor="mm")
    return canvas.convert("RGB")


def scene_at(time_seconds: float) -> tuple[str, int, float, float]:
    if time_seconds < INTRO:
        return "intro", -1, time_seconds / INTRO, INTRO
    t = time_seconds - INTRO
    for index in range(len(PRODUCTS)):
        if t < PRODUCT_DURATION:
            return "product", index, t / PRODUCT_DURATION, PRODUCT_DURATION
        t -= PRODUCT_DURATION
    return "outro", -1, min(1, t / OUTRO), OUTRO


def render_frame(time_seconds: float) -> Image.Image:
    kind, index, progress, scene_duration = scene_at(time_seconds)
    if kind == "intro":
        image = opening(progress)
    elif kind == "product":
        image = product_scene(index, progress)
    else:
        image = outro(progress)

    local_time = progress * scene_duration
    fade = min(1.0, local_time / TRANSITION, (scene_duration - local_time) / TRANSITION)
    if kind == "intro":
        fade = min(1.0, local_time / TRANSITION, 1.0)
    fade = max(0, min(1, fade))
    if fade < 1:
        image = Image.blend(Image.new("RGB", image.size, (0, 0, 0)), image, fade)
    return image


def synthesize_audio(path: Path) -> None:
    sample_rate = 44100
    frame_count = int(DURATION * sample_rate)
    # Original, synthesized ambient bed. No third-party music or sampled recording is used.
    chord_sets = [(110.00, 164.81, 220.00), (98.00, 146.83, 196.00), (130.81, 164.81, 196.00), (110.00, 164.81, 220.00)]
    with wave.open(str(path), "wb") as audio:
        audio.setnchannels(2)
        audio.setsampwidth(2)
        audio.setframerate(sample_rate)
        block = bytearray()
        for n in range(frame_count):
            t = n / sample_rate
            chord_index = min(len(chord_sets) - 1, int(t / DURATION * len(chord_sets)))
            fade_in = min(1.0, t / 1.8)
            fade_out = min(1.0, (DURATION - t) / 2.2)
            envelope = min(fade_in, fade_out)
            left = right = 0.0
            for j, frequency in enumerate(chord_sets[chord_index]):
                phase = t * frequency * math.tau
                gain = .09 / (j + 1)
                left += math.sin(phase + j * .13) * gain
                right += math.sin(phase + j * .19 + .025) * gain
            # A faint high harmonic gives the pad a soft metallic shimmer.
            left += .012 * math.sin(t * 659.25 * math.tau)
            right += .012 * math.sin(t * 659.25 * math.tau + .08)
            for value in (left * envelope, right * envelope):
                sample = max(-1, min(1, value))
                block.extend(int(sample * 32767).to_bytes(2, byteorder="little", signed=True))
            if len(block) >= sample_rate * 8:
                audio.writeframesraw(block)
                block.clear()
        if block:
            audio.writeframesraw(block)


def make_contact_sheet(samples: list[Image.Image], output: Path) -> None:
    cols, cell_w, cell_h, label_h = 3, 360, 640, 42
    rows = math.ceil(len(samples) / cols)
    sheet = Image.new("RGB", (cols * cell_w, rows * (cell_h + label_h)), (15, 15, 16))
    draw = ImageDraw.Draw(sheet)
    for index, sample in enumerate(samples):
        thumb = ImageOps.fit(sample, (cell_w, cell_h), method=Image.Resampling.LANCZOS)
        x, y = (index % cols) * cell_w, (index // cols) * (cell_h + label_h)
        sheet.paste(thumb, (x, y))
        draw.text((x + 12, y + cell_h + 10), f"FRAME {index + 1:02d}", font=FONTS["tiny"], fill=SILVER)
    sheet.save(output, quality=94)


def main() -> None:
    if not PRODUCTS:
        raise SystemExit("config.json needs at least one product.")
    missing = [product["image"] for product in PRODUCTS if not (ROOT / product["image"]).is_file()]
    if missing:
        raise SystemExit("Missing product images: " + ", ".join(missing))
    ffmpeg = os.environ.get("FFMPEG_PATH")
    if not ffmpeg or not Path(ffmpeg).is_file():
        raise SystemExit("FFmpeg is unavailable. Run npm install to install ffmpeg-static.")

    output_dir = ROOT / "output"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_mp4 = output_dir / "store_promo.mp4"
    total_frames = math.ceil(DURATION * FPS)
    sample_times = [0.7, INTRO + .7, INTRO + PRODUCT_DURATION + .7, INTRO + len(PRODUCTS) * PRODUCT_DURATION + .8, DURATION - .5]
    samples: list[Image.Image] = []

    with tempfile.TemporaryDirectory(prefix="balfdar-promo-") as temp_dir:
        audio_path = Path(temp_dir) / "original-ambient.wav"
        if VIDEO.get("music", True):
            synthesize_audio(audio_path)
        command = [ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo", "-pixel_format", "rgb24", "-video_size", f"{W}x{H}", "-framerate", str(FPS), "-i", "-"]
        if VIDEO.get("music", True):
            command += ["-i", str(audio_path)]
        command += ["-map", "0:v:0"]
        if VIDEO.get("music", True):
            command += ["-map", "1:a:0", "-c:a", "aac", "-b:a", "160k", "-shortest"]
        command += ["-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(output_mp4)]
        process = subprocess.Popen(command, stdin=subprocess.PIPE)
        assert process.stdin is not None
        try:
            for frame_index in range(total_frames):
                t = frame_index / FPS
                frame = render_frame(t)
                if any(abs(t - sample_time) < .5 / FPS for sample_time in sample_times):
                    samples.append(frame.copy())
                process.stdin.write(frame.tobytes())
                if frame_index % (FPS * 2) == 0:
                    print(f"Rendered {frame_index + 1}/{total_frames} frames", flush=True)
        finally:
            process.stdin.close()
        code = process.wait()
        if code:
            raise SystemExit(f"FFmpeg exited with code {code}.")

    make_contact_sheet(samples, output_dir / "contact_sheet.png")
    print(f"Video: {output_mp4}")
    print(f"Preview: {output_dir / 'contact_sheet.png'}")
    print(f"Duration: {DURATION:.2f}s · {W}x{H} · {FPS}fps")


if __name__ == "__main__":
    main()
