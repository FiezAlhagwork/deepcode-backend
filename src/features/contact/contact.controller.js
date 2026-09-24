import { sendSuccess } from "../../utils/apiResponse.js";
import { buildPaginationMeta } from "../../utils/pagination.js";
import * as contactService from "./contact.service.js";

export const createContactMessage = async (req, res, next) => {
  try {
    const { website, ...data } = req.body;

    // Honeypot tripped: a real visitor never fills this (it's hidden via CSS
    // on the frontend), so a filled value means a bot. Respond with a normal
    // success so the bot has no signal it was caught, but don't actually
    // create anything.
    if (website) {
      return sendSuccess(res, null, "Message received.", 201);
    }

    const message = await contactService.createContactMessage(data);
    return sendSuccess(res, message, "Message received.", 201);
  } catch (error) {
    next(error);
  }
};

export const listContactMessages = async (req, res, next) => {
  try {
    const { page, limit, status } = req.query;
    const { messages, total } = await contactService.listContactMessages({ page, limit, status });
    return sendSuccess(res, messages, undefined, 200, buildPaginationMeta({ page, limit, total }));
  } catch (error) {
    next(error);
  }
};

export const updateContactStatus = async (req, res, next) => {
  try {
    const message = await contactService.updateContactStatus(req.params.id, req.body.status);
    return sendSuccess(res, message, "Contact message status updated.");
  } catch (error) {
    next(error);
  }
};
