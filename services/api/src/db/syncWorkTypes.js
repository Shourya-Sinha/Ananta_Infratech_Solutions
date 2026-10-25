"use strict";

/**
 * Startup work-type sync — same idea as syncPermissions. Fresh databases
 * used to have ZERO work types, so the Admin "Add worker" work-type
 * dropdown was empty and no worker could be registered until someone
 * manually created trades. This inserts the standard construction trades
 * (packages/constants DEFAULT_WORK_TYPES) that are missing, by code.
 * It NEVER updates an existing work type: rates/names an admin edited,
 * and types an admin deactivated, are left exactly as they are.
 */
const { WorkType } = require("./models/WorkType");
const { DEFAULT_WORK_TYPES } = require("@ananta/constants");
const { rupeesToPaise } = require("@ananta/utils");
const { logger } = require("../config/logger");

async function syncWorkTypes(actorId) {
  let inserted = 0;
  for (const wt of DEFAULT_WORK_TYPES) {
    const res = await WorkType.updateOne(
      { code: wt.code },
      {
        $setOnInsert: {
          name: wt.name,
          code: wt.code,
          defaultDailyRatePaise: rupeesToPaise(wt.defaultDailyRate),
          isActive: true,
          ...(actorId ? { createdBy: actorId } : {})
        }
      },
      { upsert: true }
    );
    if (res.upsertedCount > 0) inserted += 1;
  }
  if (inserted > 0) logger.info(`Seeded ${inserted} default construction work type(s)`);
  return { total: DEFAULT_WORK_TYPES.length, inserted };
}

module.exports = { syncWorkTypes };
