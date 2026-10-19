const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

const SOURCE_FILES = Object.freeze([
  { source: "constants.js", region: "constants.ts" },
  { source: "ui/settings-menu.js", region: "ui/settings-menu.ts" },
  { source: "settings.js", region: "settings.ts" },
  { source: "influence/state.js", region: "influence/state.ts" },
  { source: "influence/strategies/full.js", region: "influence/strategies/full.ts" },
  { source: "influence/strategies/bias.js", region: "influence/strategies/bias.ts" },
  { source: "influence/strategies/nudge.js", region: "influence/strategies/nudge.ts" },
  { source: "influence/strategies/threshold.js", region: "influence/strategies/threshold.ts" },
  { source: "influence/strategies/index.js", region: "influence/strategies/index.ts" },
  { source: "influence/bad-luck.js", region: "influence/bad-luck.ts" },
  { source: "influence/patch.js", region: "influence/patch.ts" },
  { source: "ui/widget.js", region: "ui/widget.ts" },
  { source: "integrations/dice-so-nice.js", region: "integrations/dice-so-nice.ts" },
  { source: "influence/debug-message.js", region: "influence/debug-message.ts" },
  { source: "main.js", region: "main.ts" }
]);

function buildBundle() {
  const sections = SOURCE_FILES.map(entry => {
    const sourcePath = path.join(root, "src", entry.source);
    const source = fs.readFileSync(sourcePath, "utf8");
    if ( !source.endsWith("\n") ) throw new Error(`${entry.source} must end with a newline`);
    return `//#region src/${entry.region}\n${source}//#endregion`;
  });
  return `${sections.join("\n")}\n`;
}

function writeBundle() {
  const outputPath = path.join(root, "dice-master.js");
  fs.writeFileSync(outputPath, buildBundle(), "utf8");
  console.log(`Built ${path.relative(process.cwd(), outputPath)} from ${SOURCE_FILES.length} source files.`);
}

if ( require.main === module ) writeBundle();

module.exports = { SOURCE_FILES, buildBundle, writeBundle };
