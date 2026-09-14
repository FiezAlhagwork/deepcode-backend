import { clerkClient } from "@clerk/express";
import { User } from "./user.model.js";
import { AppError } from "../../utils/AppError.js";
import { buildSearchFilter } from "../../utils/search.js";
import { env } from "../../config/env.js";

const primaryEmailFrom = (userJson) => {
  const primary = userJson.email_addresses?.find(
    (e) => e.id === userJson.primary_email_address_id,
  );
  return (primary ?? userJson.email_addresses?.[0])?.email_address ?? null;
};

/**
 * Low-level upsert, decoupled from Clerk's specific payload shape — reused
 * by both the webhook adapter below and the backfill script, which receives
 * a differently-shaped SDK `User` object (camelCase), not the webhook's
 * `UserJSON` (snake_case). `role` is intentionally never overwritten on an
 * existing document — role is owned by this app from the moment a user
 * first gets created locally, not by whatever Clerk's public_metadata
 * happens to say later.
 *
 * Matching prefers `clerkId` (the primary identity key), but falls back to
 * `email` if no doc has that clerkId yet. This handles someone deleting
 * their Clerk account and signing back up with the same email: Clerk treats
 * that as a brand-new identity (a new clerkId), but from this app's
 * perspective it's the same person returning — so the existing local record
 * gets re-linked to the new clerkId and reactivated instead of a
 * disconnected duplicate being created, which would otherwise silently
 * reset their role back to "user".
 */
export const upsertUser = async ({ clerkId, email, firstName, lastName, imageUrl, role }) => {
  const existing = (await User.findOne({ clerkId })) ?? (await User.findOne({ email }));

  const profileFields = {
    clerkId,
    email,
    firstName,
    lastName,
    imageUrl,
    status: "active", // any fresh event/backfill hit reactivates a soft-deleted doc
    lastSyncedAt: new Date(),
  };

  if (existing) {
    existing.set(profileFields);
    return existing.save();
  }

  return User.create({ role: role ?? "user", ...profileFields });
};

// Webhook adapter: user.created / user.updated (raw Clerk UserJSON, snake_case).
export const upsertUserFromClerkEvent = async (userJson) => {
  const email = primaryEmailFrom(userJson);

  if (!email) {
    throw new AppError(
      `Clerk user ${userJson.id} has no email address to sync.`,
      422,
      "MISSING_EMAIL",
    );
  }

  return upsertUser({
    clerkId: userJson.id,
    email,
    firstName: userJson.first_name,
    lastName: userJson.last_name,
    imageUrl: userJson.image_url,
    role: userJson.public_metadata?.role, // only applied on first-create; see upsertUser
  });
};

// Soft-delete: revokes local role/access immediately without touching the
// Clerk identity itself — deleting a Clerk account entirely is a separate,
// more destructive action left to the Clerk Dashboard if truly needed.
export const deleteUserByClerkId = (clerkId) =>
  User.findOneAndUpdate({ clerkId }, { status: "deactivated" });

export const getRoleByClerkId = async (clerkId) => {
  const user = await User.findOne({ clerkId, status: "active" }).select("role").lean();
  return user?.role ?? null;
};

// Backs GET /api/auth/me: returns the full local profile (including role)
// for the calling Clerk session, or `{ synced: false }` if no active local
// record exists yet — e.g. a webhook-sync gap right after sign-up, or a
// deactivated account. Deliberately not an AppError/404: "not synced yet" is
// a normal, expected state the frontend needs to branch on, not a failure.
export const getMyProfile = async (clerkId) => {
  const user = await User.findOne({ clerkId, status: "active" }).lean();
  if (!user) return { synced: false };
  return {
    synced: true,
    _id: user._id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    imageUrl: user.imageUrl,
    role: user.role,
    status: user.status,
  };
};

export const listUsers = async ({ page, limit, q, role }) => {
  const filter = {
    status: "active",
    ...(role && { role }),
    ...buildSearchFilter(["email", "firstName", "lastName"], q),
  };
  const skip = (page - 1) * limit;
  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  return { users, total };
};

export const inviteUser = async ({ email, role }) => {
  try {
    return await clerkClient.invitations.createInvitation({
      emailAddress: email,
      publicMetadata: { role },
      // Without this, Clerk sends the invitee to its default /sign-up page
      // instead of the frontend's dedicated accept-invitation screen.
      redirectUrl: `${env.frontendUrl}/ar/accept-invitation`,
    });
  } catch (error) {
    throw new AppError(
      error?.errors?.[0]?.longMessage || "Failed to send Clerk invitation.",
      502,
      "CLERK_INVITE_FAILED",
    );
  }
};

export const updateUserRole = async (id, role) => {
  const user = await User.findByIdAndUpdate(id, { role }, { new: true });
  if (!user) throw new AppError("User not found.", 404, "USER_NOT_FOUND");
  return user;
};

export const removeUser = async (id) => {
  const user = await User.findById(id);
  if (!user) throw new AppError("User not found.", 404, "USER_NOT_FOUND");
  user.status = "deactivated";
  return user.save();
};
