const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const source=fs.readFileSync('lib/inngest/job-identity.ts','utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const moduleExports={};
new Function('exports',code)(moduleExports);
const {generationIdentity}=moduleExports;
const id='fab3dfb7-6c06-4db1-9972-15d06185174b';
test('failure event without IDs cannot produce a partial RPC payload',()=>{
  for(const value of [undefined,null,{}, {projectId:id},{runId:id},{projectId:'undefined',runId:id}])assert.equal(generationIdentity(value),null);
});
test('valid identity preserves both named RPC arguments',()=>{
  const identity=generationIdentity({projectId:id,runId:id});
  assert.deepEqual(JSON.parse(JSON.stringify({target:identity.projectId,target_run:identity.runId,failure_message:'failed'})),{target:id,target_run:id,failure_message:'failed'});
});
