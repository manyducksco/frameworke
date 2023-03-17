import type { BuildOptions, BuildIncremental, BuildResult } from "esbuild";

import path from "node:path";
import fs from "fs-extra";
import pako from "pako";
import superbytes from "superbytes";
import cheerio from "cheerio";
import htmlMinifier from "html-minifier";
import imagemin from "imagemin";
import imageminPngquant from "imagemin-pngquant";
import imageminJpegtran from "imagemin-jpegtran";
import imageminSvgo from "imagemin-svgo";
import esbuild from "esbuild";
import stylePlugin from "esbuild-style-plugin";

import log from "../utils/log.js";
import { Timer } from "../utils/Timer.js";
import { makeConfig } from "../utils/esbuildConfig.js";
import { generateScopedClassName } from "../utils/generateScopedClassName.js";

/**
 * Config object with options that determine how an app is built.
 */
export interface BuilderConfig {
  /**
   * Options for the browser bundle.
   */
  browser?: {
    /**
     * Path to the main entry point file of your browser app.
     */
    entry: string;

    /**
     * Path to the browser app's index.html file. This is the file the browser requests when a user visits your app.
     * Links to bundled files are added as part of the build step.
     *
     * Defaults to `index.html` in your static path (`/static` by default).
     */
    index?: string; // TODO: Or should index.html be the app entry point, vite style?

    /**
     * Options passed directly to esbuild.
     */
    esbuild?: BuildOptions;

    /**
     * Options for PostCSS, which runs as part of the build.
     */
    postcss?: any; // TODO: Obtain proper types
  };

  /**
   * Options for the server bundle.
   */
  server?: {
    /**
     * Path to the main entry point file of your server app.
     */
    entry: string;
  };

  static?: {
    path: string;
  };

  output?: {
    path: string;
  };

  optimize?: {
    /**
     * Strips and minimizes assets during build to reduce bundle size.
     * Highly recommended for production builds. Defaults to "production".
     */
    minify?: boolean | "production";

    /**
     * Compresses assets during build to reduce bandwidth required to load the app.
     * Highly recommended for production builds and works out of the box when served by @borf/server.
     * Defaults to "production".
     */
    compress?: boolean | "production";
  };
}

export class Builder {
  static configure(config: BuilderConfig) {
    // This function exists to provide autocomplete for config objects.
    return config;
  }

  #projectRoot: string;
  #config: BuilderConfig;

  #browserEntryPath?: string;
  #serverEntryPath?: string;
  #staticPath: string;
  #outputPath: string;

  get config() {
    return this.#config;
  }

  constructor(projectRoot: string, config: BuilderConfig) {
    this.#projectRoot = projectRoot;
    this.#config = config;

    console.log({ projectRoot, config });

    if (config.browser) {
      this.#browserEntryPath = path.join(projectRoot, config.browser.entry);
    }

    if (config.server) {
      this.#serverEntryPath = path.join(projectRoot, config.server.entry);
    }

    if (config.static) {
      this.#staticPath = path.join(projectRoot, config.static.path);
    } else {
      this.#staticPath = path.join(projectRoot, "static");
    }

    if (config.output) {
      this.#outputPath = path.join(projectRoot, config.output.path);
    } else {
      this.#outputPath = path.join(projectRoot, "output");
    }

    console.log(
      this.#browserEntryPath,
      this.#serverEntryPath,
      this.#staticPath,
      this.#outputPath
    );
  }

