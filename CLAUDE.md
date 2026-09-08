# CLAUDE.md

Guidance for Claude (or any AI assistant) working on this backend. Follow these conventions consistently — do not introduce new patterns without updating this file first.

## Project Overview

Backend for the company website. Currently a marketing site (hero, about, team, servers, pricing, projects, social links) that is being extended with admin-managed functionality. **Projects management** (bilingual projects grouped by category, with Cloudinary-backed image uploads) has shipped, restricted to `super_admin` and `admin` roles for write access.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express 5
- **Database**: MongoDB via Mongoose
- **Validation**: Zod
- **Auth**: Clerk (identity/session only — login, sign-up, session verification). Role (`super_admin`/`admin`/`user`) is **not** stored in Clerk; it lives in this app's own MongoDB, kept in sync via Clerk webhooks. See "Auth & Roles" below.
- **Module system**: ES Modules only (`"type": "module"` in package.json) — always use `import`/`export`, never `require`
- **Dev tooling**: nodemon

## Folder Structure — Feature-Based

The project is migrating from a type-based structure (`controllers/`, `routes/`, `services/`) to a **feature-based** structure. Every domain concept gets its own folder under `src/features/` containing everything related to it.

```
backend/
  src/
    config/
      env.js
      db.js                     # Mongoose connection
    features/
      categories/                # Groups projects; slug entered manually by the admin
        category.model.js
        category.service.js      # all Category/Project-model queries + the in-use delete guard
        category.controller.js
        category.routes.js
        category.validation.js
      projects/
        project.model.js         # bilingual name/description, gallery/links arrays, category ref
        project.service.js       # all Project-model queries, draft-visibility filtering, category-exists check
        project.multipart.js     # multer fields (coverImage/gallery) + Cloudinary upload + JSON-field parsing, runs before validate()
        project.controller.js
        project.routes.js
        project.validation.js    # Zod schemas
      uploads/                   # general-purpose Cloudinary upload endpoint (not used by projects anymore)
        upload.controller.js
        upload.routes.js         # POST /api/uploads (multipart, field "image") -> { url }
      reseller/                 # Existing feature — migrated here
        reseller.controller.js
        reseller.routes.js
        reseller.service.js     # was services/hardbrain.js
        hardbrain-client.js     # was utils/hardbrain-client.js
      auth/                     # Clerk session verification ONLY (no role logic)
        clerk.middleware.js     # requireAuth / requireRole (role lookup delegates to features/users/)
        auth.controller.js      # GET /api/auth/me
        auth.routes.js
      users/                    # Local user directory — role source of truth
        user.model.js           # Mongoose model: clerkId, email, name, role, status
        user.service.js         # upsertUserFromClerkEvent, getRoleByClerkId, invite/list/update/remove
        user.validation.js      # Zod schemas
        user.controller.js      # admin CRUD: list / invite / update-role / remove
        user.routes.js          # mounted at /api/users
        webhook.controller.js   # Clerk webhook ingestion (user.created/updated/deleted)
        webhook.routes.js       # mounted at /api/webhooks — BEFORE global express.json()
    middlewares/                # ONLY truly shared/global middleware
      error.middleware.js
      validate.middleware.js    # generic Zod-validation middleware
    utils/                      # ONLY shared across multiple features
      apiResponse.js            # sendSuccess / sendError helpers
      AppError.js               # custom operational error class
      pagination.js             # paginationQuerySchema / buildPaginationMeta — used by users, categories, projects
      cloudinary.js             # cloudinary.config(...) + uploadBufferToCloudinary() — used by uploads and projects
      search.js                 # buildSearchFilter() — shared ?q= free-text filter, used by users, categories, projects
    scripts/
      backfill-users.js         # one-off: syncs pre-existing Clerk accounts into User (npm run backfill:users)
    app.js
    server.js
  .env
  package.json
```

**Rule**: if a file is only used by one feature, it lives inside that feature's folder. It only goes into `middlewares/` or `utils/` if at least two features use it.

## Naming Conventions

- kebab-case-free, suffix-based file names matching the existing style:
  `<feature>.model.js`, `<feature>.controller.js`, `<feature>.routes.js`, `<feature>.validation.js`
- One Mongoose model per feature file, defined and exported from within that feature's folder.

## Service Layer (mandatory — every feature that touches a database or external API)

