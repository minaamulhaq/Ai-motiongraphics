import { readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const functionsPath=path.join(process.cwd(),"lib/inngest/functions.ts");
const sourceText=await readFile(functionsPath,"utf8");
const sourceFile=ts.createSourceFile(functionsPath,sourceText,ts.ScriptTarget.ESNext,true,ts.ScriptKind.TS);
const declaration=sourceFile.statements.find((node)=>ts.isFunctionDeclaration(node)&&node.name?.text==="buildSafeComposition");
if(!declaration)throw new Error("buildSafeComposition was not found.");

const runnable=ts.transpileModule(`${declaration.getText(sourceFile)}\nexport {buildSafeComposition};`,{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},
}).outputText;
const moduleUrl=`data:text/javascript;base64,${Buffer.from(runnable).toString("base64")}`;
const {buildSafeComposition}=await import(moduleUrl);
const code=buildSafeComposition({
  brief:{title:'Ideas "into" motion',direction:"Kinetic typography",scenes:[{description:"Ideas become confident motion",startFrame:0,endFrame:75},{description:"A clear visual finish",startFrame:75,endFrame:150}]},
  theme:{colors:{background:"#111111",foreground:"#ffffff",primary:"#ff6b2c",secondary:"#b8b8c0"},typography:{fontFamily:"Arial",headingWeight:800,bodySize:36},mood:"Confident and precise",motion:{intensity:"energetic",transitionFrames:12}},
  width:1920,height:1080,fps:30,durationInFrames:150,
});

const virtualFile=path.join(process.cwd(),"GeneratedMotion.tsx");
const parsed=ts.createSourceFile(virtualFile,code,ts.ScriptTarget.ESNext,true,ts.ScriptKind.TSX);
const options={noEmit:true,strict:true,skipLibCheck:true,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,target:ts.ScriptTarget.ES2020};
const host=ts.createCompilerHost(options),originalGet=host.getSourceFile.bind(host);
const normalize=(name)=>path.resolve(name).replaceAll("\\","/").toLowerCase();
host.getSourceFile=(name,language,...rest)=>normalize(name)===normalize(virtualFile)?parsed:originalGet(name,language,...rest);
const diagnostics=ts.getPreEmitDiagnostics(ts.createProgram([virtualFile],options,host)).filter((item)=>item.category===ts.DiagnosticCategory.Error);
if(diagnostics.length)throw new Error(diagnostics.map((item)=>ts.flattenDiagnosticMessageText(item.messageText," ")).join("\n"));
for(const required of ["Interactive.Div","useCurrentFrame","useVideoConfig","Sequence","videoConfig"]){
  if(!code.includes(required))throw new Error(`Generated fallback is missing ${required}.`);
}
if(/(?:animation|transition)\s*:/i.test(code))throw new Error("Generated fallback contains CSS animation or transition styles.");
console.log("Remotion skill-aligned fallback passed TypeScript validation.");
