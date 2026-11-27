const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { gsap } = require("gsap");

const source = fs.readFileSync(path.join(__dirname, "../lib/hyperframes/composition.ts"), "utf8")
  .replace(/^import .*;\r?\n/gm, "");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const loaded = { exports: {} };
new Function("exports", "lintHyperframeHtml", "readFile", "join", compiled)(loaded.exports, async () => ({ findings: [] }), fs.promises.readFile, path.join);

describe("HyperFrames configured duration", () => {
  test("sets a mismatched root duration to the selected project duration", () => {
    const input = '<div id="root" data-composition-id="main" data-duration="13.2"><div class="clip" data-duration="4">Scene</div></div>';
    const normalized = loaded.exports.normalizeHyperframesDuration(input, 10);
    assert.match(normalized, /data-composition-id="main" data-duration="10"/);
    assert.match(normalized, /class="clip" data-duration="4"/);
    assert.match(normalized, /data-aivid-duration-fit/);
  });

  test("adds a missing root duration and leaves clip timing unchanged", () => {
    const input = '<div id="root" data-composition-id="main"><div class="clip" data-duration="6">Scene</div></div>';
    const normalized = loaded.exports.normalizeHyperframesDuration(input, 8);
    assert.match(normalized, /data-composition-id="main" data-duration="8"/);
    assert.match(normalized, /class="clip" data-duration="6"/);
    assert.match(normalized, /data-aivid-duration-fit/);
  });

  test("leaves HTML without a composition root unchanged for the validator to reject", () => {
    const input = '<div class="clip">Scene</div>';
    assert.equal(loaded.exports.normalizeHyperframesDuration(input, 8), input);
  });

  test("compresses an overlong GSAP timeline and clip times to the selected duration", () => {
    const html = loaded.exports.normalizeHyperframesDuration('<div id="root" data-composition-id="main" data-duration="180"><div class="clip" data-start="150" data-duration="30"></div></div>', 10);
    const script = html.match(/<script\b[^>]*data-aivid-duration-fit[^>]*>([\s\S]*?)<\/script>/i)?.[1];
    assert.ok(script, "duration fitting script should be embedded");
    const first = { x: 0 }, second = { x: 0 };
    const timeline = gsap.timeline({ paused: true }).to(first, { x: 1, duration: 100 }, 0).to(second, { x: 1, duration: 80 }, 100);
    const attributes = new Map([["data-start", "150"], ["data-duration", "30"]]);
    vm.runInNewContext(script, {
      window: { __timelines: { main: timeline } },
      document: { querySelectorAll: () => [{ getAttribute: name => attributes.get(name), setAttribute: (name, value) => attributes.set(name, value) }] },
    });
    assert.ok(Math.abs(timeline.duration() - 10) < 0.001);
    assert.ok(Math.abs(Number(attributes.get("data-start")) - 8.333333) < 0.001);
    assert.ok(Math.abs(Number(attributes.get("data-duration")) - 1.666667) < 0.001);
  });
});
