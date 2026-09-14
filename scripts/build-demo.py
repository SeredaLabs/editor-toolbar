#!/usr/bin/env python3
"""Assemble genuine UI captures into a captioned, infinitely looping GIF."""
import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def font(size, custom=None):
    candidates = [custom] if custom else [
        '/System/Library/Fonts/Supplemental/Arial.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        'C:/Windows/Fonts/arial.ttf',
    ]
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return ImageFont.truetype(str(candidate), size)
    raise ValueError('No suitable font found. Pass --font /absolute/path/to/font.ttf.')


def assemble(manifest_path, output, width=1100, font_path=None):
    manifest_path = Path(manifest_path).resolve()
    scenes = json.loads(manifest_path.read_text(encoding='utf-8'))
    if not isinstance(scenes, list) or not scenes:
        raise ValueError('The manifest must contain at least one captured frame.')
    frames, durations = [], []
    source_size = None
    title_font = font(24, font_path)
    caption_font = font(17, font_path)
    for scene in scenes:
        with Image.open(manifest_path.parent / scene['file']) as capture:
            capture.load()
            if source_size is None:
                source_size = capture.size
            if capture.size != source_size:
                raise ValueError('All captures must have the same window dimensions.')
            image = capture.convert('RGB')
        target_width = min(width, image.width)
        target_height = round(image.height * target_width / image.width)
        image = image.resize((target_width, target_height), Image.Resampling.LANCZOS)
        frame = Image.new('RGB', (target_width, target_height + 94), '#101722')
        frame.paste(image, (0, 0))
        draw = ImageDraw.Draw(frame)
        draw.rectangle((0, target_height, 5, frame.height), fill='#ff6b35')
        for text, face, y, color in [
            (scene.get('title', ''), title_font, target_height + 13, '#ffffff'),
            (scene.get('caption', ''), caption_font, target_height + 50, '#b8c3d3'),
        ]:
            if draw.textlength(text, font=face) > target_width - 48:
                raise ValueError(f'Caption is too long for the output width: {text}')
            draw.text((24, y), text, font=face, fill=color)
        duration = scene.get('duration_ms', 1500)
        if not isinstance(duration, int) or not 100 <= duration <= 10000:
            raise ValueError('Frame durations must be integer milliseconds between 100 and 10000.')
        frames.append(frame)
        durations.append(duration)

    # A shared palette keeps code and UI colors stable from frame to frame.
    swatches = Image.new('RGB', (256, 160 * len(frames)))
    for index, frame in enumerate(frames):
        swatches.paste(frame.resize((256, 160)), (0, index * 160))
    palette = swatches.quantize(colors=256)
    indexed = [frame.quantize(palette=palette, dither=Image.Dither.NONE) for frame in frames]
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    indexed[0].save(output, save_all=True, append_images=indexed[1:],
                    duration=durations, loop=0, optimize=True, disposal=2)
    frames[0].save(output.with_suffix('.png'), optimize=True)
    with Image.open(output) as gif:
        assert gif.info.get('loop') == 0, 'GIF must loop indefinitely.'
        total_ms = 0
        for index in range(gif.n_frames):
            gif.seek(index)
            gif.load()
            total_ms += gif.info.get('duration', 0)
        print(f'{output}: {gif.size[0]}x{gif.size[1]}, {gif.n_frames} frames, '
              f'{total_ms / 1000:.1f}s, {output.stat().st_size / 1024:.0f} KiB, infinite loop')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest')
    parser.add_argument('output')
    parser.add_argument('--width', type=int, default=1100)
    parser.add_argument('--font')
    args = parser.parse_args()
    if args.width < 480:
        parser.error('--width must be at least 480 pixels for readable captions')
    assemble(args.manifest, args.output, args.width, args.font)
