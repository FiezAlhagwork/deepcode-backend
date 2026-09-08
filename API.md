# API Documentation

Living reference for every endpoint exposed by this backend. **An endpoint is only added here after it has been manually tested (via Postman) and confirmed working** — this file tracks what's actually verified, not just what's coded. See [CLAUDE.md](CLAUDE.md) for the underlying conventions (response shape, auth model, folder structure).

## Base URL

```
http://localhost:5000   (development)
```

## Response Shape

**Success**
```json
{
  "success": true,
  "data": {},
  "message": "optional human-readable message",
  "pagination": "optional — only on paginated list endpoints, see below"
}
```

**Pagination** — any list endpoint accepts `?page=&limit=` (defaults `1`/`10`, `limit` capped at `100`) and returns a `pagination` field as a sibling of `data` (never nested inside it):
```json
{ "page": 1, "limit": 10, "total": 42, "totalPages": 5 }
```

**Error**
```json
{
  "success": false,
  "error": {
    "message": "Human-readable error message",
    "code": "OPTIONAL_MACHINE_READABLE_CODE"
  }
}
```

## Authentication

Protected endpoints require a valid Clerk session token:

```
Authorization: Bearer <token>
```

Roles (`super_admin`, `admin`, `user`) are stored in this app's own MongoDB, not in Clerk — see [CLAUDE.md → Auth & Roles](CLAUDE.md#auth--roles). A `401` means no/invalid session; a `403` means a valid session with an insufficient role.

## Entry Template

Copy this shape for every new confirmed endpoint:

```markdown
### `METHOD /path`
**Auth**: None | Bearer token | Role: `admin`, `super_admin`

**Request Body / Params** (if any):
​```json
{ }
​```

**Success — `200`**:
​```json
{ }
​```

**Errors**:
- `401` — ...
- `403` — ...
- `404` — ...
```

---

## Auth

### `GET /api/auth/me`
**Auth**: Bearer token (any authenticated user, no specific role required)

**Request Body / Params**: none

**Success — `200`**:
```json
{
  "success": true,
  "data": { "userId": "user_xxx" }
}
```

**Errors**:
- `401` — `UNAUTHENTICATED`, no/invalid/expired session token

## Users

### `GET /api/users`
**Auth**: Bearer token, Role: `admin`, `super_admin`

**Request Body / Params**: optional query `?page=&limit=` (see Pagination above), plus `?q=` (searches `email`/`firstName`/`lastName`, case-insensitive) and `?role=user|admin|super_admin`

**Success — `200`**:
```json
{
  "success": true,
  "data": [
    {
      "_id": "6a99520cb5a1c73e73f02862",
      "clerkId": "user_xxx",
      "email": "fiezalhag@gmail.com",
      "firstName": "Fiez",
      "lastName": "Alhag",
      "imageUrl": "https://img.clerk.com/...",
      "role": "super_admin",
      "status": "active",
      "createdAt": "2026-09-03T10:30:21.012Z",
      "updatedAt": "2026-09-03T11:12:32.890Z"
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
}
```

**Errors**:
- `401` — `UNAUTHENTICATED`
- `403` — `FORBIDDEN`, role is not `admin`/`super_admin`
- `400` — `VALIDATION_ERROR`, `page`/`limit` not a valid positive integer (or `limit` > 100)

---

### `POST /api/users`
**Auth**: Bearer token, Role: `super_admin` only

**Request Body**:
```json
{ "email": "teammate@example.com", "role": "admin" }
```
`role` must be `admin` or `super_admin` (a plain `user` is created automatically via self-signup, not through this endpoint).

**Success — `201`**:
```json
{
  "success": true,
  "message": "Invitation sent.",
  "data": {
    "id": "inv_xxx",
    "emailAddress": "teammate@example.com",
    "publicMetadata": { "role": "admin" },
    "status": "pending"
  }
}
```

**Errors**:
- `401` — `UNAUTHENTICATED`
- `403` — `FORBIDDEN`, caller is not `super_admin`
- `400` — `VALIDATION_ERROR`, invalid email or role
- `502` — `CLERK_INVITE_FAILED`, Clerk rejected the invitation (e.g. email already invited/registered)

---

### `PATCH /api/users/:id/role`
**Auth**: Bearer token, Role: `super_admin` only. `:id` is the MongoDB `_id` (24-char hex), **not** the Clerk `clerkId`.

