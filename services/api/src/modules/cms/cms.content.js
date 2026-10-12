"use strict";

// Structural validation for CMS content. The editor is trusted staff, but the
// public website renders this JSON directly, so we enforce: known sections
// only, correct shapes, bounded size, and safe link/image targets (no
// javascript: or data: URLs ever reach a public page).
const { AppError } = require("../../errors/AppError");
const DEFAULT_CONTENT = require("@ananta/cms-defaults/content.json");

const SECTION_KEYS = Object.keys(DEFAULT_CONTENT);
const ARRAY_SECTIONS = new Set(
  SECTION_KEYS.filter((k) => Array.isArray(DEFAULT_CONTENT[k]))
);

const MAX_STRING = 5000;
const MAX_ARRAY = 200;
const MAX_DEPTH = 8;
const URL_KEY = /(href|link|image|url)$/i;

function isSafeUrl(value) {
  if (value === "") return true;
  return /^(\/(?!\/)|#|https:\/\/|http:\/\/|mailto:|tel:)/.test(value);
}

function checkNode(value, key, path, depth) {
  if (depth > MAX_DEPTH) {
    throw AppError.validation(`Content is nested too deeply at ${path}`);
  }
  if (value === null || typeof value === "number" || typeof value === "boolean") {
    return;
  }
  if (typeof value === "string") {
    if (value.length > MAX_STRING) {
      throw AppError.validation(`Text is too long at ${path} (max ${MAX_STRING} characters)`);
    }
    if (key && URL_KEY.test(key) && !isSafeUrl(value)) {
      throw AppError.validation(`Link or image at ${path} must start with /, #, https://, mailto: or tel:`);
    }
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY) {
      throw AppError.validation(`Too many items at ${path} (max ${MAX_ARRAY})`);
    }
    value.forEach((item, i) => checkNode(item, null, `${path}[${i}]`, depth + 1));
    return;
  }
  if (typeof value === "object") {
    for (const [childKey, child] of Object.entries(value)) {
      checkNode(child, childKey, `${path}.${childKey}`, depth + 1);
    }
    return;
  }
  throw AppError.validation(`Unsupported value at ${path}`);
}

/**
 * Returns a normalised copy containing only the known sections, or throws a
 * 422 AppError describing the first problem found.
 */
function validateContent(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw AppError.validation("Content must be an object");
  }
  const out = {};
  for (const key of SECTION_KEYS) {
    const value = input[key];
    if (value === undefined) {
      throw AppError.validation(`Missing section "${key}"`);
    }
    if (ARRAY_SECTIONS.has(key)) {
      if (!Array.isArray(value)) throw AppError.validation(`Section "${key}" must be a list`);
    } else if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw AppError.validation(`Section "${key}" must be an object`);
    }
    checkNode(value, null, key, 1);
    out[key] = value;
  }
  // Round-trip through JSON so Mongo stores plain data only.
  return JSON.parse(JSON.stringify(out));
}

function defaultContentCopy() {
  return JSON.parse(JSON.stringify(DEFAULT_CONTENT));
}

module.exports = { validateContent, defaultContentCopy, SECTION_KEYS };
