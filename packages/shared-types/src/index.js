Object.defineProperty(exports, "__esModule", {
  value: true
});
var _enums = require("./enums");
Object.keys(_enums).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (key in exports && exports[key] === _enums[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _enums[key];
    }
  });
});
var _socketEvents = require("./socketEvents");
Object.keys(_socketEvents).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (key in exports && exports[key] === _socketEvents[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _socketEvents[key];
    }
  });
});