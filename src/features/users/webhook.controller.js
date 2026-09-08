import { verifyWebhook } from "@clerk/express/webhooks";
import { env } from "../../config/env.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { AppError } from "../../utils/AppError.js";
import { upsertUserFromClerkEvent, deleteUserByClerkId } from "./user.service.js";

export const handleClerkWebhook = async (req, res, next) => {
  let event;

  try {
    event = await verifyWebhook(req, { signingSecret: env.clerk.webhookSigningSecret });
  } catch (error) {
    // Clerk is the caller here, not a logged-in user — there's no session to
    // build a 401/403 around. An unverifiable signature is a bad request
    // from Clerk's side, so 400 is correct. Still routed through AppError ->
    // error.middleware.js so the response shape + logging stay uniform.
    return next(
      new AppError("Webhook signature verification failed.", 400, "WEBHOOK_VERIFICATION_FAILED"),
    );
  }

  try {
    switch (event.type) {
      case "user.created":
      case "user.updated":
        await upsertUserFromClerkEvent(event.data);
        break;
      case "user.deleted":
        await deleteUserByClerkId(event.data.id);
        break;
      default:
        break; // ignore event types we didn't subscribe to
    }

    return sendSuccess(res, null, "Webhook processed."); // fast 2xx ack
  } catch (error) {
    next(error);
  }
};
