"""
Pure Python floor plan renderer. No Blender, no 3D — just clean 2D vector rendering.
Outputs high-resolution PNG floor plan images from room/wall coordinates.
"""
import subprocess, os, sys

# ── Room definitions (from Blender scene export) ──
# Each room: (x1, y1, x2, y2, color, label)
# Building is 11m x 9m

ROOM_COLORS = {
    'Living':       '#F2C899',  # Warm peach
    'Dining':       '#E6B88E',  # Warm tan
    'Kitchen':      '#DBD1BD',  # Light warm
    'Hall':         '#E0DCD5',  # Light neutral
    'Entrance':     '#D4CDBF',  # Warm taupe
    'Powder':       '#D6DED4',  # Sage green tint
}

FLOORS = {
    'B2': {
        'rooms': [
            ('Storage',     (0, 0, 6, 5), '#E0E0E0'),
            ('Media',       (0, 5, 6, 9), '#A8A8B3'),
            ('Mech',        (6, 6, 11, 9), '#D0D0D0'),
        ],
    },
    'B1': {
        'rooms': [
            ('Tea Room',    (0, 0, 6, 5), '#CCB38D'),
            ('Bar',         (6, 0, 11, 5), '#B39973'),
            ('Storage',     (6, 5, 11, 9), '#E0E0E0'),
        ],
    },
    '1F': {
        'rooms': [
            ('Living Room', (0, 0, 6, 5), '#F2C899'),
            ('Dining Room', (0, 5, 6, 9), '#E6B88E'),
            ('Kitchen',     (6, 5, 11, 9), '#DBD1BD'),
            ('Hallway',     (6, 0, 8, 5), '#E0DCD5'),
            ('Entrance',    (8, 0, 11, 7), '#D4CDBF'),
            ('Powder Room', (6, 7, 8, 9), '#D6DED4'),
        ],
        'walls': [
            # Exterior
            ((0, 0), (11, 0)),    # South
            ((0, 0), (0, 9)),     # West
            ((0, 9), (11, 9)),    # North
            ((11, 0), (11, 7)),   # East lower
            ((11, 7), (11, 9)),   # East upper
            # Interior
            ((6, 5), (11, 5)),    # Kitchen/Dining divider
            ((6, 5), (6, 9)),     # Kitchen west wall
            ((6, 7), (8, 7)),     # Powder south wall
            ((8, 7), (8, 9)),     # Powder east wall
        ],
    },
    '2F': {
        'rooms': [
            ('Bedroom 1',   (0, 0, 5, 9), '#C8D6E5'),
            ('Bedroom 2',   (5, 0, 11, 5), '#C8D6E5'),
            ('Bathroom',    (5, 5, 8, 9), '#C8E0D4'),
            ('Hallway',     (8, 5, 11, 9), '#E0DCD5'),
        ],
        'walls': [
            ((0, 0), (11, 0)),
            ((0, 0), (0, 9)),
            ((0, 9), (11, 9)),
            ((11, 0), (11, 9)),
            ((5, 0), (5, 9)),
            ((5, 5), (11, 5)),
            ((8, 5), (8, 9)),
        ],
    },
    '3F': {
        'rooms': [
            ('Master Bed',  (0, 0, 6, 5), '#F2C899'),
            ('Walk-in',     (6, 0, 9, 5), '#E6B88E'),
            ('Master Bath', (6, 5, 9, 9), '#C8E0D4'),
            ('Laundry',     (0, 5, 3, 9), '#D4CDBF'),
            ('Hallway',     (3, 5, 6, 9), '#E0DCD5'),
        ],
        'walls': [
            ((0, 0), (11, 0)),
            ((0, 0), (0, 9)),
            ((0, 9), (11, 9)),
            ((11, 0), (11, 9)),
            ((6, 0), (6, 9)),
            ((6, 5), (11, 5)),
            ((0, 5), (6, 5)),
            ((3, 5), (3, 9)),
        ],
    },
}

FLOOR_LABELS = {
    'B2': 'B2 · 储物 &amp; 影音预留',
    'B1': 'B1 · 茶室 &amp; 吧台区',
    '1F': '1F · 客餐厅 &amp; 厨房',
    '2F': '2F · 次卧 &amp; 次卫',
    '3F': '3F · 主卧套房',
}


