Object.defineProperty(exports, "__esModule", {
  value: true
});
var _SalaryRule = require("../../db/models/SalaryRule");
var _constants = require("@ananta/constants");
exports.SalaryRuleService = {
  async getActiveRuleSet() {
    const rules = await _SalaryRule.SalaryRule.find({
      key: {
        $in: ["FULL_DAY_HOURS", "OVERTIME_START_HOURS", "OVERTIME_MULTIPLIER"]
      }
    });
    const map = new Map(rules.map(r => [r.key, r.value]));
    return {
      fullDayHours: Number(map.get("FULL_DAY_HOURS") ?? _constants.DEFAULT_SALARY_RULES.FULL_DAY_HOURS),
      overtimeStartHours: Number(map.get("OVERTIME_START_HOURS") ?? _constants.DEFAULT_SALARY_RULES.OVERTIME_START_HOURS),
      overtimeMultiplier: Number(map.get("OVERTIME_MULTIPLIER") ?? _constants.DEFAULT_SALARY_RULES.OVERTIME_MULTIPLIER)
    };
  },
  async setRule(key, value, updatedBy) {
    await _SalaryRule.SalaryRule.findOneAndUpdate({
      key
    }, {
      value,
      updatedBy
    }, {
      upsert: true
    });
  }
};