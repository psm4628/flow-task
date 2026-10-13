from backend.database import engine
from backend.models import Base


def main() -> None:
    Base.metadata.create_all(bind=engine)
    print("Database tables initialized.")


if __name__ == "__main__":
    main()
