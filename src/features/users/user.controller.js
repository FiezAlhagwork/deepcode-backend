import { sendSuccess } from "../../utils/apiResponse.js";
import { buildPaginationMeta } from "../../utils/pagination.js";
import { listUsers, inviteUser, updateUserRole, removeUser } from "./user.service.js";

export const getUsers = async (req, res, next) => {
  try {
    const { page, limit, q, role } = req.query;
    const { users, total } = await listUsers({ page, limit, q, role });
    return sendSuccess(res, users, undefined, 200, buildPaginationMeta({ page, limit, total }));
  } catch (error) {
    next(error);
  }
};

export const createInvitedUser = async (req, res, next) => {
  try {
    const { email, role } = req.body;
    const invitation = await inviteUser({ email, role });
    return sendSuccess(res, invitation, "Invitation sent.", 201);
  } catch (error) {
    next(error);
  }
};

export const patchUserRole = async (req, res, next) => {
  try {
    const user = await updateUserRole(req.params.id, req.body.role);
    return sendSuccess(res, user, "Role updated.");
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const user = await removeUser(req.params.id);
    return sendSuccess(res, user, "User removed.");
  } catch (error) {
    next(error);
  }
};
