Object.defineProperty(exports, "__esModule", {
  value: true
});
var _jsonwebtoken = _interopRequireDefault(require("jsonwebtoken"));
var _env = require("../../config/env");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
exports.TokenService = {
  signAccessToken(payload) {
    const options = {
      expiresIn: _env.env.JWT_ACCESS_EXPIRES_IN
    };
    return _jsonwebtoken.default.sign(payload, _env.env.JWT_SECRET, options);
  },
  signRefreshToken(payload) {
    const options = {
      expiresIn: _env.env.JWT_REFRESH_EXPIRES_IN
    };
    return _jsonwebtoken.default.sign(payload, _env.env.JWT_REFRESH_SECRET, options);
  },
  verifyAccessToken(token) {
    return _jsonwebtoken.default.verify(token, _env.env.JWT_SECRET);
  },
  verifyRefreshToken(token) {
    return _jsonwebtoken.default.verify(token, _env.env.JWT_REFRESH_SECRET);
  }
};