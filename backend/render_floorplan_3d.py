"""
Standalone Blender 3D floor plan renderer.
Run from command line:
    blender -b villa_render_ready.blend -P render_floorplan_3d.py -- --floor 1F --output /path/to/output.png

Or render all floors:
    blender -b villa_render_ready.blend -P render_floorplan_3d.py -- --all --output-dir /path/to/dir
"""
import bpy
import sys
import os
import argparse

# ============================================================
# Floor group definitions (which objects belong to each floor)
# ============================================================
FLOOR_GROUPS = {
    'B2': {'slab': 'Slab_B2', 'floor_prefixes': ['B2_'], 'wall_prefixes': ['ExtWall_B2', 'IntWall_B2']},
    'B1': {'slab': 'Slab_B1', 'floor_prefixes': ['B1_'], 'wall_prefixes': ['ExtWall_B1', 'IntWall_B1']},
    '1F': {'slab': 'Slab_1F', 'floor_prefixes': ['Floor_'], 'wall_prefixes': ['Wall_1F']},
    '2F': {'slab': 'Slab_2F', 'floor_prefixes': ['2F_'], 'wall_prefixes': ['ExtWall_2F', 'IntWall_2F']},
    '3F': {'slab': 'Slab_3F', 'floor_prefixes': ['3F_'], 'wall_prefixes': ['ExtWall_3F']},
}


def obj_matches_prefixes(obj, prefixes):
    for p in prefixes:
        if obj.name.startswith(p):
            return True
    return False


def configure_scene():
    """Apply all render settings for clean architectural floor plan output."""
    scene = bpy.context.scene

    # Color management: Standard = linear, no S-curve
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    scene.view_settings.exposure = 0.0
    scene.view_settings.gamma = 1.0
    scene.display_settings.display_device = 'sRGB'

    # World: near-black background to avoid washing out emission colors
    world = scene.world
    if not world:
        world = bpy.data.worlds.new("World")
        scene.world = world
    world.use_nodes = True
    nodes = world.node_tree.nodes
    links = world.node_tree.links
    nodes.clear()
    bg_node = nodes.new(type='ShaderNodeBackground')
    bg_node.inputs['Color'].default_value = (0.05, 0.05, 0.05, 1.0)
    bg_node.inputs['Strength'].default_value = 0.3
    output_node = nodes.new(type='ShaderNodeOutputWorld')
    links.new(bg_node.outputs['Background'], output_node.inputs['Surface'])

    # Render engine
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'GPU'
    scene.cycles.samples = 64
    scene.cycles.use_denoising = True
    scene.cycles.use_adaptive_sampling = True
    scene.render.film_transparent = False

    # Output settings
    scene.render.resolution_x = 2560
    scene.render.resolution_y = 1440
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGB'
    scene.render.image_settings.color_depth = '8'
    scene.render.image_settings.compression = 15
    scene.render.use_overwrite = True

    # Hide any lights (emission-only rendering)
    for obj in bpy.data.objects:
        if obj.type == 'LIGHT':
            obj.hide_render = True

    # Camera ortho scale
    cam = scene.camera
    if cam and cam.data and cam.data.type == 'ORTHO':
        cam.data.ortho_scale = 11.5


def render_floor(floor_key, output_path):
    """Show only objects for a specific floor and render to PNG."""
    group = FLOOR_GROUPS[floor_key]
    scene = bpy.context.scene

    # Hide all mesh objects from render
    for obj in bpy.data.objects:
        if obj.type == 'MESH':
            obj.hide_render = True

    # Show only this floor's objects
    visible = 0
    for obj in bpy.data.objects:
        if obj.type != 'MESH':
            continue
        show = (obj.name == group['slab'] or
                obj_matches_prefixes(obj, group['floor_prefixes']) or
                obj_matches_prefixes(obj, group['wall_prefixes']))
        if show:
            obj.hide_render = False
            visible += 1

    scene.render.filepath = output_path
    bpy.ops.render.render(write_still=True)

    if os.path.exists(output_path):
        print(f"RENDERED: {floor_key} ({visible} objects) → {output_path} ({os.path.getsize(output_path)//1024} KB)")
    else:
        print(f"FAILED: {floor_key} → {output_path} (file not created)")
        return None
    return output_path


def render_all(output_dir):
    """Render all 5 floors."""
    os.makedirs(output_dir, exist_ok=True)
    results = {}
    for floor in ['B2', 'B1', '1F', '2F', '3F']:
        path = os.path.join(output_dir, f'{floor}_3d_render.png')
        results[floor] = render_floor(floor, path)
    return results


# ============================================================
# CLI entry point
# ============================================================
if __name__ == '__main__':
    # Parse args after '--'
    argv = sys.argv
    if '--' in argv:
        argv = argv[argv.index('--') + 1:]
    else:
        argv = []

    parser = argparse.ArgumentParser(description='Render 3D floor plans from Blender')
    parser.add_argument('--floor', choices=['B2', 'B1', '1F', '2F', '3F'],
                        help='Render a single floor')
    parser.add_argument('--all', action='store_true', help='Render all 5 floors')
    parser.add_argument('--output', help='Output path (for single floor)')
    parser.add_argument('--output-dir', default='/tmp/floorplans',
                        help='Output directory (for --all)')
    parser.add_argument('--samples', type=int, default=64,
                        help='Cycles render samples (default: 64)')

    args = parser.parse_args(argv)

    # Configure scene first
    configure_scene()

    # Override samples if specified
    if args.samples != 64:
        bpy.context.scene.cycles.samples = args.samples

    if args.all:
        results = render_all(args.output_dir)
        print(f"\nDone. {len([r for r in results.values() if r])}/5 floors rendered.")
    elif args.floor:
        output = args.output or f'/tmp/{args.floor}_3d_render.png'
        render_floor(args.floor, output)
    else:
        # Default: render all to working directory
        print("No floor specified. Rendering all floors to default location...")
        render_all('/tmp/floorplans')
