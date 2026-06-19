"""3D 楼层平面图 + 家具摆放 API"""
import json
import os
import shutil
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from ..database import engine, Base, get_db
from ..models.models import FloorPlan, FurniturePlacement
from ..logging_config import get_logger

router = APIRouter(prefix="/api/floorplan", tags=["floorplan"])
logger = get_logger("house_design.floorplan")

# 确保新表存在
FloorPlan.__table__.create(bind=engine, checkfirst=True)
FurniturePlacement.__table__.create(bind=engine, checkfirst=True)

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "floorplans")
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ══════════════ 楼层平面图 ══════════════

@router.get("/floors")
def list_floors():
    """获取所有楼层平面图"""
    db: Session = next(get_db())
    try:
        floors = db.query(FloorPlan).all()
        return [
            {
                "id": f.id,
                "floor": f.floor,
                "image_path": f.image_path,
                "width_m": f.width_m,
                "depth_m": f.depth_m,
                "description": f.description,
            }
            for f in floors
        ]
    finally:
        db.close()


@router.get("/floors/{floor}")
def get_floor(floor: str):
    """获取单个楼层平面图"""
    db: Session = next(get_db())
    try:
        f = db.query(FloorPlan).filter(FloorPlan.floor == floor).first()
        if not f:
            return {
                "floor": floor,
                "image_path": None,
                "width_m": 10,
                "depth_m": 8,
                "description": "",
            }
        return {
            "id": f.id,
            "floor": f.floor,
            "image_path": f.image_path,
            "width_m": f.width_m,
            "depth_m": f.depth_m,
            "description": f.description,
        }
    finally:
        db.close()


@router.post("/floors/{floor}")
async def upsert_floor(
    floor: str,
    image: UploadFile = File(None),
    width_m: float = Form(10),
    depth_m: float = Form(8),
    description: str = Form(""),
):
    """上传/更新楼层平面图"""
    db: Session = next(get_db())
    try:
        f = db.query(FloorPlan).filter(FloorPlan.floor == floor).first()
        image_path = f.image_path if f else None

        if image and image.filename:
            ext = os.path.splitext(image.filename)[1] or ".jpg"
            filename = f"{floor}_plan{ext}"
            filepath = os.path.join(UPLOAD_DIR, filename)
            with open(filepath, "wb") as buf:
                shutil.copyfileobj(image.file, buf)
            image_path = f"/api/floorplan/image/{floor}"
            logger.info("Floor plan image uploaded", extra={"extra": {"floor": floor, "size_bytes": image.size if image else 0}})

        if f:
            f.width_m = width_m
            f.depth_m = depth_m
            f.description = description
            if image_path:
                f.image_path = image_path
        else:
            f = FloorPlan(
                floor=floor,
                image_path=image_path or "",
                width_m=width_m,
                depth_m=depth_m,
                description=description,
            )
            db.add(f)

        db.commit()
        db.refresh(f)
        logger.info("Floor plan saved", extra={"extra": {"floor": floor, "action": "update" if f.id else "create"}})
        return {"id": f.id, "floor": f.floor, "message": "ok"}
    finally:
        db.close()


@router.get("/image/{floor}")
def get_floor_image(floor: str):
    """返回楼层平面图图片"""
    from fastapi.responses import FileResponse

    db: Session = next(get_db())
    try:
        f = db.query(FloorPlan).filter(FloorPlan.floor == floor).first()
        if not f or not f.image_path:
            raise HTTPException(404, "No image for this floor")

        filepath = os.path.join(UPLOAD_DIR, f"{floor}_plan.jpg")
        # 尝试各种扩展名
        for ext in [".jpg", ".png", ".jpeg", ".webp"]:
            p = os.path.join(UPLOAD_DIR, f"{floor}_plan{ext}")
            if os.path.exists(p):
                return FileResponse(p)

        raise HTTPException(404, "Image file not found")
    finally:
        db.close()


