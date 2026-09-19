Object.defineProperty(exports, "__esModule", {
  value: true
});
var _auth = require("./auth");
Object.keys(_auth).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (key in exports && exports[key] === _auth[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _auth[key];
    }
  });
});
var _attendance = require("./attendance");
Object.keys(_attendance).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (key in exports && exports[key] === _attendance[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _attendance[key];
    }
  });
});
var _requests = require("./requests");
Object.keys(_requests).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (key in exports && exports[key] === _requests[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _requests[key];
    }
  });
});