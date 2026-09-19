Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.imagekit = void 0;
var _imagekit = _interopRequireDefault(require("imagekit"));
var _env = require("./env");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
// Private key never leaves this module / never gets sent to any client.
const imagekit = exports.imagekit = new _imagekit.default({
  publicKey: _env.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: _env.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: _env.env.IMAGEKIT_URL_ENDPOINT
});