Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.mountApiDocs = mountApiDocs;
exports.openApiSpec = void 0;
var _swaggerJsdoc = _interopRequireDefault(require("swagger-jsdoc"));
var _swaggerUiExpress = _interopRequireDefault(require("swagger-ui-express"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
const options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Ananta Infratech Solutions API",
      version: "1.0.0",
      description: "Construction workforce & project management platform API. Every mutating route " + "requires a Bearer access token and the permission key noted on that route " + "(see the Permission Management matrix in packages/constants)."
    },
    servers: [{
      url: "/api/v1"
    }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        }
      }
    },
    security: [{
      bearerAuth: []
    }]
  },
  // Route files use JSDoc @openapi blocks; see auth.routes.js for the pattern.
  apis: ["./src/modules/**/*.routes.js"]
};
const openApiSpec = exports.openApiSpec = (0, _swaggerJsdoc.default)(options);
function mountApiDocs(app) {
  app.get("/api/v1/openapi.json", (_req, res) => res.json(openApiSpec));
  app.use("/api/v1/docs", _swaggerUiExpress.default.serve, _swaggerUiExpress.default.setup(openApiSpec));
}