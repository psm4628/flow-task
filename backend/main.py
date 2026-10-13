from datetime import date, datetime
from enum import StrEnum
from uuid import UUID, uuid4

from fastapi import FastAPI, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.database import engine
from backend.models import Task as TaskRecord


class TaskStatus(StrEnum):
    TODO = "TODO"
    DOING = "DOING"
    DONE = "DONE"


class TaskPriority(StrEnum):
    HIGH = "HIGH"
    NORMAL = "NORMAL"
    LOW = "LOW"


class TaskCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=2000)
    status: TaskStatus = TaskStatus.TODO
    priority: TaskPriority = TaskPriority.NORMAL
    due_date: date | None = None

    @field_validator("title")
    @classmethod
    def trim_and_validate_title(cls, value: str) -> str:
        title = value.strip()
        if not 1 <= len(title) <= 100:
            raise ValueError("title must contain 1 to 100 non-whitespace characters")
        return title


class TaskUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=2000)
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    due_date: date | None = None

    @field_validator("title")
    @classmethod
    def trim_and_validate_title(cls, value: str | None) -> str | None:
        if value is None:
            raise ValueError("title cannot be null")
        title = value.strip()
        if not 1 <= len(title) <= 100:
            raise ValueError("title must contain 1 to 100 non-whitespace characters")
        return title

    @field_validator("description", "status", "priority")
    @classmethod
    def reject_null_for_non_nullable_fields(cls, value: object) -> object:
        if value is None:
            raise ValueError("field cannot be null")
        return value

    @model_validator(mode="after")
    def require_at_least_one_field(self) -> "TaskUpdate":
        if not self.model_fields_set:
            raise ValueError("at least one field must be provided")
        return self


class TaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    description: str
    status: TaskStatus
    priority: TaskPriority
    due_date: date | None
    created_at: datetime

app = FastAPI(title="Task Flow API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ],
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/tasks", response_model=list[TaskResponse])
def list_tasks(
    q: str | None = None,
    status: TaskStatus | None = None,
    priority: TaskPriority | None = None,
) -> list[TaskResponse]:
    query = q.strip().casefold() if q is not None else ""
    statement = select(TaskRecord)
    if query:
        statement = statement.where(func.lower(TaskRecord.title).contains(query, autoescape=True))
    if status is not None:
        statement = statement.where(TaskRecord.status == status.value)
    if priority is not None:
        statement = statement.where(TaskRecord.priority == priority.value)
    statement = statement.order_by(TaskRecord.created_at, TaskRecord.id)

    with Session(engine) as session:
        records = session.scalars(statement).all()
        return [TaskResponse.model_validate(record) for record in records]


@app.post(
    "/api/tasks",
    response_model=TaskResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_task(task: TaskCreate) -> TaskResponse:
    new_task = TaskRecord(
        id=uuid4(),
        title=task.title,
        description=task.description,
        status=task.status.value,
        priority=task.priority.value,
        due_date=task.due_date,
    )
    with Session(engine) as session:
        session.add(new_task)
        session.commit()
        session.refresh(new_task)
        return TaskResponse.model_validate(new_task)


@app.patch(
    "/api/tasks/{task_id}",
    response_model=TaskResponse,
    responses={status.HTTP_404_NOT_FOUND: {"description": "Task not found"}},
)
def update_task(task_id: UUID, update: TaskUpdate) -> TaskResponse:
    changes = update.model_dump(exclude_unset=True)
    if isinstance(changes.get("status"), TaskStatus):
        changes["status"] = changes["status"].value
    if isinstance(changes.get("priority"), TaskPriority):
        changes["priority"] = changes["priority"].value

    with Session(engine) as session:
        record = session.get(TaskRecord, task_id)
        if record is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task not found",
            )
        for field, value in changes.items():
            setattr(record, field, value)
        session.commit()
        session.refresh(record)
        return TaskResponse.model_validate(record)


@app.delete(
    "/api/tasks/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={status.HTTP_404_NOT_FOUND: {"description": "Task not found"}},
)
def delete_task(task_id: UUID) -> Response:
    with Session(engine) as session:
        record = session.get(TaskRecord, task_id)
        if record is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task not found",
            )
        session.delete(record)
        session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
