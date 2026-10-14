# Task Flow API Specification

## Conventions

- Base path: `/api`
- Request and response bodies use JSON with UTF-8 encoding.
- The API is multi-user. Everything except `/api/health`, registration, and
  login requires a logged-in session (see [Authentication](#authentication)).
  A missing, invalid, or expired session returns `401 Unauthorized`.
- Each task belongs to the user who created it. Users can only list, update,
  and delete their own tasks.
- Invalid request data returns `422 Unprocessable Entity`.
- Unknown resources return `404 Not Found`.
- Validation errors on `/api/auth/*` do not echo the submitted values.
- The API allows CORS for browser origins `http://localhost:8080` and
  `http://127.0.0.1:8080`, but it does not allow credentials, so cross-origin
  requests never carry the session cookie. The frontend must call the API
  through the Web server's same-origin `/api` proxy (or the API's own origin).

## Health check

### `GET /api/health`

Checks whether the API process is responding.

Successful response: `200 OK`

```json
{
  "status": "ok"
}
```

## Authentication

Authentication uses a server-side session. A successful login sets a `session`
cookie (random token; `HttpOnly`, `SameSite=Lax`, `Path=/`, 7 days, and `Secure`
when the request arrived over HTTPS). The server stores only a SHA-256 hash of
the token. Browsers send the cookie automatically on same-origin requests, so
clients must call the API through the same origin as the page (the Web server's
`/api` proxy).

Passwords are stored only as salted `scrypt` hashes and are never returned or
logged.

User objects:

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | Unique user identifier |
| `username` | string | Lower-case username |
| `created_at` | string | Creation timestamp |

| Method | Path | Purpose | Success |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | Create an account | `201` user object |
| `POST` | `/api/auth/login` | Log in and set the `session` cookie | `200` user object |
| `POST` | `/api/auth/logout` | Delete the session and clear the cookie | `204` |
| `GET` | `/api/auth/me` | Return the logged-in user | `200` user object |

`POST /api/auth/register` accepts `username` and `password`. The username is
3–30 characters of letters, digits, and underscores; it is stored lower-case,
so names that differ only by case are duplicates. The password must be 8–128
characters and not blank.
Unknown fields and invalid values return `422`; a taken username returns
`409 Conflict`. Registration does not log the user in.

`POST /api/auth/login` accepts `username` (case-insensitive) and `password`.
An unknown username and a wrong password both return the same
`401 Unauthorized` response (`Invalid username or password`). Every login issues
a new session token. `POST /api/auth/logout` returns `204` even when no session
exists. `GET /api/auth/me` returns `401` without a valid session.

Sessions expire after 7 days. Expired sessions are treated as logged out and
removed when used. The API does not limit login attempts.

## Tasks

All task endpoints require a logged-in session and return `401 Unauthorized`
otherwise.

Task objects use these fields:

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | Unique task identifier |
| `title` | string | Trimmed title, 1–100 characters |
| `description` | string | Description, at most 2000 characters; defaults to an empty string |
| `status` | string | `TODO`, `DOING`, or `DONE`; defaults to `TODO` |
| `priority` | string | `HIGH`, `NORMAL`, or `LOW`; defaults to `NORMAL` |
| `due_date` | string or null | Optional calendar date in `YYYY-MM-DD` format |
| `created_at` | string | Creation timestamp |

Task endpoints:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/tasks` | List tasks; optional filters are combined with AND |
| `POST` | `/api/tasks` | Create a task; returns `201 Created` |
| `PATCH` | `/api/tasks/{task_id}` | Update only supplied fields |
| `DELETE` | `/api/tasks/{task_id}` | Delete a task; returns `204 No Content` |

`GET /api/tasks` accepts optional query parameters:

| Parameter | Type | Behavior |
| --- | --- | --- |
| `q` | string | Case-insensitive substring match against title |
| `status` | string | Exact match: `TODO`, `DOING`, or `DONE` |
| `priority` | string | Exact match: `HIGH`, `NORMAL`, or `LOW` |

`POST /api/tasks` accepts a JSON object with `title` and the optional
`description`, `status`, `priority`, and `due_date` fields. Omitted optional
fields use the defaults above. The title is trimmed and must contain 1–100
characters after trimming. Unknown fields and invalid values return
`422 Unprocessable Entity`.

`PATCH /api/tasks/{task_id}` accepts one or more of `title`, `description`,
`status`, `priority`, and `due_date`. Omitted fields remain unchanged.
`due_date` can be set to `null`; other supplied fields cannot be null. An empty
patch, unknown fields, or invalid values return `422 Unprocessable Entity`.
The endpoint returns the updated task with `200 OK`. `DELETE` returns an empty
body with `204 No Content`.

Task data is stored in MariaDB and remains available after API process
restarts. Unknown task IDs, and IDs of tasks owned by another user, return
`404 Not Found`. Tasks created before multi-user support have no owner and are
not visible to any user.
