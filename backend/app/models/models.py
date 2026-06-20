from sqlalchemy import Column, Integer, String, Float, Text, DateTime
from sqlalchemy.sql import func
from ..database import Base


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, comment="预算大项")
    control_budget = Column(Float, default=0, comment="控制预算")
    ratio = Column(Float, default=0, comment="占比")
    purchase_timing = Column(String(100), comment="采购时机")
    priority = Column(String(20), comment="优先级")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    floor_space = Column(String(200), comment="楼层/空间")
    category = Column(String(100), comment="预算大项")
    item_name = Column(String(200), nullable=False, comment="采购项")
    attr = Column(String(50), comment="装修属性(硬装/主材/系统/定制/家电/卫浴/灯光/软装/预备金)")
    phase = Column(String(50), comment="阶段")
    suggestion = Column(String(200), comment="建议动作")
    timing = Column(String(200), comment="时间节点")
    budget_min = Column(Float, default=0, comment="预算下限")
    budget_max = Column(Float, default=0, comment="预算上限")
    control_budget = Column(Float, default=0, comment="控制预算")
    brand_recommendation = Column(Text, comment="品牌推荐")
    priority = Column(String(20), comment="优先级")
    status = Column(String(20), default="未开始", comment="状态")
    notes = Column(Text, comment="备注")
    actual_cost = Column(Float, default=0, comment="实际花费")
    actual_paid = Column(Float, default=0, comment="已支付")
    supplier = Column(String(200), comment="供应商")
    supplier_contact = Column(String(200), comment="联系方式")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class Phase(Base):
    __tablename__ = "phases"

    id = Column(Integer, primary_key=True, autoincrement=True)
    phase_num = Column(Integer, comment="阶段编号")
    name = Column(String(100), comment="阶段名称")
    month_range = Column(String(100), comment="月份参考")
    core_tasks = Column(Text, comment="核心任务")
    must_decide = Column(Text, comment="必须先定/先买")
    dont_buy_early = Column(Text, comment="不能买早")
    check_points = Column(Text, comment="验收重点")
    related_categories = Column(Text, comment="关联预算大项")
    status = Column(String(20), default="upcoming", comment="upcoming/current/completed")
    created_at = Column(DateTime, server_default=func.now())


class FloorBudget(Base):
    __tablename__ = "floor_budgets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    floor = Column(String(100), comment="楼层")
    spaces = Column(Text, comment="主要空间")
    must_do = Column(Text, comment="必须先做")
    budget_min = Column(Float, default=0)
    budget_max = Column(Float, default=0)
    control_budget = Column(Float, default=0)
    can_save = Column(Text, comment="可省项")
    must_not_save = Column(Text, comment="不可省项")
    created_at = Column(DateTime, server_default=func.now())


class ImportLog(Base):
    __tablename__ = "import_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    filename = Column(String(255), comment="导入文件名")
    items_created = Column(Integer, default=0)
    items_updated = Column(Integer, default=0)
    items_unchanged = Column(Integer, default=0)
    imported_at = Column(DateTime, server_default=func.now())


class VersionSnapshot(Base):
    __tablename__ = "version_snapshots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    label = Column(String(255), comment="版本标签")
    filename = Column(String(255), comment="快照文件名")
    source = Column(String(50), default="manual", comment="来源: import/manual")
    items_count = Column(Integer, default=0)
    total_budget = Column(Float, default=0)
    created_at = Column(DateTime, server_default=func.now())


class BudgetConfig(Base):
    __tablename__ = "budget_config"

    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String(100), unique=True, nullable=False)
    value = Column(Float, default=0)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class PlatformVersion(Base):
    __tablename__ = "platform_versions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    version = Column(String(20), nullable=False, comment="版本号: v1.0")
    title = Column(String(200), comment="版本标题")
    features = Column(Text, comment="更新内容，JSON数组")
    snapshot_id = Column(Integer, nullable=True, comment="关联的数据快照ID")
    released_at = Column(DateTime, server_default=func.now())


class FloorPlan(Base):
    """楼层平面图"""
    __tablename__ = "floor_plans"

    id = Column(Integer, primary_key=True, autoincrement=True)
    floor = Column(String(50), nullable=False, unique=True, comment="楼层: 1F/2F/3F/B1/B2")
    image_path = Column(String(500), comment="平面图图片路径")
    width_m = Column(Float, default=10, comment="实际宽度(米)")
    depth_m = Column(Float, default=8, comment="实际深度(米)")
    description = Column(Text, comment="楼层描述")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class FurniturePlacement(Base):
    """3D家具摆放"""
    __tablename__ = "furniture_placements"

    id = Column(Integer, primary_key=True, autoincrement=True)
    floor = Column(String(50), nullable=False, comment="所属楼层")
    furniture_type = Column(String(100), nullable=False, comment="家具类型")
    style = Column(String(50), default="default", comment="样式/颜色")
    label = Column(String(200), comment="自定义标签")
    # 3D 变换
    pos_x = Column(Float, default=0, comment="X 位置(米)")
    pos_y = Column(Float, default=0, comment="Y 高度(米)")
    pos_z = Column(Float, default=0, comment="Z 位置(米)")
    rot_y = Column(Float, default=0, comment="Y轴旋转(弧度)")
    scale_x = Column(Float, default=1, comment="X缩放倍数")
    scale_y = Column(Float, default=1, comment="Y缩放倍数")
    scale_z = Column(Float, default=1, comment="Z缩放倍数")
    # 尺寸覆盖
    custom_width = Column(Float, comment="自定义宽度(米)")
    custom_depth = Column(Float, comment="自定义深度(米)")
    custom_height = Column(Float, comment="自定义高度(米)")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
