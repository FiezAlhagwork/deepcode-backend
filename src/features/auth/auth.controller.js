import { getAuth } from "@clerk/express";
import { sendSuccess } from "../../utils/apiResponse.js";
// Cross-feature import (auth -> users), same pattern already used by
// clerk.middleware.js's requireRole (which imports getRoleByClerkId from
// here) — role/profile data is owned by `users`, `auth` only handles
// session verification.
import { getMyProfile } from "../users/user.service.js";

export const getCurrentUser = async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    const profile = await getMyProfile(userId);
    return sendSuccess(res, { userId, ...profile });
  } catch (error) {
    next(error);
  }
};
