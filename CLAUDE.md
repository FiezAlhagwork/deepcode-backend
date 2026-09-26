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
      requests/                  # Server-plan requests — a local lead/CRM record, not a live Hardbrain order
        request.model.js         # snapshot of the requested product + requester's User ref
        request.service.js       # role-aware listing (admin sees all, others see only their own)
        request.controller.js
        request.routes.js
        request.validation.js
      contact/                   # Public "contact us" form — no auth, no User ref (anonymous visitor)
        contact.model.js
        contact.service.js
        contact.controller.js
        contact.routes.js        # POST is public; GET/PATCH are admin-only
        contact.validation.js    # includes the `website` honeypot field
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
      writeRateLimit.middleware.js  # shared stricter rate limiter for mutating routes
      sanitize.middleware.js    # strips Mongo operator/dotted keys from req.body
    utils/                      # ONLY shared across multiple features
      apiResponse.js            # sendSuccess / sendError helpers
      AppError.js               # custom operational error class
      pagination.js             # paginationQuerySchema / buildPaginationMeta — used by users, categories, projects
      cloudinary.js             # cloudinary.config(...) + uploadBufferToCloudinary() — used by uploads and projects
      search.js                 # buildSearchFilter() — shared ?q= free-text filter, used by users, categories, projects
      phone.js                  # phoneSchema (libphonenumber-js-backed, normalizes to E.164) — used by requests and contact
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
  - `user.deleted` (and the admin `DELETE /api/users/:id` endpoint) soft-deletes the local `User` document (`status: "deactivated"`) rather than hard-deleting it, preserving history; the Clerk-side account itself is left untouched by local removal. `deactivatedBy` (`"clerk"`/`"admin"`) records which one did it: a `"clerk"` deactivation is undone by a later sign-up with the same email, but an `"admin"` removal is sticky — no webhook, re-sign-up, or backfill ever reactivates it.
  - A `super_admin` can never change the role of / remove their own account (`409 CANNOT_MODIFY_SELF`), and the last active `super_admin` can never be demoted/removed (`409 LAST_SUPER_ADMIN`).
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
FRONTEND_URL=          # optional, defaults to http://localhost:3000; MUST be set to the real site URL in production (Clerk invitation redirect target, CORS)
CLERK_SECRET_KEY=
CLERK_PUBLISHABLE_KEY=
CLERK_WEBHOOK_SIGNING_SECRET=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

## Current Features

