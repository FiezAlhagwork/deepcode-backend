import { getAuth } from "@clerk/express";
import { sendSuccess } from "../../utils/apiResponse.js";

export const getCurrentUser = (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    return sendSuccess(res, { userId });
  } catch (error) {
    next(error);
  }
};
