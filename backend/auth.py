import base64
import hashlib
import hmac
import os
from datetime import datetime
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.database import engine
from backend.models import User

router = APIRouter(prefix="/api/auth", tags=["auth"])

SCRYPT_N = 2**14
SCRYPT_R = 8
SCRYPT_P = 1


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.scrypt(
        password.encode("utf-8"), salt=salt, n=SCRYPT_N, r=SCRYPT_R, p=SCRYPT_P
    )
    return "scrypt${}${}${}${}${}".format(
        SCRYPT_N,
        SCRYPT_R,
        SCRYPT_P,
        base64.b64encode(salt).decode("ascii"),
        base64.b64encode(digest).decode("ascii"),
    )


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        scheme, n, r, p, salt_b64, digest_b64 = stored_hash.split("$")
        if scheme != "scrypt":
            return False
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(digest_b64)
        actual = hashlib.scrypt(
            password.encode("utf-8"), salt=salt, n=int(n), r=int(r), p=int(p)
        )
    except ValueError:
        return False
    return hmac.compare_digest(actual, expected)


class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str = Field(min_length=3, max_length=30, pattern=r"^[A-Za-z0-9_]+$")
    password: str = Field(min_length=8, max_length=128)

    @field_validator("username")
    @classmethod
    def normalize_username(cls, value: str) -> str:
        # 대소문자 구분 없이 중복을 막기 위해 소문자로 저장한다.
        return value.lower()


    @field_validator("password")
    @classmethod
    def reject_blank_password(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("password must not be blank")
        return value


async def auth_validation_error_handler(
    request: Request, error: RequestValidationError
) -> JSONResponse:
    """인증 요청의 422 응답에 입력값(비밀번호 등)을 되돌려 주지 않는다."""
    if not request.url.path.startswith("/api/auth"):
        return await request_validation_exception_handler(request, error)
    details = [
        {"type": item["type"], "loc": item["loc"], "msg": item["msg"]}
        for item in error.errors()
    ]
    return JSONResponse(status_code=422, content={"detail": details})


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    username: str
    created_at: datetime


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    responses={status.HTTP_409_CONFLICT: {"description": "Username already taken"}},
)
def register(request: RegisterRequest) -> UserResponse:
    taken = HTTPException(
        status_code=status.HTTP_409_CONFLICT, detail="Username already taken"
    )
    with Session(engine) as session:
        if session.scalar(select(User.id).where(User.username == request.username)):
            raise taken
        user = User(
            id=uuid4(),
            username=request.username,
            password_hash=hash_password(request.password),
        )
        session.add(user)
        try:
            session.commit()
        except IntegrityError:
            session.rollback()
            raise taken from None
        session.refresh(user)
        return UserResponse.model_validate(user)
