import os

from dotenv import load_dotenv
from sqlalchemy import URL, create_engine
from sqlalchemy.engine import Engine

load_dotenv()

required_settings = ("DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD")
missing_settings = [name for name in required_settings if not os.getenv(name)]
if missing_settings:
    raise RuntimeError(
        "Missing required database settings: " + ", ".join(missing_settings)
    )

try:
    db_port = int(os.environ["DB_PORT"])
except ValueError as error:
    raise RuntimeError("DB_PORT must be an integer") from error

database_url = URL.create(
    drivername="mysql+mysqlconnector",
    username=os.environ["DB_USER"],
    password=os.environ["DB_PASSWORD"],
    host=os.environ["DB_HOST"],
    port=db_port,
    database=os.environ["DB_NAME"],
    query={"charset": "utf8mb4"},
)

engine: Engine = create_engine(database_url, pool_pre_ping=True)
