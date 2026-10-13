const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

const SOURCE_FILES = Object.freeze([
  { source: "constants.js", region: "constants.ts" },
  { source: "ui/settings-menu.js", region: "ui/settings-menu.ts" },
  { source: "settings.js", region: "settings.ts" },
  { source: "cheat/state.js", region: "cheat/state.ts" },
  { source: "cheat/strategies/full.js", region: "cheat/strategies/full.ts" },
  { source: "cheat/strategies/bias.js", region: "cheat/strategies/bias.ts" },
  { source: "cheat/strategies/nudge.js", region: "cheat/strategies/nudge.ts" },
  { source: "cheat/strategies/threshold.js", region: "cheat/strategies/threshold.ts" },
  { source: "cheat/strategies/index.js", region: "cheat/strategies/index.ts" },
  { source: "cheat/patch.js", region: "cheat/patch.ts" },
  { source: "ui/widget.js", region: "ui/widget.ts" },
  { source: "integrations/dice-so-nice.js", region: "integrations/dice-so-nice.ts" },
  { source: "cheat/debug-message.js", region: "cheat/debug-message.ts" },
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
