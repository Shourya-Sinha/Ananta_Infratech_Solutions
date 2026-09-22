"use strict";

// Database seeder. Safe to re-run at any time:
//   - roles are upserted by key (labels refresh, nothing else changes),
//   - permissions + role-permission rows go through syncPermissions(), which
//     only INSERTS missing rows and never overwrites toggles an admin has
//     customised in Permission Management,
//   - the super admin is created only when its phone number is absent.

const argon2 = require("argon2");
const { connectDB, disconnectDB } = require("../../config/db");
const { logger } = require("../../config/logger");
const { Role } = require("../models/Role");
const { User } = require("../models/User");
const { ROLE_KEYS } = require("@ananta/shared-types");
const { syncPermissions } = require("../syncPermissions");

const ROLE_LABELS = {
  SUPER_ADMIN: "Super Admin",
  MANAGER: "Manager",
  WORKER: "Worker",
};

async function seedRoles() {
  const roleDocs = new Map();
  for (const key of ROLE_KEYS) {
    const role = await Role.findOneAndUpdate(
      { key },
      { key, label: ROLE_LABELS[key], isSystemRole: true },
      { upsert: true, new: true }
    );
    roleDocs.set(key, role);
  }
  logger.info(`Seeded ${roleDocs.size} roles`);
  return roleDocs;
}

async function seedSuperAdmin(roleDocs) {
  const phone = process.env.SEED_SUPER_ADMIN_PHONE ?? "9999999999";
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD ?? "ChangeMe123!";
  const existing = await User.findOne({ phone });
  if (existing) {
    logger.info("Super admin already exists, skipping");
    return;
  }
  const passwordHash = await argon2.hash(password);
  await User.create({
    role: roleDocs.get("SUPER_ADMIN")._id,
    name: "Ananta Super Admin",
    phone,
    passwordHash,
    status: "ACTIVE",
    phoneVerified: true,
  });
  logger.warn(`Seeded super admin: phone=${phone} password=${password} — CHANGE THIS PASSWORD IMMEDIATELY.`);
}

async function main() {
  await connectDB();
  const roleDocs = await seedRoles();
  // Roles must exist before the sync below can attach rows to them.
  if (roleDocs.size > 0) {
    const { permissions, insertedRolePermissions } = await syncPermissions();
    logger.info(`Seeded ${permissions} permissions (${insertedRolePermissions} new role-permission row(s))`);
  }
  await seedSuperAdmin(roleDocs);
  await disconnectDB();
  logger.info("Seeding complete");
}

main().catch((err) => {
  logger.error({ err }, "Seeding failed");
  process.exit(1);
});
