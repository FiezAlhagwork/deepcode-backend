import { getAuth } from "@clerk/express";
import { sendSuccess } from "../../utils/apiResponse.js";
import { buildPaginationMeta } from "../../utils/pagination.js";
import { getRoleByClerkId } from "../users/user.service.js";
// Imported as a namespace (rather than named imports, like other
// controllers in this repo) purely because several service function names
// here are identical to this controller's own exported handler names
// (createProject, updateProject, deleteProject) — this avoids binding
// collisions without renaming either side away from its natural name.
import * as projectService from "./project.service.js";

const ADMIN_ROLES = ["admin", "super_admin"];

// Draft-visibility rule: these routes stay public (no requireAuth), but if a
// valid admin/super_admin session happens to be present, drafts become
// visible too. getAuth() is safe to call on any request (public or not)
// because clerkMiddleware() is mounted globally in app.js — it never
// throws, it just returns userId: null when there's no session.
const canSeeDrafts = async (req) => {
  const { userId } = getAuth(req);
  if (!userId) return false;
  const role = await getRoleByClerkId(userId);
  return ADMIN_ROLES.includes(role);
};

export const listProjects = async (req, res, next) => {
  try {
    const { page, limit, q, status, category } = req.query;
    const showDrafts = await canSeeDrafts(req);
    const { projects, total } = await projectService.listProjects(showDrafts, {
      page,
      limit,
      q,
      status,
      category,
    });
    return sendSuccess(res, projects, undefined, 200, buildPaginationMeta({ page, limit, total }));
  } catch (error) {
    next(error);
  }
};

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

// GET /api/projects/:id — :id may be either a Mongo ObjectId or a manually
// entered slug; the shape of the value decides which field it's matched
// against, so the frontend never needs two different routes for "I have the
// id" vs "I have the slug" cases.
export const getProject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const showDrafts = await canSeeDrafts(req);
    const project = OBJECT_ID_RE.test(id)
      ? await projectService.getProjectById(id, showDrafts)
      : await projectService.getProjectBySlug(id, showDrafts);
    return sendSuccess(res, project);
  } catch (error) {
    next(error);
  }
};

export const createProject = async (req, res, next) => {
  try {
    const project = await projectService.createProject(req.body);
    return sendSuccess(res, project, "Project created.", 201);
  } catch (error) {
    next(error);
  }
};

export const updateProject = async (req, res, next) => {
  try {
    const project = await projectService.updateProject(req.params.id, req.body);
    return sendSuccess(res, project, "Project updated.");
  } catch (error) {
    next(error);
  }
};

export const deleteProject = async (req, res, next) => {
  try {
    const project = await projectService.deleteProject(req.params.id);
    return sendSuccess(res, project, "Project deleted.");
  } catch (error) {
    next(error);
  }
};

export const deleteGalleryImage = async (req, res, next) => {
  try {
    const project = await projectService.removeGalleryImage(req.params.id, req.params.imageId);
    return sendSuccess(res, project, "Gallery image removed.");
  } catch (error) {
    next(error);
  }
};