**Request Body**:
```json
{ "role": "admin" }
```
`role` may be `user`, `admin`, or `super_admin`.

**Success — `200`**:
```json
{
  "success": true,
  "message": "Role updated.",
  "data": {
    "_id": "6a99520cb5a1c73e73f02862",
    "clerkId": "user_xxx",
    "email": "fiezalhag@gmail.com",
    "role": "admin",
    "status": "active"
  }
}
```

**Errors**:
- `401` — `UNAUTHENTICATED`
- `403` — `FORBIDDEN`, caller is not `super_admin`
- `400` — `VALIDATION_ERROR`, `:id` is not a valid ObjectId or `role` is not a valid enum value
- `404` — `USER_NOT_FOUND`

---

### `DELETE /api/users/:id`
**Auth**: Bearer token, Role: `super_admin` only. `:id` is the MongoDB `_id`, not the Clerk `clerkId`. Soft-delete only — sets `status: "deactivated"`, does **not** touch the Clerk account.

**Request Body / Params**: none besides `:id`

**Success — `200`**:
```json
{
  "success": true,
  "message": "User removed.",
  "data": {
    "_id": "6a99520cb5a1c73e73f02862",
    "status": "deactivated"
  }
}
```

**Errors**:
- `401` — `UNAUTHENTICATED`
- `403` — `FORBIDDEN`, caller is not `super_admin`
- `400` — `VALIDATION_ERROR`, `:id` is not a valid ObjectId
- `404` — `USER_NOT_FOUND`

## Categories

### `GET /api/categories`
**Auth**: None (public)

**Request Body / Params**: optional query `?page=&limit=` (see Pagination above), plus `?q=` (searches `name.ar`/`name.en`/`slug`, case-insensitive)

**Success — `200`**:
```json
{
  "success": true,
  "data": [
    { "_id": "6a9dc33ed77c7a85e2ee5c06", "name": { "ar": "ويب", "en": "Web" }, "slug": "web-apps" }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
}
```

**Errors**:
- `400` — `VALIDATION_ERROR`, invalid `page`/`limit`

---

