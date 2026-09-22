"use strict";

// Startup permission sync — the fix for "403 on routes that used to work".
//
// When a new permission key is added to the registry
// (packages/constants/src/permissions.js), databases seeded BEFORE that
// change have no Permission document and no RolePermission rows for it, so
// even SUPER_ADMIN gets 403 on the new routes. Re-running the old seeder
// fixed the 403 but also overwrote every admin-customised toggle back to
// defaults.
//
// This sync only ever INSERTS what is missing and never touches existing
// rows, so it is safe to run on every API boot (server.js) and from the
// seeder. After it runs it clears the Redis permission cache so the new
// grants take effect immediately.

const { Role } = require("./models/Role");
const { Permission, RolePermission } = require("./models/Permission");
const { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } = require("@ananta/constants");
const { ROLE_KEYS } = require("@ananta/shared-types");
const { logger } = require("../config/logger");

async function invalidateRoleCaches() {
  try {
    // Required lazily: unit tests sync nothing and should not need Redis.
    // eslint-disable-next-line global-require
    const { redis } = require("../config/redis");
    const keys = ROLE_KEYS.map((roleKey) => `role_permissions:${roleKey}`);
    if (keys.length > 0) await redis.del(...keys);
  } catch (err) {
    logger.warn({ err }, "Permission cache invalidation failed (non-fatal)");
  }
}

async function syncPermissions() {
  // 1. Every registry permission must exist as a document (upsert is safe:
  //    it only refreshes group/description text, never anyone's toggles).
  const permissionDocs = new Map();
  for (const p of PERMISSIONS) {
    const doc = await Permission.findOneAndUpdate(
      { key: p.key },
      { $set: { key: p.key, group: p.group, description: p.description } },
      { upsert: true, new: true }
    );
    permissionDocs.set(p.key, doc);
  }

  // 2. Every role must have a row for every permission. $setOnInsert means
  //    only MISSING rows are created (with that role's default); rows the
  //    admin already toggled keep their current `enabled` value.
  let inserted = 0;
  for (const roleKey of ROLE_KEYS) {
    const role = await Role.findOne({ key: roleKey });
    if (!role) continue; // Fresh DB: the seeder creates roles first.
    const defaultKeys = new Set(DEFAULT_ROLE_PERMISSIONS[roleKey] ?? []);
    for (const [permKey, permDoc] of permissionDocs) {
      const res = await RolePermission.updateOne(
        { role: role._id, permission: permDoc._id },
        { $setOnInsert: { role: role._id, permission: permDoc._id, enabled: defaultKeys.has(permKey) } },
        { upsert: true }
      );
      if (res.upsertedCount > 0) inserted += 1;
    }
  }

  if (inserted > 0) {
    logger.info(`Permission sync: inserted ${inserted} missing role-permission row(s)`);
    await invalidateRoleCaches();
  }

  return { permissions: permissionDocs.size, insertedRolePermissions: inserted };
}

module.exports = { syncPermissions };
