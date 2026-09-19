Object.defineProperty(exports, "__esModule", {
  value: true
});
var _permissions = require("./permissions");
Object.keys(_permissions).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (key in exports && exports[key] === _permissions[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _permissions[key];
    }
  });
});
var _salaryRules = require("./salaryRules");
Object.keys(_salaryRules).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (key in exports && exports[key] === _salaryRules[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _salaryRules[key];
    }
  });
});