import base64
import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.database import engine
from backend.models import AuthSession, User

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


SESSION_COOKIE = "session"
SESSION_LIFETIME = timedelta(days=7)
# 존재하지 않는 사용자명으로 로그인해도 해시 검증 시간이 같도록 쓰는 더미 해시.
DUMMY_PASSWORD_HASH = hash_password(secrets.token_urlsafe(16))
INVALID_CREDENTIALS = "Invalid username or password"


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str = Field(min_length=1, max_length=30)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("username")
    @classmethod
    def normalize_username(cls, value: str) -> str:
        return value.lower()


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def as_utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def is_https(request: Request) -> bool:
    return (
        request.url.scheme == "https"
        or request.headers.get("x-forwarded-proto") == "https"
    )


def get_current_user(request: Request) -> User:
    """세션 쿠키로 로그인한 사용자를 찾는다. 없거나 만료되면 401을 반환한다."""
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
    )
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise unauthorized
    with Session(engine, expire_on_commit=False) as session:
        record = session.get(AuthSession, hash_token(token))
        if record is None:
            raise unauthorized
        if as_utc(record.expires_at) <= datetime.now(timezone.utc):
            session.delete(record)
            session.commit()
            raise unauthorized
        user = session.get(User, record.user_id)
        if user is None:
            raise unauthorized
        return user


@router.post(
    "/login",
    response_model=UserResponse,
    responses={status.HTTP_401_UNAUTHORIZED: {"description": "Invalid credentials"}},
)
def login(request: Request, body: LoginRequest, response: Response) -> UserResponse:
    now = datetime.now(timezone.utc)
    with Session(engine, expire_on_commit=False) as session:
        user = session.scalar(select(User).where(User.username == body.username))
        # 사용자 존재 여부와 상관없이 해시 검증을 수행해 응답 시간 차이를 줄인다.
        password_ok = verify_password(
            body.password, user.password_hash if user else DUMMY_PASSWORD_HASH
        )
        if user is None or not password_ok:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail=INVALID_CREDENTIALS
            )
        # 로그인할 때마다 새 토큰을 발급하고, 이 사용자의 만료된 세션은 정리한다.
        session.execute(
            delete(AuthSession).where(
                AuthSession.user_id == user.id, AuthSession.expires_at <= now
            )
        )
        token = secrets.token_urlsafe(32)
        session.add(
            AuthSession(
                token_hash=hash_token(token),
                user_id=user.id,
                expires_at=now + SESSION_LIFETIME,
            )
        )
        session.commit()
        result = UserResponse.model_validate(user)
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=int(SESSION_LIFETIME.total_seconds()),
        httponly=True,
        samesite="lax",
        secure=is_https(request),
        path="/",
    )
    response.headers["Cache-Control"] = "no-store"
    return result


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request) -> Response:
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        with Session(engine) as session:
            session.execute(
                delete(AuthSession).where(AuthSession.token_hash == hash_token(token))
            )
            session.commit()
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    response.delete_cookie(SESSION_COOKIE, path="/", httponly=True, samesite="lax")
    return response


@router.get(
    "/me",
    response_model=UserResponse,
    responses={status.HTTP_401_UNAUTHORIZED: {"description": "Not authenticated"}},
)
def me(response: Response, user: User = Depends(get_current_user)) -> UserResponse:
    response.headers["Cache-Control"] = "no-store"
    return UserResponse.model_validate(user)