@router.get("/render/full")
def get_full_render():
    """返回完整别墅 3D 渲染图"""
    from fastapi.responses import FileResponse

    filepath = os.path.join(UPLOAD_DIR, "villa_3d_render.png")
    if os.path.exists(filepath):
        logger.info("Serving full 3D render", extra={"extra": {"size_bytes": os.path.getsize(filepath)}})
        return FileResponse(filepath)
    logger.warning("Full render not found", extra={"extra": {"path": filepath}})
    raise HTTPException(404, "Full render not found")


@router.get("/render/{floor}")
def get_floor_render(floor: str):
    """返回 Blender 3D 渲染俯视图"""
    from fastapi.responses import FileResponse

    filepath = os.path.join(UPLOAD_DIR, f"{floor}_3d_render.png")
    if os.path.exists(filepath):
        logger.info("Serving floor 3D render", extra={"extra": {"floor": floor, "size_bytes": os.path.getsize(filepath)}})
        return FileResponse(filepath)
    logger.warning("Floor render not found", extra={"extra": {"floor": floor}})
    raise HTTPException(404, f"3D render not found for floor: {floor}")


# ══════════════ 家具摆放 ══════════════

# 家具类型预设（包含默认尺寸和可选样式）
FURNITURE_PRESETS = {
    "沙发": {
        "sizes": {"小": (1.8, 0.9, 0.85), "中": (2.4, 1.0, 0.85), "大": (3.2, 1.1, 0.9)},
        "styles": ["default", "modern", "classic", "minimal"],
        "colors": {"default": "#8B7355", "modern": "#4A4A4A", "classic": "#6B3A2E", "minimal": "#D4C5B9"},
    },
    "床": {
        "sizes": {"单人": (1.2, 2.0, 0.5), "双人": (1.8, 2.0, 0.5), "大床": (2.0, 2.2, 0.55)},
        "styles": ["default", "modern", "classic", "minimal"],
        "colors": {"default": "#8B7355", "modern": "#4A4A4A", "classic": "#6B3A2E", "minimal": "#D4C5B9"},
    },
    "餐桌": {
        "sizes": {"小(4人)": (1.2, 0.8, 0.75), "中(6人)": (1.6, 0.9, 0.75), "大(8人)": (2.0, 1.0, 0.75)},
        "styles": ["default", "modern", "classic", "minimal"],
        "colors": {"default": "#8B7355", "modern": "#4A4A4A", "classic": "#6B3A2E", "minimal": "#D4C5B9"},
    },
    "椅子": {
        "sizes": {"标准": (0.45, 0.5, 0.9)},
        "styles": ["default", "modern", "classic", "minimal"],
        "colors": {"default": "#8B7355", "modern": "#4A4A4A", "classic": "#6B3A2E", "minimal": "#D4C5B9"},
    },
    "茶几": {
        "sizes": {"小": (0.8, 0.8, 0.45), "中": (1.2, 0.7, 0.45), "大": (1.4, 0.8, 0.45)},
        "styles": ["default", "modern", "classic", "minimal"],
        "colors": {"default": "#8B7355", "modern": "#4A4A4A", "classic": "#6B3A2E", "minimal": "#D4C5B9"},
    },
    "书桌": {
        "sizes": {"小": (1.0, 0.6, 0.75), "中": (1.4, 0.7, 0.75), "大": (1.8, 0.8, 0.75)},
        "styles": ["default", "modern", "classic", "minimal"],
        "colors": {"default": "#8B7355", "modern": "#4A4A4A", "classic": "#6B3A2E", "minimal": "#D4C5B9"},
    },
    "衣柜": {
        "sizes": {"小": (1.2, 0.6, 2.2), "中": (1.8, 0.6, 2.2), "大": (2.4, 0.65, 2.4)},
        "styles": ["default", "modern", "classic", "minimal"],
        "colors": {"default": "#C4A882", "modern": "#E8E8E8", "classic": "#8B6914", "minimal": "#F5F5F0"},
    },
    "冰箱": {
        "sizes": {"小": (0.6, 0.65, 1.8), "中": (0.8, 0.75, 1.85), "大": (0.9, 0.8, 1.9)},
        "styles": ["default", "stainless", "black"],
        "colors": {"default": "#D4D4D4", "stainless": "#C0C0C0", "black": "#2D2D2D"},
    },
    "洗衣机": {
        "sizes": {"标准": (0.6, 0.65, 0.85)},
        "styles": ["default", "white", "silver"],
        "colors": {"default": "#E8E8E8", "white": "#FFFFFF", "silver": "#C0C0C0"},
    },
    "电视": {
        "sizes": {"小(55寸)": (1.23, 0.08, 0.71), "中(65寸)": (1.45, 0.08, 0.83), "大(75寸)": (1.68, 0.08, 0.96)},
        "styles": ["default", "black", "silver"],
        "colors": {"default": "#1A1A1A", "black": "#0D0D0D", "silver": "#C0C0C0"},
    },
    "空调": {
        "sizes": {"壁挂": (0.8, 0.2, 0.3), "柜机": (0.5, 0.45, 1.8)},
        "styles": ["default", "white"],
        "colors": {"default": "#F0F0F0", "white": "#FFFFFF"},
    },
    "烤箱": {
        "sizes": {"标准": (0.6, 0.55, 0.6)},
        "styles": ["default", "stainless", "black"],
        "colors": {"default": "#D4D4D4", "stainless": "#C0C0C0", "black": "#2D2D2D"},
    },
    "洗碗机": {
        "sizes": {"标准": (0.6, 0.6, 0.85)},
        "styles": ["default", "stainless", "white"],
        "colors": {"default": "#D4D4D4", "stainless": "#C0C0C0", "white": "#FFFFFF"},
    },
    "浴缸": {
        "sizes": {"小": (1.4, 0.8, 0.6), "中": (1.6, 0.8, 0.6), "大": (1.8, 0.9, 0.65)},
        "styles": ["default", "white", "modern"],
        "colors": {"default": "#F5F5F5", "white": "#FFFFFF", "modern": "#E8E8E8"},
    },
    "马桶": {
        "sizes": {"标准": (0.4, 0.7, 0.45)},
        "styles": ["default", "white", "modern"],
        "colors": {"default": "#F5F5F5", "white": "#FFFFFF", "modern": "#F0F0F0"},
    },
    "淋浴房": {
        "sizes": {"小": (0.9, 0.9, 2.1), "中": (1.0, 1.0, 2.1), "大": (1.2, 1.0, 2.1)},
        "styles": ["default", "clear", "frosted"],
        "colors": {"default": "rgba(200,220,240,0.3)", "clear": "rgba(180,210,240,0.25)", "frosted": "rgba(220,230,240,0.4)"},
    },
    "橱柜": {
        "sizes": {"小": (1.5, 0.6, 0.85), "中": (2.4, 0.6, 0.85), "大": (3.0, 0.6, 0.9)},
        "styles": ["default", "modern", "classic"],
        "colors": {"default": "#C4A882", "modern": "#E8E8E8", "classic": "#8B6914"},
    },
    "植物": {
        "sizes": {"小": (0.3, 0.3, 0.6), "中": (0.5, 0.5, 1.2), "大": (0.7, 0.7, 1.8)},
        "styles": ["default", "tropical", "bonsai"],
        "colors": {"default": "#2D5A27", "tropical": "#3E8E41", "bonsai": "#1B4D3E"},
    },
    "地毯": {
        "sizes": {"小": (1.2, 0.8, 0.02), "中": (2.0, 1.4, 0.02), "大": (2.5, 1.8, 0.02)},
        "styles": ["default", "persian", "modern"],
        "colors": {"default": "#BE8575", "persian": "#8B2500", "modern": "#A0A0A0"},
    },
    "灯": {
        "sizes": {"吊灯": (0.5, 0.5, 0.3), "落地灯": (0.3, 0.3, 1.6)},
        "styles": ["default", "modern", "crystal"],
        "colors": {"default": "#FFD700", "modern": "#C0C0C0", "crystal": "rgba(255,255,255,0.6)"},
    },
}