- Every feature whose controller needs to talk to a Mongoose model (or an external API/client) defines a `<feature>.service.js` that owns **all** of that data access — the controller never imports or calls a Model (or `axios`/an external client) directly.
- The service layer holds domain/business-rule logic too, not just raw queries — e.g. `category.service.js#deleteCategory` checks whether any `Project` still references the category before deleting, and `project.service.js#createProject`/`updateProject` validate that a referenced `category` actually exists. Throw `AppError` from *within* the service for these domain-rule failures (not-found, conflict, etc.) — the controller's `catch` block still just does `next(error)`.
- The controller's only job is: pull what it needs off `req`, call the service, and format the result via `sendSuccess`/`next(err)`. No `Model.find(...)`, `Model.create(...)`, etc. inside a controller file, ever.
- Naming: service functions usually share the natural domain-operation name (`listUsers`, `createProject`, `deleteCategory`, ...). When a controller's own exported handler needs the same name as its service's function (e.g. `project.controller.js`'s `createProject` route handler vs. `project.service.js`'s `createProject`), import that service as a namespace (`import * as projectService from "./project.service.js"`) instead of renaming either side — see `project.controller.js`/`category.controller.js` for the pattern, and `user.controller.js`/`user.service.js` for the alternative (naturally distinct names, e.g. `removeUser` in the service vs. `deleteUser` in the controller) when the names don't collide.
- Existing examples to copy from: `reseller.service.js`, `user.service.js`, `category.service.js`, `project.service.js`.

## API Response Format (mandatory, applies to every endpoint)

**Success:**
```json
{
  "success": true,
  "data": {},
  "message": "optional human-readable message",
  "pagination": "optional — only on paginated list endpoints, see below"
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "message": "Human-readable error message",
    "code": "OPTIONAL_MACHINE_READABLE_CODE"
  }
}
```

- Use `utils/apiResponse.js` → `sendSuccess(res, data, message?, statusCode = 200)` in every controller for success responses.
- Never build error responses manually in a controller. Throw an `AppError(message, statusCode, code?)` and call `next(err)` — the central `error.middleware.js` formats the final JSON.

**Pagination (mandatory for any list/collection endpoint)**: apply `validate(paginationQuerySchema, "query")` (from `utils/pagination.js`) on the route to accept `?page=&limit=` (defaults `1`/`10`, `limit` capped at `100`). The service's list function takes `{page, limit}` and returns `{<items>, total}`; the controller calls `sendSuccess(res, items, undefined, 200, buildPaginationMeta({page, limit, total}))` — `pagination` is a sibling field next to `data`, never nested inside it, so `data` stays a plain array everywhere. Existing examples: `GET /api/users`, `GET /api/categories`, `GET /api/projects`. Single-resource endpoints (`GET /api/projects/:slug`, etc.) never paginate.

**Filtering & search**: a list endpoint's Zod query schema extends `paginationQuerySchema` (via `.extend({...})`) to add its own filters instead of duplicating page/limit — see `listUsersQuerySchema`, `listCategoriesQuerySchema`, `listProjectsQuerySchema`. Free-text search across multiple fields uses the shared `buildSearchFilter(fields, q)` from `utils/search.js` (case-insensitive regex `$or`, regex-escaped, returns `{}` when `q` is absent so it's always safe to spread into a Mongo filter). Exact-match filters (`role` on users, `status`/`category` on projects) are merged in by the service alongside it. `status` on `GET /api/projects` is a narrowing filter only for a caller who can already see drafts (`admin`/`super_admin`) — a public caller can never use `?status=draft` to see unpublished content; the service silently ignores `status` for them rather than erroring, to avoid confirming/denying anything about hidden content.

## Auth & Roles

