var _argon = _interopRequireDefault(require("argon2"));
var _db = require("../../config/db");
var _logger = require("../../config/logger");
var _Role = require("../models/Role");
var _Permission = require("../models/Permission");
var _User = require("../models/User");
var _sharedTypes = require("@ananta/shared-types");
var _constants = require("@ananta/constants");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
const ROLE_LABELS = {
  SUPER_ADMIN: "Super Admin",
  MANAGER: "Manager",
  WORKER: "Worker"
};
async function seedRoles() {
  const roleDocs = new Map();
  for (const key of _sharedTypes.ROLE_KEYS) {
    const role = await _Role.Role.findOneAndUpdate({
      key
    }, {
      key,
      label: ROLE_LABELS[key],
      isSystemRole: true
    }, {
      upsert: true,
      new: true
    });
    roleDocs.set(key, role);
  }
  _logger.logger.info(`Seeded ${roleDocs.size} roles`);
  return roleDocs;
}
async function seedPermissions() {
  const permissionDocs = new Map();
  for (const p of _constants.PERMISSIONS) {
    const perm = await _Permission.Permission.findOneAndUpdate({
      key: p.key
    }, {
      key: p.key,
      group: p.group,
      description: p.description
    }, {
      upsert: true,
      new: true
    });
    permissionDocs.set(p.key, perm);
  }
  _logger.logger.info(`Seeded ${permissionDocs.size} permissions`);
  return permissionDocs;
}
async function seedRolePermissions(roleDocs, permissionDocs) {
  let count = 0;
  for (const roleKey of _sharedTypes.ROLE_KEYS) {
    const role = roleDocs.get(roleKey);
    const defaultKeys = new Set(_constants.DEFAULT_ROLE_PERMISSIONS[roleKey]);
    for (const [permKey, permDoc] of permissionDocs) {
      await _Permission.RolePermission.findOneAndUpdate({
        role: role._id,
        permission: permDoc._id
      }, {
        enabled: defaultKeys.has(permKey)
      }, {
        upsert: true
      });
      count++;
    }
  }
  _logger.logger.info(`Seeded ${count} role-permission entries`);
}
async function seedSuperAdmin(roleDocs) {
  const phone = process.env.SEED_SUPER_ADMIN_PHONE ?? "9999999999";
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD ?? "ChangeMe123!";
  const existing = await _User.User.findOne({
    phone
  });
  if (existing) {
    _logger.logger.info("Super admin already exists, skipping");
    return;
  }
  const passwordHash = await _argon.default.hash(password);
  await _User.User.create({
    role: roleDocs.get("SUPER_ADMIN")._id,
    name: "Ananta Super Admin",
    phone,
    passwordHash,
    status: "ACTIVE",
    phoneVerified: true
  });
  _logger.logger.warn(`Seeded super admin: phone=${phone} password=${password} — CHANGE THIS PASSWORD IMMEDIATELY.`);
}
async function main() {
  await (0, _db.connectDB)();
  const roleDocs = await seedRoles();
  const permissionDocs = await seedPermissions();
  await seedRolePermissions(roleDocs, permissionDocs);
  await seedSuperAdmin(roleDocs);
  await (0, _db.disconnectDB)();
  _logger.logger.info("Seeding complete");
}
main().catch(err => {
  _logger.logger.error({
    err
  }, "Seeding failed");
  process.exit(1);
});