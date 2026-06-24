import { ROLES } from '../config/constants.js';

/**
 * Resolve the organization a request operates on.
 * - CEO / USER: always their own organization (cannot be overridden).
 * - ADMIN: must specify via ?organizationId, body.organization, or x-organization-id header.
 * Returns the org id (string/ObjectId) or null if it cannot be resolved.
 */
export const resolveOrgId = (req) => {
  if (req.user.role === ROLES.ADMIN) {
    return (
      req.query.organizationId ||
      req.body?.organization ||
      req.headers['x-organization-id'] ||
      null
    );
  }
  const org = req.user.organization;
  return org?._id || org || null;
};

/** Same as resolveOrgId but throws a 400 when no org is available. */
export const requireOrgId = (req, res) => {
  const id = resolveOrgId(req);
  if (!id) {
    res.status(400);
    throw new Error('No organization selected for this request');
  }
  return id;
};
