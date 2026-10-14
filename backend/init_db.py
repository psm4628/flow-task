from sqlalchemy import inspect, text

from backend.database import engine
from backend.models import Base


def add_tasks_user_id_if_missing() -> None:
    """기존 tasks 테이블에 user_id 컬럼만 추가한다. 기존 행은 그대로 보존한다."""
    if "user_id" in {column["name"] for column in inspect(engine).get_columns("tasks")}:
        return
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE tasks ADD COLUMN user_id CHAR(32) NULL"))
        connection.execute(text("CREATE INDEX ix_tasks_user_id ON tasks (user_id)"))
        connection.execute(
            text(
                "ALTER TABLE tasks ADD CONSTRAINT fk_tasks_user_id "
                "FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE"
            )
        )
    print("Added tasks.user_id.")


def main() -> None:
    Base.metadata.create_all(bind=engine)
    add_tasks_user_id_if_missing()
    print("Database tables initialized.")


if __name__ == "__main__":
    main()
