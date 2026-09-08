import { getAuth } from "@clerk/express";
import { AppError } from "../../utils/AppError.js";
import { getRoleByClerkId } from "../users/user.service.js";

/**
 * Verifies a Clerk session exists on the request. Must run after the
 * global `clerkMiddleware()` (see app.js). Throws through the standard
 * AppError -> error.middleware.js pipeline instead of relying on Clerk's
 * own default 401 response, so the response shape stays consistent with
 * every other endpoint in the app.
 */
export const requireAuth = (req, res, next) => {
  const { userId } = getAuth(req);

  if (!userId) {
    return next(new AppError("Authentication required.", 401, "UNAUTHENTICATED"));
  }

  next();
};

/**
 * Restricts a route to one or more roles. Role is owned by this app's own
 * MongoDB (see features/users/), not Clerk's publicMetadata — looked up via
 * getRoleByClerkId. Re-checks `userId` defensively in case this is ever
 * applied without `requireAuth` chained first.
 */
export const requireRole = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      const { userId } = getAuth(req);

      if (!userId) {
        return next(new AppError("Authentication required.", 401, "UNAUTHENTICATED"));
      }

      const role = await getRoleByClerkId(userId);

      if (!role || !allowedRoles.includes(role)) {
        return next(
          new AppError("You do not have permission to perform this action.", 403, "FORBIDDEN"),
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
