"""Logo variants for the interface.

Logos are normally drawn for white paper and often stack the emblem above the
company name, which does not fit a slim sidebar band. From the uploaded file this
builds, once, and caches next to the original:

* a dark-mode copy (white background lifted out, dark ink brightened),
* a ``mark`` - just the emblem, for the collapsed sidebar,
* a ``wide`` lockup - emblem on the left, name on the right, for the sidebar header.

Each exists in a light and a dark colouring. Everything is rebuilt whenever the
logo file changes. Printing and documents keep using the original upload.
"""

from pathlib import Path

from django.conf import settings
from PIL import Image

MAX_WIDTH = 700
LOCKUP_HEIGHT = 180
INK_THRESHOLD = 40


def _recolour(image: Image.Image, dark: bool) -> Image.Image:
    """Lift the white paper out of the logo; for dark mode also brighten the dark ink."""
    pixels = []
    for red, green, blue, alpha in image.getdata():
        # Treat transparency as white paper, then recover the ink colour and its opacity.
        red = (red * alpha + 255 * (255 - alpha)) // 255
        green = (green * alpha + 255 * (255 - alpha)) // 255
        blue = (blue * alpha + 255 * (255 - alpha)) // 255
        opacity = 255 - min(red, green, blue)
        if opacity < 6:
            pixels.append((0, 0, 0, 0))
            continue
        scale = 255 / opacity
        ink = [min(255, max(0, round(255 - (255 - channel) * scale))) for channel in (red, green, blue)]
        if dark:
            luma = 0.299 * ink[0] + 0.587 * ink[1] + 0.114 * ink[2]
            lift = 0.62 * max(0.0, 1 - luma / 150)
            ink = [round(channel + (255 - channel) * lift) for channel in ink]
        pixels.append((ink[0], ink[1], ink[2], opacity))
    out = Image.new("RGBA", image.size)
    out.putdata(pixels)
    return out


def _trim(image: Image.Image) -> Image.Image:
    box = image.getchannel("A").point(lambda value: 255 if value > INK_THRESHOLD else 0).getbbox()
    return image.crop(box) if box else image


def _row_bands(image: Image.Image) -> list[tuple[int, int]]:
    """Vertical runs of rows that hold ink, split wherever there is a clear blank gap."""
    alpha = image.getchannel("A").point(lambda value: 255 if value > INK_THRESHOLD else 0)
    width, height = image.size
    inked = [alpha.crop((0, y, width, y + 1)).getbbox() is not None for y in range(height)]
    min_gap = max(3, round(height * 0.02))
    bands: list[tuple[int, int]] = []
    start = None
    blank = 0
    for y, has_ink in enumerate(inked):
        if has_ink:
            if start is None:
                start = y
            blank = 0
        elif start is not None:
            blank += 1
            if blank >= min_gap:
                bands.append((start, y - blank + 1))
                start = None
                blank = 0
    if start is not None:
        bands.append((start, height - blank))
    return bands


def _fit_height(image: Image.Image, height: int) -> Image.Image:
    width = max(1, round(image.width * height / image.height))
    return image.resize((width, height), Image.LANCZOS)


def _mark_and_wide(coloured: Image.Image) -> tuple[Image.Image, Image.Image]:
    whole = _trim(coloured)
    bands = _row_bands(coloured)
    stacked = len(bands) >= 2 and whole.width / whole.height < 1.6
    if not stacked:
        # Already a horizontal logo (or a bare emblem): use it as it is.
        return _fit_height(whole, LOCKUP_HEIGHT), _fit_height(whole, LOCKUP_HEIGHT)

    top = _trim(coloured.crop((0, bands[0][0], coloured.width, bands[0][1])))
    name = _trim(coloured.crop((0, bands[1][0], coloured.width, bands[-1][1])))
    mark = _fit_height(top, LOCKUP_HEIGHT)

    # The name sits beside the emblem, a little shorter than it, and centred on it.
    name = _fit_height(name, round(LOCKUP_HEIGHT * 0.58))
    gap = round(LOCKUP_HEIGHT * 0.16)
    wide = Image.new("RGBA", (mark.width + gap + name.width, LOCKUP_HEIGHT), (0, 0, 0, 0))
    wide.paste(mark, (0, 0))
    wide.paste(name, (mark.width + gap, (LOCKUP_HEIGHT - name.height) // 2))
    return mark, wide


def _build(source: Path, folder: Path, stem: str) -> None:
    image = Image.open(source).convert("RGBA")
    if image.width > MAX_WIDTH:
        image = image.resize((MAX_WIDTH, round(image.height * MAX_WIDTH / image.width)), Image.LANCZOS)
    folder.mkdir(parents=True, exist_ok=True)
    for dark, suffix in ((False, ""), (True, "-dark")):
        coloured = _recolour(image, dark)
        if dark:
            coloured.save(folder / f"{stem}-dark.png", "PNG", optimize=True)
        mark, wide = _mark_and_wide(coloured)
        mark.save(folder / f"{stem}-mark{suffix}.png", "PNG", optimize=True)
        wide.save(folder / f"{stem}-wide{suffix}.png", "PNG", optimize=True)


def logo_variants(profile) -> dict[str, str]:
    """URLs of the generated logo variants, or empty strings when there is no usable logo."""
    keys = {
        "logo_dark_url": "-dark",
        "logo_mark_url": "-mark",
        "logo_mark_dark_url": "-mark-dark",
        "logo_wide_url": "-wide",
        "logo_wide_dark_url": "-wide-dark",
    }
    empty = {key: "" for key in keys}
    if not profile.logo:
        return empty
    try:
        source = Path(profile.logo.path)
    except (ValueError, NotImplementedError):
        return empty
    if not source.is_file():
        return empty

    folder = Path(settings.MEDIA_ROOT) / "company" / "dark"
    stem = source.stem
    marker = folder / f"{stem}-wide-dark.png"
    if not marker.is_file() or marker.stat().st_mtime < source.stat().st_mtime:
        try:
            _build(source, folder, stem)
        except OSError:
            return empty

    from catalog.media_urls import browser_media_url

    result = {}
    for key, suffix in keys.items():
        url = f"{settings.MEDIA_URL}company/dark/{stem}{suffix}.png"
        result[key] = browser_media_url(url)
    return result


def warm_logo_variants(profile) -> None:
    """Pre-generate sidebar/dark logo files after a new logo is uploaded."""
    logo_variants(profile)
