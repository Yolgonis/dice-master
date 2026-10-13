const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const coverageDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "dice-master-coverage-"));
const threshold = 80;

try {
  const testRun = spawnSync(process.execPath, ["--test", "tests/dice-master.test.cjs"], {
    cwd: root,
    env: { ...process.env, NODE_V8_COVERAGE: coverageDirectory },
    encoding: "utf8"
  });
  process.stdout.write(testRun.stdout ?? "");
  process.stderr.write(testRun.stderr ?? "");
  if ( testRun.status !== 0 ) process.exit(testRun.status ?? 1);

  const candidates = fs.readdirSync(coverageDirectory)
    .filter(file => file.endsWith(".json"))
    .flatMap(file => JSON.parse(fs.readFileSync(path.join(coverageDirectory, file), "utf8")).result ?? [])
    .filter(script => script.url === "dice-master.js")
    .sort((left, right) => right.functions.length - left.functions.length);
  const script = candidates[0];
  if ( !script ) throw new Error("V8 did not report coverage for dice-master.js");

  const functions = script.functions.filter(fn => fn.ranges?.length);
  const covered = functions.filter(fn => fn.ranges[0].count > 0);
  const percent = functions.length ? (covered.length / functions.length) * 100 : 0;
  console.log(`Dice Master V8 function coverage: ${covered.length}/${functions.length} (${percent.toFixed(2)}%)`);
  if ( percent < threshold ) {
    throw new Error(`Function coverage ${percent.toFixed(2)}% is below the ${threshold}% threshold`);
  }
} finally {
  fs.rmSync(coverageDirectory, { recursive: true, force: true });
}
