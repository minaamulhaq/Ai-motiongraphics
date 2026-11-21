import ts from "typescript";
import path from "node:path";

export function validateComposition(code:string):string[] {
  if(code.length>100000)return ["Composition source exceeds 100,000 characters."];
  if(/(?:animation|transition)\s*:/i.test(code))return ["Use frame-driven Remotion animation instead of CSS animation or transition properties."];
  if(/Math\.random|Date\.now|setTimeout|setInterval|eval\s*\(/.test(code))return ["Composition source must be deterministic and side-effect free."];
  const file=path.join(process.cwd(),"GeneratedMotion.tsx");
  const parsed=ts.createSourceFile(file,code,ts.ScriptTarget.ESNext,true,ts.ScriptKind.TSX);
  let hasDefault=false,hasConfig=false;
  for(const node of parsed.statements){
    if(ts.isImportDeclaration(node)&&(!ts.isStringLiteral(node.moduleSpecifier)||!["react","remotion","lucide-react"].includes(node.moduleSpecifier.text)))return ["Import only from react, remotion, and lucide-react."];
    if(ts.isFunctionDeclaration(node)&&node.modifiers?.some(m=>m.kind===ts.SyntaxKind.DefaultKeyword))hasDefault=true;
    if(ts.isExportAssignment(node)&&!node.isExportEquals)hasDefault=true;
    if(ts.isVariableStatement(node)&&node.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword)&&node.declarationList.declarations.some(d=>ts.isIdentifier(d.name)&&d.name.text==="videoConfig"))hasConfig=true;
  }
  if(!hasDefault||!hasConfig||!code.includes("theme")||!code.includes("colors")||!code.includes("typography"))return ["Export a default MotionVideo component and named videoConfig. Read colors and typography from theme."];
  if(!code.includes("useCurrentFrame")||!code.includes("useVideoConfig")||!code.includes("Sequence")||(!code.includes("interpolate")&&!code.includes("spring")))return ["Use Sequence and frame-driven Remotion APIs with timing from useVideoConfig()."];
  const options:ts.CompilerOptions={noEmit:true,strict:true,skipLibCheck:true,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,target:ts.ScriptTarget.ES2020};
  const host=ts.createCompilerHost(options),originalGet=host.getSourceFile.bind(host);
  const normalize=(name:string)=>path.resolve(name).replaceAll("\\","/").toLowerCase();
  host.getSourceFile=(name,language,...rest)=>normalize(name)===normalize(file)?parsed:originalGet(name,language,...rest);
  const program=ts.createProgram([file],options,host);
  return ts.getPreEmitDiagnostics(program).filter(d=>d.category===ts.DiagnosticCategory.Error).slice(0,12).map(d=>ts.flattenDiagnosticMessageText(d.messageText," "));
}

