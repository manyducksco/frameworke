#!/usr/bin/env node

const { program } = require("@ratwizard/cli");

const build = require("./scripts/build");
const watch = require("./scripts/watch");

program
  .option("-w, --watch", {
    description: "Watch for changes and rebuild automatically.",
    boolean: true,
  })
  .option("--minify", {
    description:
      "Reduce bundle size at the cost of readability; recommended for production builds. Only affects the client app.",
    boolean: true,
  })
  .option("--relative-bundle-paths", {
    description:
      "Use paths relative to index.html for importing client bundle files instead of the default absolute paths.",
    key: "relativeBundlePaths",
    boolean: true,
  })
  .action(async ({ options }) => {
    const buildOptions = {
      minify: options.minify || false,
      relativeBundlePaths: options.relativeBundlePaths || false,
    };

    if (options.watch) {
      await watch(process.cwd(), buildOptions);
    } else {
      await build(process.cwd(), buildOptions);
    }
  });

if (!module.parent) {
  // Called from CLI
  program.run(process.argv);
} else {
  // Imported from another file
  module.exports = { build, watch };
}
