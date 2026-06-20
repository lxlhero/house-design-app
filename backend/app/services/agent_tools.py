"""
Agent 工具集 — Agent 可以调用这些函数来操作数据库
每执行一个修改操作后，自动同步回 Excel
"""
from sqlalchemy.orm import Session
from ..models.models import Item, Category, Phase, BudgetConfig
from .excel_store import sync_db_to_excel
from ..logging_config import get_logger

logger = get_logger("house_design.agent_tools")

# ══════════════════════════════════════════
# 工具定义（给 DeepSeek 的 function calling schema）
# ══════════════════════════════════════════
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_items",
            "description": "搜索采购项。妈妈可能说「橱柜」「地板」等模糊名称，用它找到精确的采购项名称和当前预算。",
            "parameters": {
                "type": "object",
                "properties": {
                    "keyword": {"type": "string", "description": "搜索关键词，可以是采购项名称、类别名、或空间名的一部分"}
                },
                "required": ["keyword"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "update_item_budget",
            "description": "修改某个采购项的控制预算。妈妈说「把XX预算改成X万」时调用。",
            "parameters": {
                "type": "object",
                "properties": {
                    "item_name": {"type": "string", "description": "采购项的精确名称（先用 search_items 确认）"},
                    "control_budget": {"type": "number", "description": "新的控制预算金额（元），比如 50000 表示 5 万元"}
                },
                "required": ["item_name", "control_budget"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "update_item_status",
            "description": "修改采购项的状态。妈妈说「XX已经买了」「XX到货了」「XX装好了」时调用。",
            "parameters": {
                "type": "object",
                "properties": {
                    "item_name": {"type": "string", "description": "采购项名称"},
                    "status": {"type": "string", "enum": ["未开始", "已下单", "已支付", "已到货", "已安装", "已完成"], "description": "新状态"}
                },
                "required": ["item_name", "status"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "update_item_supplier",
            "description": "记录采购项的实际花费、供应商信息。妈妈分享购买经验时调用。",
            "parameters": {
                "type": "object",
                "properties": {
                    "item_name": {"type": "string", "description": "采购项名称"},
                    "actual_cost": {"type": "number", "description": "实际花费金额（元）"},
                    "supplier": {"type": "string", "description": "供应商/商家名称"},
                    "notes": {"type": "string", "description": "备注/经验记录"}
                },
                "required": ["item_name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_budget_summary",
            "description": "查看当前预算总览：总预算、各大项预算、已花费情况。妈妈问「预算还够吗」时调用。",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_phase_status",
            "description": "查看当前装修阶段进度。妈妈问「现在该做什么」「下一步是什么」时调用。",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "update_total_budget",
            "description": "修改总预算金额。妈妈说「把总预算改成XX万」时调用。",
            "parameters": {
                "type": "object",
                "properties": {
                    "amount": {"type": "number", "description": "新的总预算金额（元）"}
                },
                "required": ["amount"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "reset_all_data",
            "description": "重置所有采购项到初始状态（未开始、花费归零），重置所有阶段为未开始（仅阶段0设为进行中）。用于妈妈要求「清理测试数据」「恢复初始状态」时。会清除所有已下单/已支付/已安装的状态和花费记录。",
            "parameters": {
                "type": "object",
                "properties": {
                    "confirm": {"type": "boolean", "description": "必须为 true 才执行，防止误操作"}
                },
                "required": ["confirm"]
            }
        }
    }
]


# ══════════════════════════════════════════
# 工具执行函数
# ══════════════════════════════════════════

_db: Session | None = None

def set_db(db: Session):
    """Agent 请求进来时设置 DB session"""
    global _db
    _db = db


def execute_tool(name: str, args: dict) -> str:
    """执行工具调用，返回结果描述字符串"""
    db = _db
    if not db:
        return "❌ 数据库未连接"

    try:
        if name == "search_items":
            return _search_items(db, args)
        elif name == "update_item_budget":
            return _update_item(db, args, "budget")
        elif name == "update_item_status":
            return _update_item(db, args, "status")
        elif name == "update_item_supplier":
            return _update_item(db, args, "supplier")
        elif name == "get_budget_summary":
            return _get_budget_summary(db)
        elif name == "get_phase_status":
            return _get_phase_status(db)
        elif name == "update_total_budget":
            return _update_total_budget(db, args)
        elif name == "reset_all_data":
            return _reset_all_data(db, args)
        else:
            return f"❌ 未知工具: {name}"
    except Exception as e:
        logger.exception(f"Tool execution failed: {name}")
        return f"❌ 执行失败: {str(e)[:200]}"


def _search_items(db: Session, args: dict) -> str:
    keyword = args.get("keyword", "")
    items = db.query(Item).filter(
        (Item.item_name.contains(keyword)) |
        (Item.category.contains(keyword)) |
        (Item.floor_space.contains(keyword))
    ).limit(10).all()

    if not items:
        return f"未找到包含「{keyword}」的采购项"

    lines = [f"搜索「{keyword}」找到 {len(items)} 个采购项："]
    for i, item in enumerate(items[:8]):
        lines.append(
            f"{i+1}. {item.item_name}（{item.category}，{item.floor_space}）"
            f" - 控制预算 {item.control_budget:.0f} 元，状态 {item.status}"
        )
    return "\n".join(lines)


def _update_item(db: Session, args: dict, mode: str) -> str:
    item_name = args.get("item_name", "")
    item = db.query(Item).filter(Item.item_name == item_name).first()

    matches = []
    # 精确匹配失败 → 模糊匹配
    if not item:
        matches = db.query(Item).filter(Item.item_name.contains(item_name[:3])).limit(5).all()
        if matches:
            # 尝试包含匹配
            for m in matches:
                if item_name in m.item_name or m.item_name in item_name:
                    item = m
                    break
            # 还找不到就取第一个
            if not item and len(matches) == 1:
                item = matches[0]

    if not item:
        names = [m.item_name for m in matches]
        hint = f" 你可能指的是：{', '.join(names)}" if names else ""
        return f"未找到采购项「{item_name}」。{hint}"

    changes = []
    if mode == "budget":
        new_budget = args.get("control_budget", 0)
        old = item.control_budget
        item.control_budget = new_budget
        changes.append(f"控制预算 {old:.0f} → {new_budget:.0f} 元")

    elif mode == "status":
        new_status = args.get("status", "")
        old = item.status
        item.status = new_status
        changes.append(f"状态 {old} → {new_status}")

    elif mode == "supplier":
        if "actual_cost" in args:
            item.actual_cost = args["actual_cost"]
            changes.append(f"实际花费 → {args['actual_cost']} 元")
        if "supplier" in args:
            item.supplier = args["supplier"]
            changes.append(f"供应商 → {args['supplier']}")
        if "notes" in args:
            item.notes = args["notes"]
            changes.append(f"备注 → {args['notes']}")

    db.commit()

    # 自动同步回 Excel
    try:
        sync_db_to_excel(db)
    except Exception as e:
        logger.warning(f"Excel sync failed: {e}")

    return f"✅ 已更新「{item.item_name}」：{', '.join(changes)}"


def _get_budget_summary(db: Session) -> str:
    categories = db.query(Category).all()
    total_config = db.query(BudgetConfig).filter(BudgetConfig.key == "total_budget").first()
    total_budget = total_config.value if total_config else 0

    # 已花费总额
    items = db.query(Item).all()
    spent = sum(i.actual_cost or 0 for i in items)

    lines = [f"总预算：{total_budget:,.0f} 元，已花费：{spent:,.0f} 元，剩余：{total_budget - spent:,.0f} 元"]
    lines.append(f"\n预算大项明细：")
    for c in categories:
        cat_spent = sum(i.actual_cost or 0 for i in items if i.category == c.name)
        lines.append(f"  {c.name}：控制预算 {c.control_budget:,.0f} 元，已花费 {cat_spent:,.0f} 元")
    return "\n".join(lines)


def _get_phase_status(db: Session) -> str:
    phases = db.query(Phase).order_by(Phase.phase_num).all()
    lines = ["装修阶段进度："]
    for p in phases:
        icon = {"completed": "✅", "current": "🔵", "upcoming": "⬜"}.get(p.status, "⬜")
        lines.append(f"  {icon} 阶段{p.phase_num}：{p.name}（{p.status}）")
    return "\n".join(lines)


def _update_total_budget(db: Session, args: dict) -> str:
    amount = args.get("amount", 0)
    config = db.query(BudgetConfig).filter(BudgetConfig.key == "total_budget").first()
    if config:
        old = config.value
        config.value = amount
    else:
        old = 0
        db.add(BudgetConfig(key="total_budget", value=amount))
    db.commit()
    return f"✅ 总预算已更新：{old:,.0f} → {amount:,.0f} 元"


def _reset_all_data(db: Session, args: dict) -> str:
    """重置所有数据到初始状态"""
    confirm = args.get("confirm", False)
    if not confirm:
        return "❌ 请确认要重置所有数据（confirm=true）"

    # 重置所有采购项
    items_count = db.query(Item).count()
    db.query(Item).update({
        "status": "未开始",
        "actual_cost": 0,
        "actual_paid": 0,
        "supplier": None,
        "supplier_contact": None,
        "notes": None,
    })

    # 重置所有阶段
    phases = db.query(Phase).order_by(Phase.phase_num).all()
    for p in phases:
        p.status = "upcoming"
    # 阶段 0 设为进行中
    first_phase = db.query(Phase).filter(Phase.phase_num == 0).first()
    if first_phase:
        first_phase.status = "current"

    db.commit()

    # 同步到 Excel
    try:
        sync_db_to_excel(db)
        excel_status = "已同步 Excel"
    except Exception as e:
        excel_status = f"Excel 同步失败: {e}"

    return f"✅ 已重置 {items_count} 个采购项 → 未开始，所有花费归零。阶段重置为初始状态（阶段0=进行中）。{excel_status}"