@router.get("/presets")
def get_furniture_presets():
    """获取家具预设（类型+尺寸+样式）"""
    return FURNITURE_PRESETS


@router.get("/furniture/{floor}")
def list_furniture(floor: str):
    """获取某楼层的所有家具摆放"""
    db: Session = next(get_db())
    try:
        items = db.query(FurniturePlacement).filter(
            FurniturePlacement.floor == floor
        ).all()
        return [
            {
                "id": p.id,
                "floor": p.floor,
                "furniture_type": p.furniture_type,
                "style": p.style,
                "label": p.label,
                "pos_x": p.pos_x,
                "pos_y": p.pos_y,
                "pos_z": p.pos_z,
                "rot_y": p.rot_y,
                "scale_x": p.scale_x,
                "scale_y": p.scale_y,
                "scale_z": p.scale_z,
                "custom_width": p.custom_width,
                "custom_depth": p.custom_depth,
                "custom_height": p.custom_height,
            }
            for p in items
        ]
    finally:
        db.close()


@router.post("/furniture/{floor}")
def add_furniture(floor: str, data: dict):
    """添加家具到某楼层"""
    db: Session = next(get_db())
    try:
        p = FurniturePlacement(
            floor=floor,
            furniture_type=data["furniture_type"],
            style=data.get("style", "default"),
            label=data.get("label", ""),
            pos_x=data.get("pos_x", 0),
            pos_y=data.get("pos_y", 0),
            pos_z=data.get("pos_z", 0),
            rot_y=data.get("rot_y", 0),
            scale_x=data.get("scale_x", 1),
            scale_y=data.get("scale_y", 1),
            scale_z=data.get("scale_z", 1),
            custom_width=data.get("custom_width"),
            custom_depth=data.get("custom_depth"),
            custom_height=data.get("custom_height"),
        )
        logger.info("Furniture added", extra={"extra": {"floor": floor, "type": data.get("furniture_type"), "label": data.get("label", "")}})
        db.add(p)
        db.commit()
        db.refresh(p)
        return {
            "id": p.id,
            "furniture_type": p.furniture_type,
            "style": p.style,
            "pos_x": p.pos_x,
            "pos_y": p.pos_y,
            "pos_z": p.pos_z,
        }
    finally:
        db.close()


