import { AppError } from "../../utils/AppError.js";
import { getActiveUserByClerkId } from "../users/user.service.js";
import { Request } from "./request.model.js";

const ADMIN_ROLES = ["admin", "super_admin"];

export const createRequest = async (clerkId, data) => {
  const requester = await getActiveUserByClerkId(clerkId);
  if (!requester) {
    // Same "webhook sync gap" edge case GET /api/auth/me already handles via
    // `synced: false` — here it has to be an actual error, since a request
    // can't be created without something to attribute it to, but it's a
    // transient, retryable state, not a real failure.
    throw new AppError(
      "Your account is still syncing. Please try again in a moment.",
      409,
      "ACCOUNT_NOT_SYNCED",
    );
  }

  return Request.create({ user: requester._id, ...data });
};

// `caller` is the local User doc for the requesting session (or `null` if
// their account hasn't synced locally yet — see createRequest above). Admins
// see every request; anyone else sees only their own, and that scoping is
// enforced here regardless of any query params the client sends — the same
// "server decides visibility, not the request" pattern project.service.js
// uses for GET /api/projects's `status` filter.
export const listRequests = async (caller, { page, limit, status }) => {
  const isAdmin = caller && ADMIN_ROLES.includes(caller.role);

  const filter = {
    ...(status && { status }),
    ...(isAdmin ? {} : { user: caller?._id ?? null }),
  };

  const skip = (page - 1) * limit;
  const [requests, total] = await Promise.all([
    Request.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("user", "email firstName lastName")
      .lean(),
    Request.countDocuments(filter),
  ]);
  return { requests, total };
};

export const updateRequestStatus = async (id, status) => {
  const request = await Request.findByIdAndUpdate(id, { status }, { new: true });
  if (!request) throw new AppError("Request not found.", 404, "REQUEST_NOT_FOUND");
  return request;
};
