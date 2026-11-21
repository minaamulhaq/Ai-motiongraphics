import { z } from "zod";
import { NonRetriableError } from "inngest";
import { motionFonts, motionIntensities } from "@/lib/motion-theme";
export const themeSchema=z.object({
  colors:z.object({background:z.string().regex(/^#[0-9a-f]{6}$/i),foreground:z.string().regex(/^#[0-9a-f]{6}$/i),primary:z.string().regex(/^#[0-9a-f]{6}$/i),secondary:z.string().regex(/^#[0-9a-f]{6}$/i)}),
  typography:z.object({fontFamily:z.enum(motionFonts),headingWeight:z.number().int().min(400).max(900),bodySize:z.number().min(20).max(80)}),
  mood:z.string().trim().min(1).max(300), motion:z.object({intensity:z.enum(motionIntensities),transitionFrames:z.number().int().min(3).max(45)})
});
export const briefSchema=z.object({
  title:z.string().max(120), direction:z.string().max(5000),
  searchDemo:z.object({query:z.string().trim().min(1).max(80),features:z.array(z.string().trim().min(1).max(70)).min(1).max(8)}).nullish(),
  scenes:z.array(z.object({description:z.string().max(2500),headline:z.string().max(100).optional(),startFrame:z.number().int().nonnegative(),endFrame:z.number().int().positive()})).min(1).max(12)
});
export async function generateText(system:string,prompt:string,json=false) {
  const openai=process.env.OPENAI_API_KEY?.trim();
  // Prefer direct OpenAI when configured, even if an older OpenRouter key remains.
  const router=openai?undefined:process.env.OPENROUTER_API_KEY?.trim();
  if(!router&&!openai)throw new Error("Configure OPENROUTER_API_KEY or OPENAI_API_KEY.");
  // The free preview model frequently truncates full Remotion TSX compositions.
  // Use a paid model with a larger output budget unless explicitly overridden.
  const routerModel=process.env.OPENROUTER_MODEL||"openai/gpt-4.1";
  const model=router?routerModel:(process.env.OPENAI_MODEL||"gpt-4.1");
  for(let attempt=0;attempt<2;attempt++){
  const response=await fetch(router?"https://openrouter.ai/api/v1/chat/completions":"https://api.openai.com/v1/chat/completions",{
    method:"POST",headers:{"Authorization":"Bearer "+(router||openai),"Content-Type":"application/json"},
    body:JSON.stringify({model,messages:[{role:"system",content:system},{role:"user",content:prompt}],max_tokens:json?7000:24000,...(json?{response_format:{type:"json_object"}}:{})}),
    signal:AbortSignal.timeout(240000)
  });
  if(response.status===401)throw new NonRetriableError("The configured AI provider API key was rejected. Check the server environment variables.");
  if(response.status===402)throw new NonRetriableError("AI provider credits or key spending limit cannot cover this request.");
  if(response.status===429){
    const errorBody=await response.json().catch(()=>({}));
    const providerCode=String(errorBody.error?.code||errorBody.error?.type||"");
    const providerMessage=String(errorBody.error?.message||"");
    const quota=/quota|billing|credit|insufficient/i.test(providerCode+" "+providerMessage);
    if(quota)throw new NonRetriableError("AI provider quota or billing limit reached (HTTP 429). Check billing and usage limits for the configured API key.");
    if(attempt===0){
      const retryAfter=Number(response.headers.get("retry-after"));
      const delay=Number.isFinite(retryAfter)&&retryAfter>0?Math.min(retryAfter*1000,30000):2000;
      await new Promise(resolve=>setTimeout(resolve,delay));
      continue;
    }
    throw new Error("AI provider rate limit reached twice (HTTP 429). Wait briefly and retry.");
  }
  if(!response.ok){
    const body=await response.json().catch(()=>({}));
    throw new Error("AI provider request failed (HTTP "+response.status+"): "+String(body.error?.message||"No provider detail returned."));
  }
  const data=await response.json();
  if(data.error)throw new Error("AI provider could not complete the generation.");
  const choice=data.choices?.[0];
  if(choice?.message?.refusal||choice?.finish_reason==="content_filter")throw new NonRetriableError("AI provider declined this generation request.");
  const content=choice?.message?.content;
  const text=typeof content==="string"?content:Array.isArray(content)
    ? content.filter((part: {type?:string;text?:unknown})=>part.type==="text"&&typeof part.text==="string").map((part:{text:string})=>part.text).join("") : "";
  if(!text.trim()){
    console.warn("AI provider returned no output text",{model,attempt:attempt+1,finishReason:choice?.finish_reason??null,completionTokens:data.usage?.completion_tokens??null});
    if(attempt===0){await new Promise(resolve=>setTimeout(resolve,1000));continue;}
    throw new Error("AI provider returned an empty response after two attempts. Model: "+model+"; finish reason: "+(choice?.finish_reason||"missing")+".");
  }
  if(choice?.finish_reason==="length")throw new Error("AI provider output reached its token limit. Request a shorter composition or increase the output budget.");
  return text.trim().replace(/^\`\`\`(?:json|tsx|typescript)?\s*/,"").replace(/\s*\`\`\`$/,"");
  }
  throw new Error("AI provider returned no usable output.");
}
