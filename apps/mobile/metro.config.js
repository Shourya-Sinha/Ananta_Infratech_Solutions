const path = require("path");
const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config");

// Monorepo-aware config: this app lives in apps/mobile inside an npm
// workspace, so node_modules for shared/hoisted packages live at the
// workspace root, not just in apps/mobile/node_modules.
const workspaceRoot = path.resolve(__dirname, "../..");
const projectRoot = __dirname;
const srcRoot = path.resolve(projectRoot, "src");

const defaultConfig = getDefaultConfig(projectRoot);

const config = {
  watchFolders: [...new Set([...(defaultConfig.watchFolders || []), workspaceRoot])],
  resolver: {
    nodeModulesPaths: [
      path.resolve(projectRoot, "node_modules"),
      path.resolve(workspaceRoot, "node_modules"),
    ],
    // The "@/..." alias used throughout src/ is resolved here — Metro's
    // dependency graph reads raw import strings via a lightweight static
    // scan before any Babel plugin runs, so a babel alias alone can't do it.
    resolveRequest: (context, moduleName, platform) => {
      if (moduleName.startsWith("@/")) {
        return context.resolveRequest(context, path.join(srcRoot, moduleName.slice(2)), platform);
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(defaultConfig, config);
