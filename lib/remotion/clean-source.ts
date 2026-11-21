import ts from "typescript";

// Remove instruction sentences accidentally copied into display strings.
// Short intended copy (product names and feature labels) is preserved.
export function cleanCompositionSource(source: string) {
  const file = ts.createSourceFile("video.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits: {start:number;end:number;text:string}[]=[];
  const helpers: string[] = [];
  // Repair collapsed keyframes at runtime too: generated frame expressions
  // can evaluate to duplicate values even when their source looks different.
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    
    // Repair lucide-react imports: AI sometimes prefixes icons with "Icon" (e.g. IconSearch -> Search as IconSearch)
    if (statement.moduleSpecifier.text === "lucide-react") {
      const bindings = statement.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) {
        for (const item of bindings.elements) {
          const importedName = (item.propertyName ?? item.name).text;
          if (/^Icon[A-Z]/.test(importedName)) {
            const stripped = importedName.slice(4);
            if (item.propertyName) {
              edits.push({ start: item.propertyName.getStart(file), end: item.propertyName.end, text: stripped });
            } else {
              edits.push({ start: item.getStart(file), end: item.end, text: `${stripped} as ${importedName}` });
            }
          }
        }
      }
      continue;
    }

    if (statement.moduleSpecifier.text !== "remotion") continue;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const item of bindings.elements) {
      if ((item.propertyName ?? item.name).text !== "interpolate" || item.isTypeOnly) continue;
      const local = item.name.text;
      let raw = `__aividRawInterpolate_${local}`;
      while (source.includes(raw)) raw += "_";
      edits.push({start:item.getStart(file),end:item.end,text:`interpolate as ${raw}`});
      helpers.push(`
function ${local}(value: number, input: readonly number[], output: readonly number[], options?: Parameters<typeof ${raw}>[3]) {
  if (input.length !== output.length || input.length < 2 || input.some((n, i) => !Number.isFinite(n) || (i > 0 && n < input[i - 1]))) {
    return ${raw}(value, input, output, options);
  }
  const frames: number[] = [];
  const values: number[] = [];
  for (let i = 0; i < input.length; i++) {
    if (frames.length && frames[frames.length - 1] === input[i]) {
      values[values.length - 1] = output[i];
    } else {
      frames.push(input[i]); values.push(output[i]);
    }
  }
  if (frames.length === 1) return values[0];
  return ${raw}(value, frames, values, options);
}
`);
    }
  }
  const isInstruction=(text:string)=>/^\s*(?:create|generate|make)\s+(?:a|an)\b[\s\S]*\b(?:video|motion graphics)\b/i.test(text);
  function visit(node:ts.Node) {
    if ((ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node))&&isInstruction(node.text)) edits.push({start:node.getStart(file),end:node.end,text:'""'});
    else if(ts.isJsxText(node)&&isInstruction(node.text)) edits.push({start:node.getStart(file),end:node.end,text:""});
    ts.forEachChild(node,visit);
  }
  visit(file);
  for(const edit of edits.sort((a,b)=>b.start-a.start))source=source.slice(0,edit.start)+edit.text+source.slice(edit.end);
  return source + helpers.join("\n");
}
