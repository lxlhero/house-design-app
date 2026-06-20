"""数据库连接 — SQLite"""
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base
from .logging_config import get_logger

logger = get_logger("house_design.database")

DATABASE_URL = "sqlite:///./house_design.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

@event.listens_for(engine, "connect")
def _on_connect(dbapi_conn, conn_record):
    """启用 WAL 模式 + 外键约束"""
    dbapi_conn.execute("PRAGMA journal_mode=WAL")
    dbapi_conn.execute("PRAGMA foreign_keys=ON")
    logger.debug("SQLite connection established (WAL mode)")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
