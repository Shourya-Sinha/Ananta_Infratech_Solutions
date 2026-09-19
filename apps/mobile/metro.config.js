const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

// Monorepo-aware config: this app lives in apps/mobile inside an npm
// workspace, so node_modules for shared/hoisted packages live at the
// workspace root, not just in apps/mobile/node_modules.
const workspaceRoot = path.resolve(__dirname, "../..");
const projectRoot = __dirname;
const srcRoot = path.resolve(projectRoot, "src");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// The "@/..." alias used throughout src/ needs Metro's own resolveRequest
// hook — Metro's dependency graph reads raw import strings via a
// lightweight static scan before any Babel plugin runs, so a babel alias
// plugin alone can't make this resolve (verified the hard way — see README).
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith("@/")) {
    return context.resolveRequest(context, path.join(srcRoot, moduleName.slice(2)), platform);
  }
  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
