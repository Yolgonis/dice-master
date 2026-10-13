const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

test("the 0.7.0 release manifest, package, and runtime versions stay synchronized", () => {
  const manifest = readJson("module.json");
  const packageJson = readJson("package.json");
  const source = fs.readFileSync(path.join(root, "dice-master.js"), "utf8");

  assert.equal(manifest.id, "dice-master");
  assert.equal(manifest.title, "Dice Master");
  assert.equal(manifest.version, "0.7.0");
  assert.equal(packageJson.version, "0.7.0");
  assert.match(source, /var MODULE_VERSION = "0\.7\.0";/);
});

test("the distributable contains documentation, license, tests, styles, and templates", () => {
  const manifest = readJson("module.json");
  const requiredFiles = [
    ...manifest.esmodules,
    ...manifest.styles,
    ...manifest.languages.map(language => language.path),
    "templates/settings-menu.hbs",
    "README.md",
    "CHANGELOG.md",
    "LICENSE",
    "package.json",
    "scripts/build.cjs",
    "scripts/coverage.cjs"
  ];

  for ( const relativePath of requiredFiles ) {
    assert.equal(fs.existsSync(path.join(root, relativePath)), true, `${relativePath} must exist`);
  }
});

test("the manifest identifies Yolgonis as its sole author without an email field", () => {
  const manifest = readJson("module.json");
  assert.deepEqual(manifest.authors, [{ name: "Yolgonis" }]);
  assert.equal(Object.hasOwn(manifest.authors[0], "email"), false);
});

test("the MIT license preserves upstream and current contributor notices", () => {
  const license = fs.readFileSync(path.join(root, "LICENSE"), "utf8");

  assert.match(license, /^Copyright \(c\) 2026 Radosław Kłos <radoslaw@klos\.dev>$/m);
  assert.match(license, /^Copyright \(c\) 2026 Dice Master contributors$/m);
});

test("English, Polish, and Turkish localization keys stay aligned", () => {
  const languages = ["en", "pl", "tr"].map(language => readJson(`lang/${language}.json`));
  const expectedKeys = Object.keys(languages[0]).sort();

  for ( const language of languages.slice(1) ) {
    assert.deepEqual(Object.keys(language).sort(), expectedKeys);
  }
});

test("the package exposes repeatable local validation commands", () => {
  const packageJson = readJson("package.json");

  assert.equal(packageJson.private, true);
  assert.equal(packageJson.scripts.test, "node --test tests/*.test.cjs");
  assert.equal(packageJson.scripts.check, "node --check dice-master.js");
  assert.equal(packageJson.scripts.build, "node scripts/build.cjs");
  assert.equal(packageJson.scripts["test:coverage"], "node scripts/coverage.cjs");
});
