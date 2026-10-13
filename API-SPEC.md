# Task Flow API Specification

## Conventions

- Base path: `/api`
- Request and response bodies use JSON with UTF-8 encoding.
- The API is for a single user; authentication is not included.
- Invalid request data returns `422 Unprocessable Entity`.
- Unknown resources return `404 Not Found`.
- Local development allows browser origins `http://localhost:8080` and
  `http://127.0.0.1:8080`;
  deployed environments should use the Web server's same-origin API proxy.

## Health check

### `GET /api/health`

Checks whether the API process is responding.

Successful response: `200 OK`

```json
{
  "status": "ok"
}
```

## Tasks

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
restarts. Unknown task IDs return `404 Not Found`.
