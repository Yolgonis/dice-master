const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { SOURCE_FILES, buildBundle } = require("../scripts/build.cjs");

const root = path.join(__dirname, "..");

test("the maintainable source tree contains every runtime region", () => {
  assert.deepEqual(SOURCE_FILES.map(entry => entry.source), [
    "constants.js",
    "ui/settings-menu.js",
    "settings.js",
    "cheat/state.js",
    "cheat/strategies/full.js",
    "cheat/strategies/bias.js",
    "cheat/strategies/nudge.js",
    "cheat/strategies/threshold.js",
    "cheat/strategies/index.js",
    "cheat/patch.js",
    "ui/widget.js",
    "integrations/dice-so-nice.js",
    "cheat/debug-message.js",
    "main.js"
  ]);
  for ( const entry of SOURCE_FILES ) {
    assert.equal(fs.existsSync(path.join(root, "src", entry.source)), true, `${entry.source} must exist`);
  }
});

test("building from source reproduces the checked-in runtime bundle byte for byte", () => {
  const generated = buildBundle();
  const checkedIn = fs.readFileSync(path.join(root, "dice-master.js"), "utf8");
  assert.equal(generated, checkedIn);
});
