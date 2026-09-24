import { getAuth } from "@clerk/express";
import { sendSuccess } from "../../utils/apiResponse.js";
import { buildPaginationMeta } from "../../utils/pagination.js";
import { getActiveUserByClerkId } from "../users/user.service.js";
import * as requestService from "./request.service.js";

export const createRequest = async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    const request = await requestService.createRequest(userId, req.body);
    return sendSuccess(res, request, "Request submitted.", 201);
  } catch (error) {
    next(error);
  }
};

// Same route for "all requests" (admin/super_admin) and "my requests"
// (everyone else) — which one the caller gets back is decided from their
// role inside request.service.js#listRequests, not by two separate routes.
export const listRequests = async (req, res, next) => {
  try {
    const { page, limit, status } = req.query;
    const { userId } = getAuth(req);
    const caller = await getActiveUserByClerkId(userId);
    const { requests, total } = await requestService.listRequests(caller, { page, limit, status });
    return sendSuccess(res, requests, undefined, 200, buildPaginationMeta({ page, limit, total }));
  } catch (error) {
    next(error);
  }
};

export const updateRequestStatus = async (req, res, next) => {
  try {
    const request = await requestService.updateRequestStatus(req.params.id, req.body.status);
    return sendSuccess(res, request, "Request status updated.");
  } catch (error) {
    next(error);
  }
};