### ✅ `reseller` — existing, being migrated into the new structure
Wraps an external hosting/reseller API (`hardbrain-client.js`) — related to the future "server request" feature. Only `GET /api/reseller/account` and `GET /api/reseller/products` exist. `/products` is public (`Auth: None`) by design; `/account` is `admin`/`super_admin`-only (it's the site owner's own Hardbrain account info — see Decisions Log). Hardbrain failures surface as `502 UPSTREAM_ERROR`, not a generic 500. There is deliberately **no** order-creation endpoint right now — `POST /api/reseller/orders` was removed (see Decisions Log) because it had no auth and no input validation on a route that forwarded arbitrary client input straight to a billable external API. A proper order-creation flow is planned for later, built inside the admin dashboard (authenticated), not as an anonymous public endpoint.

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
- **Gallery editing is additive, never a wholesale replace**: a `PATCH` with new `gallery` files *appends* them after whatever is already saved (order continues from the current max) via an atomic `$push` in `project.service.js#updateProject` — `project.multipart.js` puts them on `req.newGalleryItems`, never on `req.body`, so there's no read-then-rewrite-the-array race; it never touches `coverImage`/existing `gallery` items it wasn't given new files for. `DELETE /api/projects/:id/gallery/:imageId` is the only way to remove one specific existing gallery image (also best-effort deletes it from Cloudinary via its stored `publicId`) — there is deliberately no "send the whole gallery array to replace it" request shape.
- `DELETE /api/projects/:id` — protected; **hard delete** (diverges from `users`' soft-delete — a project has no referential-integrity or audit-history need)
- **Cloudinary cleanup**: `coverImagePublicId` is stored alongside `coverImage` (server-set only, like `gallery[].publicId`). Replacing the cover deletes the old asset; deleting a project deletes its cover + gallery assets; and `cleanupProjectUploads` (router-level error middleware at the end of `project.routes.js`) deletes everything a failed `POST`/`PATCH` already uploaded (validation error, missing category, duplicate slug...). All best-effort via `utils/cloudinary.js#destroyCloudinaryAssets`.

### ✅ `uploads` — general-purpose Cloudinary image upload
- `POST /api/uploads` — protected (`admin`, `super_admin`); `multipart/form-data`, field name `image` (JPEG/PNG/WEBP/GIF, ≤5MB via `multer` memory storage, no disk writes); returns `{ url }` (Cloudinary `secure_url`)
- Standalone/general-purpose endpoint for any future feature that just needs "upload one image, get a URL back" — `projects` does **not** use this endpoint; it uploads its own images inline (see `projects` above and the Decisions Log)

### ✅ `auth` — Clerk session verification
`requireAuth` / `requireRole` (role lookup delegates to `users`). `GET /api/auth/me` (any authenticated user, no role restriction) returns the Clerk `userId` merged with the local profile via `user.service.js#getMyProfile`: `{ userId, synced: true, _id, email, firstName, lastName, imageUrl, role, status }` when a matching active `User` document exists, or `{ userId, synced: false }` when it doesn't yet (webhook-sync gap right after sign-up) or the local account is `deactivated` — the frontend branches on `synced` rather than treating "not synced yet" as an error.

### ✅ `users` — local user directory + role source of truth
- `GET /api/users` — paginated (`?page=&limit=`), optional `?q=` (searches `email`/`firstName`/`lastName`) and `?role=`, list active users (`admin`, `super_admin`)
- `POST /api/users` — invite a new user by email + role via Clerk Invitations API (`super_admin` only); passes `redirectUrl: ${FRONTEND_URL}/ar/accept-invitation` so the invitee lands on the frontend's accept-invitation screen instead of Clerk's default `/sign-up`
- `PATCH /api/users/:id/role` — change a user's role (`super_admin` only)
- `DELETE /api/users/:id` — soft-delete (deactivate) a user (`super_admin` only)
- `POST /api/webhooks/clerk` — Clerk webhook ingestion (`user.created`/`user.updated`/`user.deleted`), unauthenticated but signature-verified

### ✅ `requests` — server-plan requests (lead capture, not a live Hardbrain order)
A logged-in user requests a Hardbrain server plan (from `GET /api/reseller/products`); the request is stored locally as a lead for the team to follow up on manually — it is **not** forwarded to Hardbrain (that's exactly the unauthenticated flow that was removed from `reseller`; see its Decisions Log entry).
- Schema: `user` (ref to the local `User._id` — **not** the raw Clerk `clerkId`, see Decisions Log), a snapshot of the requested product (`productId`/`productName`/`productPrice`/`productBasePrice`/`billingCycle`, captured from the client's request body at submission time, not re-verified against Hardbrain), `requestType` (`purchase`/`inquiry`), `phone` (required), `notes` (optional), `status` (`pending`/`contacted`, default `pending`)
- `POST /api/requests` — any authenticated user (`requireAuth` only, no role restriction); rate-limited to 10/day, keyed by the caller's Clerk `userId` (not IP — the goal is capping one account, and IP-based keying would either over-block shared-IP legitimate users or under-block an account that just switches networks). Returns `409 ACCOUNT_NOT_SYNCED` if the caller's local `User` record hasn't synced yet (the same transient webhook-sync-gap edge case `GET /api/auth/me`'s `synced: false` already covers — retryable, not a real failure)
- `GET /api/requests` — same route serves two different views based on the caller's role, decided in `request.service.js#listRequests`, not by two separate routes: `admin`/`super_admin` see every request (paginated, optional `?status=` filter); anyone else sees only requests tied to their own local `User._id`, with that scoping enforced server-side regardless of any query params sent — same "server decides visibility" pattern `GET /api/projects` already uses for its `status` filter
- `PATCH /api/requests/:id/status` — moves a request between `pending`/`contacted` (`admin`, `super_admin` only)
- No `DELETE` (requests are kept as history, like `users`) and no email/notification integration yet — both explicitly deferred, not overlooked
- `phone` is validated/normalized by the shared `utils/phone.js#phoneSchema` (`libphonenumber-js`) — see `contact` below for the full reasoning, since that's where it was introduced

### ✅ `contact` — public "contact us" form
A site visitor submits name/email/phone/message with **no login required** — stored locally as a lead, same manual-follow-up model as `requests`, but with no `user` ref (the submitter may not have an account at all).
- Schema: `name`, `email`, `phone`, `message` (all required), `status` (`pending`/`contacted`, default `pending`)
- `POST /api/contact` — public, no auth. Rate-limited to 5/hour per IP (plain IP-based keying — there's no session to key by here, unlike `requests`' per-account limiter). Includes a `website` honeypot field in `contact.validation.js`: a real visitor's frontend never shows or fills it (kept empty/hidden via CSS), but a simple bot that auto-fills every field will. `contact.controller.js#createContactMessage` checks it *before* calling the service — if it's non-empty, the response looks like a normal `201` success, but nothing is actually created, so the bot gets no signal it was caught. Both branches return the exact same `data: null` body (the created document is never echoed back) so the two are genuinely indistinguishable.
- `GET /api/contact` / `PATCH /api/contact/:id/status` — `admin`/`super_admin` only, same paginated-list + status-lifecycle shape as `requests` (no role-branching needed here, since there's no "my messages" concept for an anonymous submitter).
- `phone` uses the same `utils/phone.js#phoneSchema` as `requests` (see Decisions Log for why) — the frontend is expected to always compose a full international number via a country-code selector, so a bare local-format number (no `+`) is rejected rather than guessed at.
- Real CAPTCHA (Cloudflare Turnstile) was deliberately deferred — it needs frontend widget integration beyond this repo's scope; honeypot is the interim defense.

## Commands

- `npm run dev` — start dev server with nodemon
- `npm start` — start production server
- `npm run backfill:users` — one-off sync of pre-existing Clerk accounts into the local `User` collection (safe to re-run)

## Decisions Log

- Chose **Clerk** over building custom auth (JWT/bcrypt) to save time — `bcryptjs` and `jsonwebtoken` were listed in `package.json` but never used anywhere in `src/`; removed during a security review (dead dependencies with no functional purpose only add unnecessary attack surface).
- Adopted a feature-based folder structure from the start of this rebuild.
- Standardized API response shape adopted project-wide from day one, not retrofitted later.
- Moved role storage from Clerk's `publicMetadata.role` to this app's own MongoDB (`features/users/user.model.js`), synced via Clerk webhooks — the owner wanted full control over who has which role from the app's own database rather than depending on Clerk metadata, with new admin accounts provisioned via Clerk email invitations.
- User removal (webhook `user.deleted` and the admin `DELETE /api/users/:id` endpoint) soft-deletes locally (`status: "deactivated"`) instead of hard-deleting or revoking the Clerk account — local role-gating and Clerk identity lifecycle are treated as separate concerns.
- `Category`/`Project` `slug` fields are entered manually by the admin (not auto-derived from `name`) for full control over the public URL. Duplicate-`slug` (or any future unique-field) violations now surface as a clean `409 DUPLICATE_KEY` via a new generic `err.code === 11000` branch in `error.middleware.js`, instead of falling through to the previous generic 500 — this is a standing, model-agnostic convention now, not a one-off fix.
- `GET /api/projects` and `GET /api/projects/:id` are public routes that conditionally reveal `draft` projects only to callers with a valid `admin`/`super_admin` Clerk session (checked directly in the controller via `getAuth()` + `getRoleByClerkId()`, no dedicated middleware) — this is the established pattern for any future "public list, admin sees more" endpoint.
- `Project` deletion is a hard delete, deliberately diverging from `users`' soft-delete convention — a project is public marketing content with no downstream references or audit-history requirement, unlike a user identity record.
- CORS's `http://localhost:3000` origin (`app.js`) only ships when `env.nodeEnv !== "production"` — kept out of the array entirely otherwise, so a production deploy can never accidentally allow a local dev origin just because it was left in a shared, unconditional list.
- **Superseded**: image uploads originally went through a dedicated `POST /api/uploads` endpoint only, with `projects` create/update staying plain JSON and referencing whatever URL that endpoint returned. The owner decided against the two-step flow — `POST /api/projects` / `PATCH /api/projects/:id` now accept `multipart/form-data` directly (`project.multipart.js`: multer `.fields()` for `coverImage`/`gallery`, uploaded to Cloudinary inline before Zod validation runs; `name`/`description`/`links` travel as JSON-string text fields since multipart can't carry nested objects/arrays; gallery `order` is simply upload order). `POST /api/uploads` still exists as a general-purpose, standalone upload endpoint for any future feature that wants the simpler "upload one image, get a URL" flow — `projects` just no longer uses it. The shared Cloudinary client/upload helper (`uploadBufferToCloudinary`) lives in `utils/cloudinary.js` since two features now use it.
- Standardized the service-layer split (`<feature>.service.js` owns all model/DB access and domain-rule validation; the controller only touches `req`/`res`) as a mandatory, project-wide pattern — `categories`/`projects` were initially built with the controller calling Mongoose models directly and were refactored to match the `reseller`/`users` precedent before any endpoint was tested, so this never shipped as an inconsistency.
- Added pagination (`utils/pagination.js`) to every list endpoint (`users`, `categories`, `projects`) with a shared `?page=&limit=` query schema and a `pagination` field returned as a sibling of `data` (not nested inside it) — chosen so `data` keeps meaning "a plain array of the resource" everywhere, with zero shape change for any existing consumer of a non-paginated response.
- Added free-text `?q=` search (`utils/search.js#buildSearchFilter`, regex-escaped and case-insensitive) plus exact-match filters (`role` on users, `status`/`category` on projects) to every list endpoint — needed once frontend integration started, since client-side filtering a single loaded page is meaningless once results are paginated; filtering has to happen server-side, in the same DB query as the pagination itself.
- Unified `GET /api/projects/:slug` into `GET /api/projects/:id`, which accepts either a Mongo `_id` or a manually entered `slug` at the same route (decided by a simple ObjectId-shape regex check in the controller, matching against `_id` or `slug` accordingly) — the frontend has legitimate cases for both ("I have the id" for admin/edit contexts, "I have the slug" for the public project-page URL), and a single route with a format check is simpler than maintaining two parallel detail endpoints. This is now the established pattern for any future "identifiable by either a Mongo id or a human-readable slug" endpoint. `categories` did **not** get the same treatment — there is no current need to fetch a category by slug, so `GET /api/categories/:id` stays a plain `_id`-only lookup.
- Redesigned gallery-image editing after it became clear `PATCH`'s original "any new `gallery` files replace the whole array" behavior was both undocumented and destructive (no way to remove a single image without re-uploading everything else you wanted to keep). New contract: `PATCH` always **appends** newly uploaded `gallery` files to the existing ones; removing one specific image is a dedicated `DELETE /api/projects/:id/gallery/:imageId`, which also best-effort deletes the asset from Cloudinary via a `publicId` now stored per gallery item (gallery items also gained their own `_id` so they're individually addressable). There is intentionally no "replace the whole gallery" request shape anymore.
- `GET /api/reseller/products` no longer returns Hardbrain's raw product order — `reseller.service.js#fetchProducts` now sorts the array ascending by `base_price` (lowest to highest) in-place before returning it, always, with no opt-out `?sort=` query param. Hardbrain's actual response envelope is `{ success, timestamp, data: { products: [...] } }` (confirmed by hitting the live API directly) — the product list is nested at `data.data.products`, not a top-level array, so `fetchProducts` locates it there (falling back to a top-level array if Hardbrain's shape ever changes) rather than assuming `data` itself is the array. This stays a thin passthrough otherwise (still no local schema/model for the product shape); the sort is the one piece of business logic this backend now applies to that endpoint.
- **Removed** `POST /api/reseller/orders` during a security review: the route had no `requireAuth`, no Zod schema on its body, and forwarded whatever the client sent straight to Hardbrain's billable order-creation API — an anonymous caller could script unlimited orders against the site owner's own Hardbrain account with no rate limiting anywhere in the app. The owner confirmed this wasn't an intentional public checkout flow and wants order-creation rebuilt later as an authenticated, admin-dashboard-only feature instead — it is not a currently-planned public endpoint, so it was deleted rather than patched. `GET /api/reseller/account` and `GET /api/reseller/products` stay public/unauthenticated by design (they're read-only and don't mutate anything on Hardbrain's side), but now sit behind their own tighter `express-rate-limit` (30 req/15min) on top of the app-wide one, since every hit proxies straight through to the billable Hardbrain API with no caching.
- Security-hardening pass (triggered by the `POST /orders` removal above): added `express-rate-limit` — a light app-wide limiter (300 req/15min per IP, `app.js`) plus the tighter reseller-specific one noted above — and `app.set("trust proxy", 1)` so `req.ip` reflects the real client once the app sits behind a reverse proxy/load balancer in production. `error.middleware.js` now also catches `multer.MulterError` (oversized file, too many files, wrong field name) and returns a proper `400`, instead of falling through to the generic `500` branch it hit before (Multer's own errors aren't `instanceof AppError`). `utils/cloudinary.js#uploadBufferToCloudinary` now re-validates an uploaded file's actual bytes via `file-type` (magic-byte sniffing) against the same `ALLOWED_IMAGE_MIME_TYPES` allow-list multer's `fileFilter` already checks — the `fileFilter` check alone only trusts the client-supplied `Content-Type` header, which is trivially spoofable, so a non-image file relabeled as `image/png` would otherwise have sailed through untouched. `project.multipart.js#normalizeProjectMultipart` now also strictly rejects any `POST`/`PATCH /api/projects` request whose `Content-Type` isn't `multipart/form-data` (previously only documented as a contract, not enforced) and unconditionally strips any client-supplied `gallery` field before repopulating it purely from that request's own upload logic — closing a path where a plain JSON body could set `gallery[].publicId` to an arbitrary value later trusted blindly by `removeGalleryImage()`'s `cloudinary.uploader.destroy(...)` call. `env.js` now warns (not fail-fast) if `NODE_ENV` isn't one of `development`/`production`/`test` (the CORS localhost-origin allowlist in `app.js` gates on `nodeEnv !== "production"`, so a typo'd `NODE_ENV` in a real prod deploy would otherwise silently leave that origin allowed) and if `FRONTEND_URL` is unset while `NODE_ENV=production` (Clerk invitation links would silently point at `localhost`). Unused `bcryptjs`/`jsonwebtoken` dependencies were removed. `npm audit fix` (no `--force`) was run and resolved all 6 then-known vulnerabilities without any major-version bump.
- Security-hardening pass, round 2 (input sanitization + tighter rate limiting, at the owner's explicit request after round 1 above): every free-text Zod field across `category.validation.js`/`project.validation.js`/`user.validation.js` now carries a `.max()` bound (names ≤200 chars, descriptions ≤2000, `links[].type` ≤50, slugs ≤100, URLs ≤2000, email ≤254) — previously unbounded, so an admin account (including a compromised one) could write an arbitrarily large string into any of these fields. Deliberately **not** paired with HTML/script sanitization (`sanitize-html` or similar) — the owner confirmed the frontend renders all of these fields as plain text (React's default auto-escaping), so there's no `dangerouslySetInnerHTML`-style stored-XSS surface to defend against here. Added `src/middlewares/writeRateLimit.middleware.js`, a shared stricter limiter (60 req/15min) applied to every mutating (`POST`/`PATCH`/`DELETE`) route across `categories`/`projects`/`users`/`uploads`, layered on top of the existing app-wide 300 req/15min limiter — these routes are already `requireAuth`/`requireRole`-gated, so this caps what a single (including compromised or scripted) account can do rather than guarding anonymous access. Added `src/middlewares/sanitize.middleware.js` (`stripMongoOperators`/`sanitizeBody`), applied globally to `req.body` right after `express.json()` in `app.js` — recursively strips any `$`-prefixed or dotted object key before any route handler sees it, as a schema-independent defense-in-depth layer against Mongo operator injection, in case a future route is ever added without full Zod coverage (as happened once already with `reseller`, before that was fixed).
- Added `requests` — the authenticated, locally-stored replacement for the order-creation flow that was removed from `reseller` (see the `POST /orders` removal entry above). Key design decisions:
  - **`request.user` references the local `User._id`, not the raw Clerk `clerkId`.** `user.service.js#upsertUser` already re-links the same local `User` document to a new `clerkId` if someone deletes their Clerk account and later signs back up with the same email (matching by email as a fallback when the new `clerkId` isn't found — see that function's own comment), so scoping by `User._id` means a caller's own request history survives that cycle automatically, with zero extra logic in `requests` itself and no new privacy exposure (it's the same identity-continuity decision the `users` feature already made). Scoping by the raw `clerkId` instead would have silently orphaned a user's request history the moment their Clerk identity changed. A new `user.service.js#getActiveUserByClerkId` (mirrors `getRoleByClerkId`) resolves the caller's session to that local doc wherever `requests` needs it.
  - **A single `GET /api/requests` route serves both "all requests" (admin) and "my requests" (everyone else)**, branching on the caller's role inside `request.service.js#listRequests` rather than two separate routes — the same "server decides visibility, ignores any client override" pattern `GET /api/projects` already established for its `status` filter, just scoping by requester identity instead of draft-visibility.
  - **The requested product's `productId`/`productName`/`productPrice`/`billingCycle` are stored as a client-submitted snapshot, not re-verified against a live `fetchProducts()` call** — the owner confirmed the request form is only ever shown immediately after the frontend already fetched that same live catalog, so there's no meaningful staleness window, and skipping the extra round-trip avoids coupling every request submission to Hardbrain's uptime/latency.
  - **`requestType` is a deliberately small fixed enum, `purchase`/`inquiry`** — finer categorization wasn't worth adding since the team resolves the specifics by contacting the requester directly, not from the form data.
  - **`POST /api/requests` is rate-limited to 10/day, keyed by the caller's Clerk `userId`** (via a custom `keyGenerator`, not the app-wide/reseller limiters' default IP-based keying) — capping a single account's submissions is what matters here, not IP volume, since legitimate users can share an IP (office/NAT) while one abusive account could otherwise just switch networks to reset an IP-based limit. Uses `express-rate-limit`'s `ipKeyGenerator` helper for its IP fallback (the library requires it for IPv6-safety whenever a custom `keyGenerator` might fall back to `req.ip`).
  - **No `DELETE` endpoint and no email/notification integration** — both explicitly deferred as future work, not overlooked; requests are kept as history like `users`, not hard-deleted like `projects`.
- Added `contact` (public "contact us" form) and, alongside it, upgraded phone-number handling project-wide:
  - **`utils/phone.js#phoneSchema` replaced the hand-rolled regex `requests` originally used for `phone`** — the regex only checked length/character-set, not whether a number was actually valid/dialable. The new schema uses `libphonenumber-js` (a self-contained library with every country's numbering-plan data built in, no external API/config needed) to reject invalid numbers and normalize every accepted one to E.164 (e.g. `+962791234567`) before it's stored, so the same number always ends up in the database in one consistent shape regardless of how the caller formatted it. It's shared (`src/utils/`) because both `requests` and `contact` now use it.
  - **A bare local-format number (no leading `+`) is rejected outright — there's no "default country" fallback.** The owner confirmed both `requests`' and `contact`'s frontends always compose a full international number via a country-code selector before submitting, so guessing a default country was unnecessary complexity for a case that shouldn't occur.
  - **`contact` has no `user` ref and no `requireAuth`** — unlike `requests`, a site visitor filling this form may not have an account at all; this is the deliberately public counterpart, not a variant of `requests`. Kept as a separate feature/model rather than extending `requests` with optional fields, since the two have almost nothing in common structurally (no product, no user) beyond the shared `pending`/`contacted` status lifecycle.
  - **`POST /api/contact` is rate-limited to 5/hour, plain IP-based** (`express-rate-limit`'s default keying, no custom `keyGenerator`) — unlike `requests`' per-account limiter, there's no authenticated identity here to key by.
  - **A `website` honeypot field** (declared in `contact.validation.js` so it survives `validate()`, checked in `contact.controller.js` before the service is ever called) is the interim bot defense — cheap, needs no frontend dependency beyond hiding one input via CSS. Real CAPTCHA (Cloudflare Turnstile) was discussed and deliberately deferred: it needs a frontend widget and a new `CLOUDFLARE_TURNSTILE_SECRET_KEY`-backed verification step, both out of scope for this pass.
- Review/bug-fix pass (owner-requested general audit):
  - **`POST /api/requests`'s per-account limiter was silently per-IP**: its `keyGenerator` read `req.auth?.userId`, but in `@clerk/express` v2 `req.auth` is a function, so that was always `undefined` and every call fell back to the IP key. Now uses `getAuth(req).userId`. Always use `getAuth(req)`, never `req.auth` directly.
  - **Admin removals are now sticky** (`User.deactivatedBy`, see Auth & Roles) — previously `upsertUser` set `status: "active"` on every event, so any `user.updated` (e.g. the user editing their Clerk profile) or a backfill run silently restored a removed user's access and role.
  - **Self-demotion / last-`super_admin` guards** added to `PATCH /api/users/:id/role` and `DELETE /api/users/:id`, which also now only act on `active` users.
  - **Global JSON 404** (`ROUTE_NOT_FOUND`) in `app.js` for unmatched routes, instead of Express's default HTML page.
  - **Project Cloudinary cleanup + atomic gallery `$push`** (see `projects` above) — previously a deleted project, replaced cover, or failed create/update left orphaned assets, and the gallery append rewrote the whole array from a stale read (a concurrent gallery-image `DELETE` could be undone, leaving a broken image link).
  - **`GET /api/reseller/account` is now `admin`/`super_admin`-only** — it exposed the site owner's Hardbrain account info to anonymous visitors with no public-site use.
  - Smaller: `writeRateLimit` added to `PATCH /api/requests/:id/status` and `PATCH /api/contact/:id/status` (they'd been missed); Clerk webhooks ack `MISSING_EMAIL` with a 200 + warning instead of a 422 Clerk would retry for days; `morgan` uses `combined` in production; `server.js` shuts down gracefully on `SIGTERM`/`SIGINT` and logs unhandled rejections; indexes on `Project` `{status, order, createdAt}` and `{category}`.