def render_svg(floor_key, output_path, width=2560, height=1440):
    """Render a single floor as SVG, then convert to PNG."""
    floor = FLOORS[floor_key]
    rooms = floor['rooms']
    walls = floor.get('walls', [])
    label = FLOOR_LABELS.get(floor_key, floor_key)

    # SVG coordinate system: flip Y so +Y goes up (architectural convention)
    # Building: 11m x 9m, SVG viewBox with padding
    margin = 1.0
    vb_x = -margin
    vb_y = -margin
    vb_w = 11 + 2 * margin
    vb_h = 9 + 2 * margin

    # Scale: fit 11m x 9m into width/height maintaining aspect ratio
    scale = min(width / vb_w, height / vb_h)
    svg_w = vb_w * scale
    svg_h = vb_h * scale
    offset_x = (width - svg_w) / 2
    offset_y = (height - svg_h) / 2

    def transform(x, y):
        """Convert building coords (0-11, 0-9) to SVG pixels. Y-axis is FLIPPED."""
        sx = offset_x + (x - vb_x) * scale
        sy = offset_y + (vb_h - (y - vb_y)) * scale  # flip Y
        return sx, sy

    lines = []
    lines.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}">')

    # Background
    lines.append(f'<rect width="{width}" height="{height}" fill="#FAFAFA"/>')

    # Building outline (shadow/ground)
    bx1, by1 = transform(0, 0)
    bx2, by2 = transform(11, 9)
    lines.append(f'<rect x="{min(bx1,bx2)}" y="{min(by1,by2)}" '
                 f'width="{abs(bx2-bx1)}" height="{abs(by2-by1)}" '
                 f'fill="#f0ece5" stroke="none"/>')

    # Rooms
    for name, (x1, y1, x2, y2), color in rooms:
        sx1, sy1 = transform(x1, y1)
        sx2, sy2 = transform(x2, y2)
        rx, ry = min(sx1, sx2), min(sy1, sy2)
        rw, rh = abs(sx2 - sx1), abs(sy2 - sy1)
        lines.append(f'<rect x="{rx:.1f}" y="{ry:.1f}" width="{rw:.1f}" height="{rh:.1f}" '
                     f'fill="{color}" stroke="#c0b8a8" stroke-width="1.5" rx="3"/>')

        # Room label
        cx = rx + rw / 2
        cy = ry + rh / 2
        font_size = min(rw, rh) * 0.13
        font_size = max(16, min(font_size, 36))
        lines.append(f'<text x="{cx:.1f}" y="{cy:.1f}" '
                     f'text-anchor="middle" dominant-baseline="central" '
                     f'font-family="system-ui, sans-serif" font-size="{font_size:.0f}" '
                     f'fill="#666" font-weight="500">{name}</text>')

    # Walls (thick dark lines)
    for (x1, y1), (x2, y2) in walls:
        sx1, sy1 = transform(x1, y1)
        sx2, sy2 = transform(x2, y2)
        lines.append(f'<line x1="{sx1:.1f}" y1="{sy1:.1f}" x2="{sx2:.1f}" y2="{sy2:.1f}" '
                     f'stroke="#444" stroke-width="4" stroke-linecap="round"/>')

    # Title
    title_y = 40
    lines.append(f'<text x="{width/2:.0f}" y="{title_y:.0f}" '
                 f'text-anchor="middle" font-family="system-ui, sans-serif" '
                 f'font-size="22" fill="#888" font-weight="400">{label}</text>')

    # Floor number badge
    badge_y = height - 50
    lines.append(f'<text x="{width/2:.0f}" y="{badge_y:.0f}" '
                 f'text-anchor="middle" font-family="system-ui, sans-serif" '
                 f'font-size="16" fill="#bbb">{floor_key}</text>')

    lines.append('</svg>')
    svg_content = '\n'.join(lines)

    # Write SVG
    svg_path = output_path.replace('.png', '.svg')
    with open(svg_path, 'w') as f:
        f.write(svg_content)

    # Convert SVG to PNG using sips (macOS) or rsvg-convert
    try:
        subprocess.run(
            ['sips', '-s', 'format', 'png', svg_path, '--out', output_path],
            check=True, capture_output=True, timeout=15
        )
    except Exception:
        # Try rsvg-convert
        try:
            subprocess.run(
                ['rsvg-convert', '-w', str(width), '-h', str(height),
                 '-o', output_path, svg_path],
                check=True, capture_output=True, timeout=15
            )
        except Exception:
            # Try qlmanage (macOS) or just keep SVG
            print(f"WARN: Could not convert SVG to PNG. SVG saved at {svg_path}")
            return svg_path

    return output_path


def render_all(output_dir, width=2560, height=1440):
    """Render all 5 floors."""
    results = {}
    for floor_key in ['B2', 'B1', '1F', '2F', '3F']:
        out = os.path.join(output_dir, f'{floor_key}_3d_render.png')
        result = render_svg(floor_key, out, width, height)
        results[floor_key] = result
        print(f"  {floor_key} → {result}")
    return results


if __name__ == '__main__':
    output_dir = sys.argv[1] if len(sys.argv) > 1 else '/tmp'
    render_all(output_dir)
