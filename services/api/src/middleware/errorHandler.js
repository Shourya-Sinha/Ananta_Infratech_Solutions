Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.asyncHandler = asyncHandler;
exports.errorHandler = errorHandler;
exports.notFoundHandler = notFoundHandler;
var _zod = require("zod");
var _AppError = require("../errors/AppError");
var _logger = require("../config/logger");
// Wrap async route handlers so thrown/rejected errors reach this middleware
// instead of crashing the process or hanging the request.
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
function notFoundHandler(req, res) {
  const body = {
    success: false,
    error: {
      code: _AppError.ERROR_CODES.NOT_FOUND,
      message: `Route not found: ${req.method} ${req.path}`
    }
  };
  res.status(404).json(body);
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  if (err instanceof _AppError.AppError) {
    if (err.statusCode >= 500) _logger.logger.error({
      err,
      path: req.path
    }, "AppError (5xx)");
    const body = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details
      }
    };
    return res.status(err.statusCode).json(body);
  }
  if (err instanceof _zod.ZodError) {
    const body = {
      success: false,
      error: {
        code: _AppError.ERROR_CODES.VALIDATION_ERROR,
        message: "Validation failed",
        details: err.flatten()
      }
    };
    return res.status(422).json(body);
  }
  _logger.logger.error({
    err,
    path: req.path
  }, "Unhandled error");
  const body = {
    success: false,
    error: {
      code: _AppError.ERROR_CODES.INTERNAL_ERROR,
      message: "Something went wrong. Please try again."
    }
  };
  return res.status(500).json(body);
}