  /**
   * Builds the app with the provided options.
   */
  async build() {
    await this.clean();

    const isProduction = process.env.NODE_ENV === "production";
    const optimizeConfig = Object.assign(
      {
        minify: "production",
        compress: "production",
      },
      this.#config.optimize
    );

    const buildOptions = {
      minify:
        optimizeConfig.minify === "production"
          ? isProduction
          : optimizeConfig.minify,
      compress:
        optimizeConfig.compress === "production"
          ? isProduction
          : optimizeConfig.compress,
    };

    /*============================*\
    ||          /client           ||
    \*============================*/

    if (this.#browserEntryPath) {
      const timer = new Timer();
      const browserConfig = this.#config.browser!;

      const clientBundle = await esbuild.build(
        makeConfig({
          entryPoints: [this.#browserEntryPath],
          entryNames: "[dir]/client.[hash]",
          outdir: path.join(this.#outputPath, "static"),
          minify: buildOptions.minify,
          plugins: [
            stylePlugin({
              postcss: {
                plugins: browserConfig.postcss?.plugins || [],
              },
              cssModulesOptions: {
                generateScopedName: generateScopedClassName,
              },
            }),
          ],
        })
      );

      await writeClientFiles({
        clientBundle,
        projectRoot: this.#projectRoot,
        staticPath: this.#staticPath,
        buildStaticPath: path.join(this.#outputPath, "static"),
        clientEntryPath: this.#browserEntryPath,
        buildOptions,
      });

      log.client("built in", "%c" + timer.format());
    }

    /*============================*\
    ||          /static           ||
    \*============================*/

    const end = new Timer();

    const staticFiles = await writeStaticFiles({
      projectRoot: this.#projectRoot,
      buildPath: this.#outputPath,
      staticPath: this.#staticPath,
      buildStaticPath: path.join(this.#outputPath, "static"),
      clientEntryPath: this.#browserEntryPath!,
      buildOptions,
    });

    if (staticFiles.length > 0) {
      log.static("built in", "%c" + end.format());
    }
  }

  /**
   *
   */
  watch() {}

  /**
   * Ensures that output directories exist and removes any existing files.
   */
  async clean() {
    await fs.emptyDir(this.#outputPath);
    log.build("cleaned build folder");
  }
}

interface WriteClientFilesOptions {
  clientBundle: BuildResult | BuildIncremental;
  projectRoot: string;
  staticPath: string;
  buildStaticPath: string;
  clientEntryPath: string;
  buildOptions: {
    compress?: boolean;
    minify?: boolean;
    relativeBundlePaths?: boolean;
  };
  isDevelopment?: boolean;
}

export async function writeClientFiles({
  clientBundle,
  projectRoot,
  staticPath,
  buildStaticPath,
  clientEntryPath,
  buildOptions,
  isDevelopment = false,
}: WriteClientFilesOptions) {
  const writtenFiles = [];

  for (const file of clientBundle.outputFiles!) {
    let filePath;

    if (/\.css(\.map)?$/.test(file.path)) {
      filePath = file.path.replace(
        buildStaticPath,
        path.join(buildStaticPath, "css")
      );
    } else if (/\.js(\.map)?$/.test(file.path)) {
      filePath = file.path.replace(
        buildStaticPath,
        path.join(buildStaticPath, "js")
      );
    } else {
      filePath = file.path;
    }

    fs.mkdirpSync(path.dirname(filePath));

    if (filePath.endsWith(".js") || filePath.endsWith(".css")) {
      fs.writeFileSync(filePath, file.contents);

      const size = superbytes(file.contents.length);
      log.client("wrote", filePath.replace(projectRoot, ""), `%c(${size})`);

      if (buildOptions.compress) {
        const writePath = filePath + ".gz";
        const contents = pako.gzip(file.contents, {
          level: 9,
        });
        fs.writeFileSync(writePath, contents);

        const size = superbytes(contents.length);
        log.client("wrote", writePath.replace(projectRoot, ""), `%c(${size})`);
      }
    } else {
      fs.writeFileSync(filePath, file.contents);

      log.client("wrote", filePath.replace(projectRoot, ""));
    }

    writtenFiles.push({
      ...file,
      path: filePath,
    });
  }

  // Write index.html
  try {
    const index = fs.readFileSync(path.join(staticPath, "index.html"));
    const $ = cheerio.load(index);

    const styles = writtenFiles.filter(
      (file) => path.extname(file.path) === ".css"
    );
    const scripts = writtenFiles.filter(
      (file) => path.extname(file.path) === ".js"
    );

    // Add styles to head.
    for (const file of styles) {
      let href = file.path.replace(buildStaticPath, "");

      if (buildOptions.relativeBundlePaths) {
        href = "." + href;
      }

      $("head").append(`<link rel="stylesheet" href="${href}">`);
    }

    // Add bundle reload listener to head.
    if (isDevelopment) {
      $("head").append(`
        <script>
          const events = new EventSource("/_bundle");
    
          events.addEventListener("message", (message) => {
            window.location.reload();
          });
    
          window.addEventListener("beforeunload", () => {
            events.close();
          });
        </script>
      `);
    }

    // Add scripts to body.
    for (const file of scripts) {
      let src = file.path.replace(buildStaticPath, "");

      if (buildOptions.relativeBundlePaths) {
        src = "." + src;
      }

      $("body").append(`<script src="${src}"></script>`);
    }

    let html = $.html();

    if (buildOptions.minify) {
      html = htmlMinifier.minify(html, {
        collapseWhitespace: true,
        conservativeCollapse: false,
        preserveLineBreaks: false,
        removeScriptTypeAttributes: true,
        minifyCSS: true,
        minifyJS: true,
      });
    }

    fs.writeFileSync(path.join(buildStaticPath, "index.html"), html);

    log.client(
      "wrote",
      path.join(buildStaticPath, "index.html").replace(projectRoot, "")
    );

    writtenFiles.push({
      path: path.join(buildStaticPath, "index.html"),
    });
  } catch (err: any) {
    if (err.code === "ENOENT") {
      if (clientEntryPath) {
        log.client(
          "<red>ERROR:</red>",
          "/static/index.html file not found. Please create one to serve as the entry point for your client app."
        );
      }
    } else {
      log.client("<red>ERROR:</red>", err.message);
    }
  }

  return writtenFiles;
}

interface WriteStaticFilesOptions {
  projectRoot: string;
  staticPath: string;
  buildPath: string;
  buildStaticPath: string;
  clientEntryPath: string;
  buildOptions: {
    compress?: boolean;
  };
}

interface CompressableFile {
  type: "gzip" | "imagemin";
  src: string;
  dest: string;
}

interface CopiedFile {
  path: string;
}

export async function writeStaticFiles({
  projectRoot,
  staticPath,
  buildPath,
  buildStaticPath,
  clientEntryPath,
  buildOptions,
}: WriteStaticFilesOptions) {
  const writtenFiles = [];

  if (fs.existsSync(staticPath)) {
    const copiedFiles: CopiedFile[] = [];
    const compressableFiles: CompressableFile[] = [];
    const imageTypes = ["jpg", "jpeg", "png", "svg"];

    fs.copySync(staticPath, path.join(buildPath, "static"), {
      filter: (src, dest) => {
        if (clientEntryPath && src.replace(staticPath, "") === "/index.html") {
          return false; // Skip index.html which is handled by client build
        }

        if (buildOptions.compress) {
          const ext = path.extname(src).slice(1).toLowerCase();

          if (ext === "css" || ext === "js") {
            compressableFiles.push({ type: "gzip", src, dest });
            return false;
          }

          if (imageTypes.includes(ext)) {
            compressableFiles.push({ type: "imagemin", src, dest });
            return false;
          }
        }

        // Wooooo side effects
        if (src !== staticPath && !fs.statSync(src).isDirectory()) {
          copiedFiles.push({ path: dest });
        }

        return true;
      },
    });

    for (const file of copiedFiles) {
      writtenFiles.push(file);
      log.static("copied", file.path.replace(projectRoot, ""));
    }

    const gzipFiles = compressableFiles.filter((f) => f.type === "gzip");

    for (const file of gzipFiles) {
      const contents = fs.readFileSync(file.src);

      fs.writeFileSync(file.dest, contents);
      log.static(
        "wrote " + file.dest.replace(projectRoot, ""),
        "%c" + superbytes(contents.length)
      );

      writtenFiles.push({ path: file.dest });

      const writePath = file.dest + ".gz";
      const compressed = pako.gzip(contents, {
        level: 9,
      });
      fs.writeFileSync(writePath, compressed);

      const diff = superbytes(contents.length - compressed.length);
      const size = superbytes(compressed.length);
      const printPath = writePath.replace(projectRoot, "");
      log.static("wrote", printPath, `%c${size} (-${diff})`);

      writtenFiles.push({ path: writePath });
    }

    if (buildOptions.compress) {
      const imageGlob = path.join(staticPath, `**/*.{${imageTypes.join(",")}}`);

      const optimizedFiles = await imagemin([imageGlob], {
        plugins: [
          imageminJpegtran(),
          imageminPngquant({
            quality: [0.6, 0.8],
          }),
          imageminSvgo({
            plugins: [
              {
                name: "removeViewBox",
                active: false,
              },
            ],
          }),
        ],
      });

      for (const file of optimizedFiles) {
        const stat = fs.statSync(file.sourcePath);

        const outputSize = superbytes(file.data.length);
        const diffSize = superbytes(stat.size - file.data.length);

        const writePath = file.sourcePath.replace(staticPath, buildStaticPath);
        const printPath = writePath.replace(projectRoot, "");

        fs.writeFileSync(writePath, file.data);

        log.static("wrote", printPath, `%c${outputSize} (-${diffSize})`);

        writtenFiles.push({ path: writePath });
      }
    }
  }

  return writtenFiles;
}
