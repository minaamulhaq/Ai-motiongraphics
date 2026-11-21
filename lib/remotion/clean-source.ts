import ts from "typescript";

// Remove instruction sentences accidentally copied into display strings.
// Short intended copy (product names and feature labels) is preserved.
export function cleanCompositionSource(source: string) {
  const file = ts.createSourceFile("video.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits: {start:number;end:number;text:string}[]=[];
  const isInstruction=(text:string)=>/^\s*(?:create|generate|make)\s+(?:a|an)\b[\s\S]*\b(?:video|motion graphics)\b/i.test(text);
  function visit(node:ts.Node) {
    if ((ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node))&&isInstruction(node.text)) edits.push({start:node.getStart(file),end:node.end,text:'""'});
    else if(ts.isJsxText(node)&&isInstruction(node.text)) edits.push({start:node.getStart(file),end:node.end,text:""});
    ts.forEachChild(node,visit);
  }
  visit(file);
  for(const edit of edits.sort((a,b)=>b.start-a.start))source=source.slice(0,edit.start)+edit.text+source.slice(edit.end);
  return source;
}