### `GET /api/categories/:id`
**Auth**: None (public). `:id` is the MongoDB `_id` only — no slug lookup (unlike `projects`, there's no current need to fetch a category by slug).

**Success — `200`**:
```json
{
  "success": true,
  "data": { "_id": "6a9dc33ed77c7a85e2ee5c06", "name": { "ar": "ويب", "en": "Web" }, "slug": "web-apps" }
}
```

**Errors**:
- `400` — `VALIDATION_ERROR`, `:id` is not a valid ObjectId
- `404` — `CATEGORY_NOT_FOUND`

---

### `POST /api/categories`
**Auth**: Bearer token, Role: `admin`, `super_admin`

**Request Body**:
```json
{ "name": { "ar": "ويب", "en": "Web" }, "slug": "web-apps" }
```
`slug` is entered manually (not auto-derived from `name`), must be lowercase kebab-case, and must be unique.

**Success — `201`**: the created category document.

**Errors**:
- `401` — `UNAUTHENTICATED`
- `403` — `FORBIDDEN`
- `400` — `VALIDATION_ERROR`, missing/invalid `name`/`slug`
- `409` — `DUPLICATE_KEY`, `slug` already in use

---

### `PATCH /api/categories/:id`
**Auth**: Bearer token, Role: `admin`, `super_admin`. `:id` is the MongoDB `_id`.

**Request Body**: any subset of `{ name, slug }` — at least one field required.

**Success — `200`**: the updated category document.

**Errors**:
- `401` — `UNAUTHENTICATED`
- `403` — `FORBIDDEN`
- `400` — `VALIDATION_ERROR`
- `404` — `CATEGORY_NOT_FOUND`
- `409` — `DUPLICATE_KEY`, `slug` already in use

---

### `DELETE /api/categories/:id`
**Auth**: Bearer token, Role: `admin`, `super_admin`. `:id` is the MongoDB `_id`. Rejects the delete (no cascade, no force) if any `Project` still references this category.

**Success — `200`**: the deleted category document.

**Errors**:
- `401` — `UNAUTHENTICATED`
- `403` — `FORBIDDEN`
- `404` — `CATEGORY_NOT_FOUND`
- `409` — `CATEGORY_IN_USE`, one or more projects still reference this category

## Projects

### `GET /api/projects`
**Auth**: None (public), but **session-aware**: a caller with a valid `admin`/`super_admin` Bearer token also sees `draft` projects; everyone else only sees `published` ones.

**Request Body / Params**: optional query `?page=&limit=` (see Pagination above), plus `?q=` (searches `name.ar`/`name.en`/`slug`), `?category=<categoryId>`, and `?status=draft|published` — `status` is only honored for a caller who can already see drafts (`admin`/`super_admin`); a public caller passing `?status=draft` is silently ignored, never shown drafts.

**Success — `200`**:
```json
{
  "success": true,
  "data": [
    {
      "_id": "...", "name": { "ar": "...", "en": "Test Project" }, "slug": "test-project",
      "description": { "ar": "...", "en": "..." },
      "coverImage": "https://res.cloudinary.com/.../cover.jpg",
      "gallery": [{ "_id": "...", "image": "https://res.cloudinary.com/.../1.jpg", "publicId": "projects/abc123", "order": 1 }],
      "links": [{ "type": "github", "url": "https://github.com/example" }],
      "category": { "_id": "...", "name": { "ar": "ويب", "en": "Web" }, "slug": "web-apps" },
      "status": "published", "order": 0
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
}
```

**Errors**:
- `400` — `VALIDATION_ERROR`, invalid `page`/`limit`/`status`/`category`

---

### `GET /api/projects/:id`
**Auth**: None (public), same session-aware draft visibility as the list above. `:id` accepts **either** a MongoDB `_id` **or** a `slug`, at the same route: the server checks whether the value looks like a 24-char hex ObjectId — if so it looks up by `_id`, otherwise by `slug`. A draft's detail page 404s exactly like a nonexistent id/slug for a caller who isn't `admin`/`super_admin` (no existence leak).

**Success — `200`**: the single project document (same shape as one list item, `category` populated).

**Errors**:
- `404` — `PROJECT_NOT_FOUND` (nonexistent id/slug, or a draft hidden from this caller)

---

### `POST /api/projects`
**Auth**: Bearer token, Role: `admin`, `super_admin`. **`multipart/form-data`, not JSON.**

**Request Body** (form-data fields):
| Key | Type | Notes |
|---|---|---|
| `name` | Text | JSON string, e.g. `{"ar":"...","en":"..."}` |
| `slug` | Text | manual, unique, lowercase kebab-case |
| `description` | Text | JSON string `{ar, en}` |
| `links` | Text | JSON string array, e.g. `[{"type":"github","url":"..."}]` (optional) |
| `category` | Text | Category `_id` |
| `status` | Text | `draft` \| `published` (optional, defaults `draft`) |
| `order` | Text | number (optional, defaults `0`) |
| `coverImage` | **File** | single image (jpeg/png/webp/gif, ≤5MB) — required |
| `gallery` | **File** | repeat this key for multiple images (optional) — uploaded in order, `order` = attachment order |

Both `coverImage` and each `gallery` file are uploaded to Cloudinary server-side before the record is saved; each gallery item stores its own `_id` and Cloudinary `publicId` (used by the gallery-delete endpoint below).

**Success — `201`**: the created project document, with real Cloudinary URLs in `coverImage`/`gallery`.

**Errors**:
- `401` — `UNAUTHENTICATED`
- `403` — `FORBIDDEN`
- `400` — `VALIDATION_ERROR` / `INVALID_FILE_TYPE` (bad field, missing `coverImage`, or disallowed file type)
- `404` — `CATEGORY_NOT_FOUND`, referenced `category` doesn't exist
- `409` — `DUPLICATE_KEY`, `slug` already in use

---

### `PATCH /api/projects/:id`
**Auth**: Bearer token, Role: `admin`, `super_admin`. `:id` is the MongoDB `_id`. Same `multipart/form-data` shape as `POST`, but every field is optional — send only what's changing. Omitting `coverImage` leaves it untouched.

**Gallery is additive, never replaced**: sending new `gallery` files **appends** them after whatever is already saved (order continues from the current max) — it never wipes out existing images. There is no "send the whole gallery to replace it" shape. To remove one specific existing image, use `DELETE /api/projects/:id/gallery/:imageId` below.

**Success — `200`**: the updated project document.

**Errors**: same set as `POST /api/projects`, plus `404` — `PROJECT_NOT_FOUND`.

---

### `DELETE /api/projects/:id`
**Auth**: Bearer token, Role: `admin`, `super_admin`. **Hard delete** (unlike `users`' soft-delete).

**Success — `200`**: the deleted project document.

**Errors**:
- `401` — `UNAUTHENTICATED`
- `403` — `FORBIDDEN`
- `404` — `PROJECT_NOT_FOUND`

---

### `DELETE /api/projects/:id/gallery/:imageId`
**Auth**: Bearer token, Role: `admin`, `super_admin`. `:id` is the project's MongoDB `_id`; `:imageId` is the specific gallery item's own `_id` (from that item's `_id` field in a project response). Removes only that one image — the rest of the gallery and every other field is untouched. Also best-effort deletes the asset from Cloudinary itself via its stored `publicId` (a Cloudinary-side failure here does not block the removal from the project).

**Success — `200`**: the updated project document (gallery item removed).

**Errors**:
- `401` — `UNAUTHENTICATED`
- `403` — `FORBIDDEN`
- `404` — `PROJECT_NOT_FOUND` / `GALLERY_IMAGE_NOT_FOUND`

## Uploads

### `POST /api/uploads`
**Auth**: Bearer token, Role: `admin`, `super_admin`. General-purpose Cloudinary upload — **not** used by `projects` (which uploads inline, see above); available for any future feature that just needs "upload one image, get a URL back."

**Request Body**: `multipart/form-data`, field name `image` (jpeg/png/webp/gif, ≤5MB)

**Success — `201`**:
```json
{ "success": true, "message": "Image uploaded.", "data": { "url": "https://res.cloudinary.com/.../image.jpg" } }
```

**Errors**:
- `401` — `UNAUTHENTICATED`
- `403` — `FORBIDDEN`
- `400` — `NO_FILE` / `INVALID_FILE_TYPE`

## Webhooks

### `POST /api/webhooks/clerk`
**Auth**: None (public) — verified instead via Clerk's request signature (`verifyWebhook()`, Svix-compatible headers `svix-id`/`svix-timestamp`/`svix-signature`). Called by Clerk itself, not meant to be invoked manually from Postman. Subscribed events: `user.created`, `user.updated`, `user.deleted`.

**Request Body**: raw Clerk event payload (shape depends on `type`), sent with an unparsed/raw body (this route is mounted before the global `express.json()` — see `app.js`).

**Success — `200`**:
```json
{
  "success": true,
  "data": null,
  "message": "Webhook processed."
}
```

**Errors**:
- `400` — `WEBHOOK_VERIFICATION_FAILED`, signature invalid or missing signing secret
- `422` — `MISSING_EMAIL`, the Clerk user event has no email address to sync

## Reseller

Thin wrapper around the external Hardbrain reseller API. None of these routes currently require authentication.

### `GET /api/reseller/account`
**Auth**: None

**Request Body / Params**: none

**Success — `200`**:
```json
{
  "success": true,
  "data": {}
}
```
`data` shape comes directly from the Hardbrain API's account-info response.

**Errors**:
- `500` — `INTERNAL_ERROR` if the upstream Hardbrain API call fails

---

### `GET /api/reseller/products`
**Auth**: None

**Request Body / Params**: optional query params `type`, `category` (passed through as filters)

**Success — `200`**:
```json
{
  "success": true,
  "data": []
}
```
`data` shape comes directly from the Hardbrain API's products response.

**Errors**:
- `500` — `INTERNAL_ERROR` if the upstream Hardbrain API call fails

---

### `POST /api/reseller/orders`
**Auth**: None

**Request Body**:
```json
{
  "product_id": "required",
  "customer_email": "required",
  "customer_name": "optional",
  "quantity": "optional",
  "external_reference": "optional",
  "metadata": "optional"
}
```

**Success — `201`**:
```json
{
  "success": true,
  "data": {}
}
```
`data` shape comes directly from the Hardbrain API's order-creation response.

**Errors**:
- `400` — `VALIDATION_ERROR`, missing `product_id` or `customer_email`
- `500` — `INTERNAL_ERROR` if the upstream Hardbrain API call fails
