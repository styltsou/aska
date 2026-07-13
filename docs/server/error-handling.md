# Error Handling

Server errors use `AppError` from `server/src/lib/errors.ts` and are normalized
by the global Hono error handler in `server/src/app.ts`.

## Error Codes

Shared codes:

```typescript
export const ErrorCode = {
  VALIDATION_ERROR: "validation_error",
  UNAUTHORIZED: "unauthorized",
  FORBIDDEN: "forbidden",
  CONFLICT: "conflict",
  INTERNAL_ERROR: "internal_error",
  NOT_FOUND: "not_found",
} as const;
```

Add a new code only when the generic code is not specific enough for clients or
logs. Do not add entity-specific codes by default.

## Response Shapes

Errors:

```json
{
  "error": {
    "code": "not_found",
    "message": "Collection not found"
  }
}
```

Success:

```json
{
  "data": {}
}
```

## Usage

Throw `AppError` from services for business and application failures:

```typescript
throw new AppError(ErrorCode.NOT_FOUND, "Collection not found");
```

Services should not catch their own `AppError`s. Let them bubble to the global
handler.

Controllers should not catch normal service errors. Use controller `try/catch`
only at request-boundary integrations where the controller owns translation of
a raw external failure.

Validation middleware throws `VALIDATION_ERROR`; controllers should read typed
data from `c.req.valid(...)`.

Auth middleware throws `UNAUTHORIZED` when Better Auth does not return a valid
session. Protected-route auth failures therefore use the same response envelope
as controller and service errors.

Whenever an error response changes, update:

```txt
server/src/openapi.json
```