@router.patch("/furniture/{item_id}")
def update_furniture(item_id: int, data: dict):
    """更新家具位置/变换"""
    db: Session = next(get_db())
    try:
        p = db.query(FurniturePlacement).filter(FurniturePlacement.id == item_id).first()
        if not p:
            raise HTTPException(404, "Furniture not found")

        updatable = [
            "pos_x", "pos_y", "pos_z", "rot_y",
            "scale_x", "scale_y", "scale_z",
            "style", "label", "furniture_type",
            "custom_width", "custom_depth", "custom_height",
        ]
        for key in updatable:
            if key in data:
                setattr(p, key, data[key])

        db.commit()
        db.refresh(p)
        logger.info("Furniture updated", extra={"extra": {"item_id": item_id, "changed": [k for k in data if k in updatable]}})
        return {"id": p.id, "message": "updated"}
    finally:
        db.close()


@router.delete("/furniture/{item_id}")
def delete_furniture(item_id: int):
    """删除家具"""
    db: Session = next(get_db())
    try:
        p = db.query(FurniturePlacement).filter(FurniturePlacement.id == item_id).first()
        if not p:
            raise HTTPException(404, "Furniture not found")
        logger.info("Furniture deleted", extra={"extra": {"item_id": item_id, "type": p.furniture_type}})
        db.delete(p)
        db.commit()
        return {"message": "deleted"}
    finally:
        db.close()
