# Task Flow API Specification

## Conventions

- Base path: `/api`
- Request and response bodies use JSON with UTF-8 encoding.
- The API is for a single user; authentication is not included.
- Invalid request data returns `422 Unprocessable Entity`.
- Unknown resources return `404 Not Found`.

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

Planned endpoints:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/tasks` | List tasks; later supports title, status, and priority filters |
| `POST` | `/api/tasks` | Create a task |
| `PATCH` | `/api/tasks/{task_id}` | Update only the supplied task fields |
| `DELETE` | `/api/tasks/{task_id}` | Delete a task |

Task endpoint behavior and response schemas will be implemented in T06 and T07.
