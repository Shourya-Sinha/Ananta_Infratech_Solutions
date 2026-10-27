// Monorepo: this app lives in apps/mobile of an npm workspace (deps hoist
// to the repo root). Pin the CLI to THIS folder as the project root with
// its native projects, or `react-native start/run-android` can't find
// the project commands.
module.exports = {
  project: {
    android: { sourceDir: "./android" },
    ios: { sourceDir: "./ios" },
  },
};
