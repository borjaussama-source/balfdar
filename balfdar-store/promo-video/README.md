# BALFDAR Store Promo Video

This is a small, reusable renderer for an editorial-style BALFDAR product promo. It uses the two currently published Store catalog entries, their exact uploaded photographs, prices, and the Store logo/contact details. The photos are not generated or retouched. The first frame is cropped in the layout to focus the clothing and keep the old wordmark embedded in that source photo out of frame.

The supplied reference clip (`/mnt/data/1000206599.mp4`) was not present on this computer or elsewhere on the Desktop, so its pacing, aspect ratio, typography, transitions, audio, and resolution could not be analyzed. This first render uses the Store's own black-and-silver visual identity and a configurable 9:16, 1080x1920, 24 fps format for mobile social platforms. Its quiet ambient soundtrack is synthesized specifically by the included code; it uses no sampled or third-party music.

## Requirements

- Node.js 20+ and npm
- Python 3.10+
- Pillow (`python -m pip install -r requirements.txt`)
- FFmpeg is installed locally by `ffmpeg-static` when npm installs this project

## Render

```powershell
npm install
python -m pip install -r requirements.txt
npm run render
```

On Windows, if `python` does not resolve to Python 3, set `PYTHON` to the Python 3 executable before running `npm run render`:

```powershell
$env:PYTHON = "C:\path\to\python.exe"
npm run render
```

The finished MP4 and contact sheet are written to `output/store_promo.mp4` and `output/contact_sheet.png`.

## Update the video

Edit `config.json` to change the brand text, contact, framing, timing, resolution, frame rate, audio toggle, or products. Each product entry uses `name`, `description`, `priceMad`, `image`, and optional `cropTop`. Put replacement photographs under `assets/products/` and set their paths in the config. To add or remove product scenes, add or remove entries from the `products` array. No database connection is needed for rendering; the checked-in config is a snapshot of the real Store catalog at creation time.

For a version matched to the requested reference, place the video at `reference/1000206599.mp4` and update this project after it is available.
