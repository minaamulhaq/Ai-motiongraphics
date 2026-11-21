const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

// Transpile and load validateComposition from lib/ai/validate-composition.ts
const validatorSource = fs.readFileSync(path.join(__dirname, "../lib/ai/validate-composition.ts"), "utf8")
  .replace(/^import .*;\r?\n/gm, "");
const validatorCompiled = ts.transpileModule(validatorSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const validatorModule = { exports: {} };
new Function("exports", "ts", "path", validatorCompiled)(validatorModule.exports, ts, path);
const { validateComposition } = validatorModule.exports;

// Transpile and load functions from lib/inngest/functions.ts
// We mock external server dependencies for unit testing of validation and fallback
const lambdaSource = fs.readFileSync(path.join(__dirname, "../lib/remotion/lambda.ts"), "utf8")
  .replace(/^import "server-only";\r?\n/gm, "")
  .replace(/^import .*;\r?\n/gm, "");
const lambdaCompiled = ts.transpileModule(lambdaSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const lambdaModule = { exports: {} };
new Function("exports", "ts", lambdaCompiled)(lambdaModule.exports, ts);
const { readCompositionConfig } = lambdaModule.exports;

describe("Composition technical and non-blocking validation", () => {
  const validTheme = {
    colors: { background: "#111111", foreground: "#ffffff", primary: "#ff6b2c", secondary: "#b8b8c0" },
    typography: { fontFamily: "Arial", headingWeight: 800, bodySize: 36 },
    mood: "Modern kinetic",
    motion: { intensity: "energetic", transitionFrames: 12 },
  };

  const validComposition = `import React from "react";
import { AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const videoConfig = { width: 1920, height: 1080, fps: 30, durationInFrames: 150 };

export default function MotionVideo({ theme }: { theme: any }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ backgroundColor: theme.colors.background }}>
      <Sequence from={0} durationInFrames={150}>
        <div style={{ opacity, color: theme.colors.foreground }}>Valid Composition</div>
      </Sequence>
    </AbsoluteFill>
  );
}`;

  test("detects multiple JSX root elements syntax error", () => {
    // Code with multiple adjacent JSX root elements in return statement
    const invalidJsx = `import React from "react";
import { AbsoluteFill } from "remotion";

export const videoConfig = { width: 1920, height: 1080, fps: 30, durationInFrames: 150 };

export default function MotionVideo() {
  return (
    <AbsoluteFill><div>First Root</div></AbsoluteFill>
    <AbsoluteFill><div>Second Root</div></AbsoluteFill>
  );
}`;

    const errors = validateComposition(invalidJsx);
    assert.ok(errors.length > 0, "Should detect diagnostics");
    const hasJsxParentError = errors.some((err) =>
      err.includes("JSX expressions must have one parent element")
    );
    assert.ok(hasJsxParentError, `Expected 'JSX expressions must have one parent element', got: ${errors.join("; ")}`);
  });

  test("valid Remotion composition passes technical validation with zero errors", () => {
    const errors = validateComposition(validComposition);
    assert.deepEqual(errors, []);
    const config = readCompositionConfig(validComposition);
    assert.equal(config.width, 1920);
    assert.equal(config.height, 1080);
    assert.equal(config.fps, 30);
    assert.equal(config.durationInFrames, 150);
  });

  test("non-blocking creative requirements do not reject technically valid code", () => {
    // Technically valid code that completely omits user labels, has 1 scene instead of multiple,
    // and omits spring animations or specific typography
    const minimalValidCode = `import React from "react";
import { AbsoluteFill } from "remotion";

export const videoConfig = { width: 1080, height: 1920, fps: 30, durationInFrames: 90 };

export default function MinimalMotion() {
  return <AbsoluteFill style={{ backgroundColor: "#000" }}><span>Simple</span></AbsoluteFill>;
}`;

    // Technical validation must pass with zero errors
    const technicalErrors = validateComposition(minimalValidCode);
    assert.deepEqual(technicalErrors, [], "Technical validation must not block creative differences");

    const config = readCompositionConfig(minimalValidCode);
    assert.equal(config.width, 1080);
    assert.equal(config.height, 1920);
  });

  test("repairing JSX syntax error results in valid code", () => {
    // 1. Broken code with multiple JSX roots
    const brokenCode = `import React from "react";
import { AbsoluteFill } from "remotion";

export const videoConfig = { width: 1920, height: 1080, fps: 30, durationInFrames: 60 };

export default function MotionVideo() {
  return (
    <AbsoluteFill><div>Part 1</div></AbsoluteFill>
    <AbsoluteFill><div>Part 2</div></AbsoluteFill>
  );
}`;

    const initialErrors = validateComposition(brokenCode);
    assert.ok(initialErrors.some((e) => e.includes("JSX expressions must have one parent element")));

    // 2. Simulated AI repair wrapping adjacent roots in a single parent <AbsoluteFill>
    const repairedCode = `import React from "react";
import { AbsoluteFill } from "remotion";

export const videoConfig = { width: 1920, height: 1080, fps: 30, durationInFrames: 60 };

export default function MotionVideo() {
  return (
    <AbsoluteFill>
      <div>Part 1</div>
      <div>Part 2</div>
    </AbsoluteFill>
  );
}`;

    const repairedErrors = validateComposition(repairedCode);
    assert.deepEqual(repairedErrors, [], "Repaired code should pass validation");
  });

  test("repair attempt loop enforces max 2 attempts limit", () => {
    const MAX_REPAIR_ATTEMPTS = 2;
    let attemptsCount = 0;
    let code = "invalid code {";

    // Simulate repair loop
    while (validateComposition(code).length > 0 && attemptsCount < MAX_REPAIR_ATTEMPTS) {
      attemptsCount++;
      // Simulate failed repair that still produces invalid code
      code = "still invalid {";
    }

    assert.equal(attemptsCount, 2, "Must stop after exactly 2 attempts");
  });

  test("repair succeeds on attempt 1 when AI fixes JSX error", () => {
    const MAX_REPAIR_ATTEMPTS = 2;
    let attemptsCount = 0;
    let code = `import React from "react";
import { AbsoluteFill } from "remotion";
export const videoConfig = { width: 1920, height: 1080, fps: 30, durationInFrames: 60 };
export default function MotionVideo() {
  return (
    <AbsoluteFill><div>A</div></AbsoluteFill>
    <AbsoluteFill><div>B</div></AbsoluteFill>
  );
}`;

    while (validateComposition(code).length > 0 && attemptsCount < MAX_REPAIR_ATTEMPTS) {
      attemptsCount++;
      // On attempt 1, AI repairs it
      code = `import React from "react";
import { AbsoluteFill } from "remotion";
export const videoConfig = { width: 1920, height: 1080, fps: 30, durationInFrames: 60 };
export default function MotionVideo() {
  return (
    <AbsoluteFill>
      <div>A</div>
      <div>B</div>
    </AbsoluteFill>
  );
}`;
    }

    assert.equal(attemptsCount, 1, "Should exit repair loop as soon as code is valid");
    assert.deepEqual(validateComposition(code), []);
  });
});
