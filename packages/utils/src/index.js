Object.defineProperty(exports, "__esModule", {
  value: true
});
var _money = require("./money");
Object.keys(_money).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (key in exports && exports[key] === _money[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _money[key];
    }
  });
});
var _salaryCalculation = require("./salaryCalculation");
Object.keys(_salaryCalculation).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (key in exports && exports[key] === _salaryCalculation[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _salaryCalculation[key];
    }
  });
});