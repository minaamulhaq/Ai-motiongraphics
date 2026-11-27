const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const { z } = require("zod");

const source = fs.readFileSync(path.join(__dirname, "../lib/ai/review-composition.ts"), "utf8")
  .replace(/^import .*;\r?\n/gm, "");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const loaded = { exports: {} };
new Function("exports", "z", "generateStructured", "generateText", compiled)(loaded.exports, z, () => {}, () => {});

describe("prompt-faithfulness checks", () => {
  test("requires exact text surrounded by straight or curly quotes", () => {
    assert.deepEqual(loaded.exports.findMissingQuotedCopy('Show “NEON HORIZON” and "Open Now".', "<h1>NEON HORIZON</h1>"), ["Open Now"]);
  });

  test("ignores script and style contents when checking displayed copy", () => {
    assert.deepEqual(loaded.exports.findMissingQuotedCopy('Show “NEON HORIZON”.', '<script>const x="NEON HORIZON"</script><style>.x::after{content:"NEON HORIZON"}</style><div>Scene</div>'), ["NEON HORIZON"]);
  });

  test("passes when exact requested text is present in visible markup", () => {
    assert.deepEqual(loaded.exports.findMissingQuotedCopy('Show “NEON HORIZON”.', '<h1>NEON HORIZON</h1>'), []);
  });
});
