
import ts from "typescript";
import path from "node:path";

export function validateComposition(code: string): string[] {
  // 1. Check empty code
  if (!code || !code.trim()) {
    return ["Composition source is empty."];
  }

  // 2. Check source size
  if (code.length > 100000) {
    return ["Composition source exceeds 100,000 characters."];
  }

  const file = path.join(
    process.cwd(),
    "GeneratedMotion.tsx"
  );

  // 3. Validate TSX syntax through transpilation
  const result = ts.transpileModule(code, {
    fileName: file,
    reportDiagnostics: true,
    compilerOptions: {
      strict: true,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
    },
  });

  // 4. Return actual diagnostics
  const errors = (result.diagnostics ?? [])
    .filter(
      (diagnostic) =>
        diagnostic.category === ts.DiagnosticCategory.Error
    )
    .map((diagnostic) =>
      ts.flattenDiagnosticMessageText(
        diagnostic.messageText,
        " "
      )
    );

  return [...new Set(errors)].slice(0, 12);
}
