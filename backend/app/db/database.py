import ssl as _ssl

from sqlalchemy import URL, create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings

settings = get_settings()

database_url = URL.create(
    drivername="mysql+pymysql",
    username=settings.mysql_user,
    password=settings.mysql_password,
    host=settings.mysql_host,
    port=settings.mysql_port,
    database=settings.mysql_database,
)

_connect_args: dict = {}
if settings.mysql_ssl_ca:
    _connect_args["ssl"] = {"ca": settings.mysql_ssl_ca}
elif settings.mysql_ssl:
    _connect_args["ssl"] = _ssl.create_default_context()

engine: Engine = create_engine(
    database_url,
    pool_pre_ping=True,
    pool_recycle=1800,
    connect_args=_connect_args,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