- Clerk handles login/session/identity **only**. This app does **not** implement its own login, password hashing, or JWT issuing, and does **not** store role in Clerk.
- Roles: `super_admin`, `admin`, `user` — the source of truth is this app's own MongoDB, in the `User` model (`src/features/users/user.model.js`), keyed by Clerk's user id (`clerkId`). Clerk's `publicMetadata.role` is only ever read once, as a hint at account-creation time (see below).
- **How roles get set:**
  - Self-service sign-up (Clerk's normal hosted flow) fires a `user.created` webhook → the app creates a local `User` document with `role: "user"`.
  - Admin-invited users: a `super_admin` calls `POST /api/users` with `{ email, role }`, which calls Clerk's Invitations API (`clerkClient.invitations.createInvitation`) with `publicMetadata: { role }`. When the invitee completes sign-up, Clerk copies that metadata onto the new user, so the `user.created` webhook's `data.public_metadata.role` carries the intended role.
  - Bootstrapping the first `super_admin` is a one-time **manual MongoDB edit** (flip that document's `role` directly) — not an API/UI flow, by design.
  - `user.updated` re-syncs mirrored profile fields (email/name/image) but **never** touches `role` — role only ever changes via this app's own admin endpoint (`PATCH /api/users/:id/role`).
  - `user.deleted` (and the admin `DELETE /api/users/:id` endpoint) soft-deletes the local `User` document (`status: "deactivated"`) rather than hard-deleting it, preserving history; the Clerk-side account itself is left untouched by local removal.
- Only `super_admin` can invite/change-role/remove users. Both `admin` and `super_admin` can list users (view-only for `admin`).
- Route protection lives in `features/auth/clerk.middleware.js`, exposing:
  - `requireAuth` — verifies the Clerk session exists
  - `requireRole(...roles)` — looks up the caller's role from the local `User` collection via `features/users/user.service.js#getRoleByClerkId`. A missing/deactivated local record is treated as "no role" (403).
- Apply both as route-level middleware, e.g. `router.post('/', requireAuth, requireRole('admin', 'super_admin'), createProject)`.
- Clerk webhooks are ingested at `POST /api/webhooks/clerk` (`src/features/users/webhook.routes.js` + `webhook.controller.js`), verified via `@clerk/express/webhooks`'s `verifyWebhook()`. This route receives the **raw** request body (mounted before the global `express.json()` in `app.js`) — signature verification requires the exact bytes Clerk signed.

## Error Handling

- All errors flow through the single central `src/middlewares/error.middleware.js`.
- Use the `AppError` class for expected/operational errors (validation failures, not-found, forbidden, etc.) with a clear `statusCode`.
- Unexpected errors (bugs, DB down, etc.) are caught by the same middleware and returned as a generic 500 without leaking internals.
- Controllers must never respond directly inside a `catch` block — always `next(err)`.

## Validation

- Every feature that accepts user input defines its Zod schemas in `<feature>.validation.js`.
- Apply via the shared `middlewares/validate.middleware.js(schema)`, which throws an `AppError` (400) with the Zod issues formatted into the standard error shape on failure.

## Database

- Single Mongoose connection established in `src/config/db.js`, invoked once from `server.js` at startup.
- Required env var: `MONGODB_URI`.

## Environment Variables (expected in `.env`)

```
PORT=
MONGODB_URI=
CLERK_SECRET_KEY=
CLERK_PUBLISHABLE_KEY=
CLERK_WEBHOOK_SIGNING_SECRET=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

## Current Features

### ✅ `reseller` — existing, being migrated into the new structure
Wraps an external hosting/reseller API (`hardbrain-client.js`) — related to the future "server request" feature.

### ✅ `categories` — groups projects
- `GET /api/categories` — public, paginated (`?page=&limit=`), optional `?q=` free-text search across `name.ar`/`name.en`/`slug`, list all categories
- `GET /api/categories/:id` — public, single category by `_id` only (no slug lookup — there's no current need to fetch a category by slug)
- `POST /api/categories` / `PATCH /api/categories/:id` — protected (`admin`, `super_admin`)
- `DELETE /api/categories/:id` — protected; rejects with `409 CATEGORY_IN_USE` if any `Project` still references it (no cascade, no force-delete)
- `slug` is entered manually by the admin (not auto-derived from `name`), validated as lowercase kebab-case and unique

### ✅ `projects` — bilingual projects shown on the public website
- Schema: `name`/`description` (`{ar, en}`), `slug` (manual, unique), `coverImage` (URL), `gallery` (`[{image, publicId, order}]`, own `_id` per item), `links` (`[{type, url}]`, `type` free-form), `category` (ref, required), `status` (`draft`/`published`, default `draft`), `order` (manual, default `0`)
- `GET /api/projects` (list, paginated `?page=&limit=`, optional `?q=`/`?status=`/`?category=`) and `GET /api/projects/:id` (detail, not paginated) — public, but **draft-visibility is session-aware**: a caller with a valid `admin`/`super_admin` Clerk session sees `draft` projects too (and may narrow further with `?status=`); everyone else only sees `published` ones regardless of any `?status=` they pass, and a draft's detail page 404s exactly like a nonexistent id/slug (no existence leak). Implemented directly in `project.controller.js` via `getAuth()` + `getRoleByClerkId()` — no dedicated middleware.
- `GET /api/projects/:id` accepts **either** a Mongo `_id` **or** a manually entered `slug`, at the same route: the controller tests the param against `/^[0-9a-fA-F]{24}$/` — a match looks it up by `_id` (`project.service.js#getProjectById`), anything else looks it up by `slug` (`getProjectBySlug`). Both delegate to the same internal `findVisibleProject` helper so the draft-visibility/404 rule above stays identical either way. Chosen so the frontend never needs two separate routes for "I already have the id" (e.g. an admin edit link) vs. "I only have the slug" (the public project page URL).
- `POST /api/projects` / `PATCH /api/projects/:id` — protected (`admin`, `super_admin`); `multipart/form-data`, **not** plain JSON: `coverImage` and `gallery` are real image files (uploaded to Cloudinary inline by `project.multipart.js` before validation runs), while `name`/`description`/`links` are sent as JSON-string text fields (multipart can't carry nested objects/arrays) and `slug`/`category`/`status`/`order` are plain text fields. Also validates that the referenced `category` actually exists (`404 CATEGORY_NOT_FOUND` otherwise).
- **Gallery editing is additive, never a wholesale replace**: a `PATCH` with new `gallery` files *appends* them after whatever is already saved (order continues from the current max); it never touches `coverImage`/existing `gallery` items it wasn't given new files for. `DELETE /api/projects/:id/gallery/:imageId` is the only way to remove one specific existing gallery image (also best-effort deletes it from Cloudinary via its stored `publicId`) — there is deliberately no "send the whole gallery array to replace it" request shape.
- `DELETE /api/projects/:id` — protected; **hard delete** (diverges from `users`' soft-delete — a project has no referential-integrity or audit-history need)

### ✅ `uploads` — general-purpose Cloudinary image upload
- `POST /api/uploads` — protected (`admin`, `super_admin`); `multipart/form-data`, field name `image` (JPEG/PNG/WEBP/GIF, ≤5MB via `multer` memory storage, no disk writes); returns `{ url }` (Cloudinary `secure_url`)
- Standalone/general-purpose endpoint for any future feature that just needs "upload one image, get a URL back" — `projects` does **not** use this endpoint; it uploads its own images inline (see `projects` above and the Decisions Log)

### ✅ `auth` — Clerk session verification
`requireAuth` / `requireRole` (role lookup delegates to `users`). `GET /api/auth/me` returns the current session's Clerk `userId`.

### ✅ `users` — local user directory + role source of truth
- `GET /api/users` — paginated (`?page=&limit=`), optional `?q=` (searches `email`/`firstName`/`lastName`) and `?role=`, list active users (`admin`, `super_admin`)
- `POST /api/users` — invite a new user by email + role via Clerk Invitations API (`super_admin` only)
- `PATCH /api/users/:id/role` — change a user's role (`super_admin` only)
- `DELETE /api/users/:id` — soft-delete (deactivate) a user (`super_admin` only)
- `POST /api/webhooks/clerk` — Clerk webhook ingestion (`user.created`/`user.updated`/`user.deleted`), unauthenticated but signature-verified

## Commands

- `npm run dev` — start dev server with nodemon
- `npm start` — start production server
- `npm run backfill:users` — one-off sync of pre-existing Clerk accounts into the local `User` collection (safe to re-run)

## Decisions Log

- Chose **Clerk** over building custom auth (JWT/bcrypt) to save time — `bcryptjs` and `jsonwebtoken` in `package.json` are currently unused and candidates for future removal.
- Adopted a feature-based folder structure from the start of this rebuild.
- Standardized API response shape adopted project-wide from day one, not retrofitted later.
- Moved role storage from Clerk's `publicMetadata.role` to this app's own MongoDB (`features/users/user.model.js`), synced via Clerk webhooks — the owner wanted full control over who has which role from the app's own database rather than depending on Clerk metadata, with new admin accounts provisioned via Clerk email invitations.
- User removal (webhook `user.deleted` and the admin `DELETE /api/users/:id` endpoint) soft-deletes locally (`status: "deactivated"`) instead of hard-deleting or revoking the Clerk account — local role-gating and Clerk identity lifecycle are treated as separate concerns.
- `Category`/`Project` `slug` fields are entered manually by the admin (not auto-derived from `name`) for full control over the public URL. Duplicate-`slug` (or any future unique-field) violations now surface as a clean `409 DUPLICATE_KEY` via a new generic `err.code === 11000` branch in `error.middleware.js`, instead of falling through to the previous generic 500 — this is a standing, model-agnostic convention now, not a one-off fix.
- `GET /api/projects` and `GET /api/projects/:slug` are public routes that conditionally reveal `draft` projects only to callers with a valid `admin`/`super_admin` Clerk session (checked directly in the controller via `getAuth()` + `getRoleByClerkId()`, no dedicated middleware) — this is the established pattern for any future "public list, admin sees more" endpoint.
- `Project` deletion is a hard delete, deliberately diverging from `users`' soft-delete convention — a project is public marketing content with no downstream references or audit-history requirement, unlike a user identity record.
- **Superseded**: image uploads originally went through a dedicated `POST /api/uploads` endpoint only, with `projects` create/update staying plain JSON and referencing whatever URL that endpoint returned. The owner decided against the two-step flow — `POST /api/projects` / `PATCH /api/projects/:id` now accept `multipart/form-data` directly (`project.multipart.js`: multer `.fields()` for `coverImage`/`gallery`, uploaded to Cloudinary inline before Zod validation runs; `name`/`description`/`links` travel as JSON-string text fields since multipart can't carry nested objects/arrays; gallery `order` is simply upload order). `POST /api/uploads` still exists as a general-purpose, standalone upload endpoint for any future feature that wants the simpler "upload one image, get a URL" flow — `projects` just no longer uses it. The shared Cloudinary client/upload helper (`uploadBufferToCloudinary`) lives in `utils/cloudinary.js` since two features now use it.
- Standardized the service-layer split (`<feature>.service.js` owns all model/DB access and domain-rule validation; the controller only touches `req`/`res`) as a mandatory, project-wide pattern — `categories`/`projects` were initially built with the controller calling Mongoose models directly and were refactored to match the `reseller`/`users` precedent before any endpoint was tested, so this never shipped as an inconsistency.
- Added pagination (`utils/pagination.js`) to every list endpoint (`users`, `categories`, `projects`) with a shared `?page=&limit=` query schema and a `pagination` field returned as a sibling of `data` (not nested inside it) — chosen so `data` keeps meaning "a plain array of the resource" everywhere, with zero shape change for any existing consumer of a non-paginated response.
- Added free-text `?q=` search (`utils/search.js#buildSearchFilter`, regex-escaped and case-insensitive) plus exact-match filters (`role` on users, `status`/`category` on projects) to every list endpoint — needed once frontend integration started, since client-side filtering a single loaded page is meaningless once results are paginated; filtering has to happen server-side, in the same DB query as the pagination itself.
- Unified `GET /api/projects/:slug` into `GET /api/projects/:id`, which accepts either a Mongo `_id` or a manually entered `slug` at the same route (decided by a simple ObjectId-shape regex check in the controller, matching against `_id` or `slug` accordingly) — the frontend has legitimate cases for both ("I have the id" for admin/edit contexts, "I have the slug" for the public project-page URL), and a single route with a format check is simpler than maintaining two parallel detail endpoints. This is now the established pattern for any future "identifiable by either a Mongo id or a human-readable slug" endpoint. `categories` did **not** get the same treatment — there is no current need to fetch a category by slug, so `GET /api/categories/:id` stays a plain `_id`-only lookup.
- Redesigned gallery-image editing after it became clear `PATCH`'s original "any new `gallery` files replace the whole array" behavior was both undocumented and destructive (no way to remove a single image without re-uploading everything else you wanted to keep). New contract: `PATCH` always **appends** newly uploaded `gallery` files to the existing ones; removing one specific image is a dedicated `DELETE /api/projects/:id/gallery/:imageId`, which also best-effort deletes the asset from Cloudinary via a `publicId` now stored per gallery item (gallery items also gained their own `_id` so they're individually addressable). There is intentionally no "replace the whole gallery" request shape anymore.
