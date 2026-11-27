import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { exportProjectVideo, generateMotion } from "@/lib/inngest/functions";
import { processClippingJob } from "@/lib/inngest/clipping";
export const maxDuration = 300;
const handlers=serve({client:inngest,functions:[generateMotion,exportProjectVideo,processClippingJob]});
const protectedHandler=(handler:typeof handlers.POST)=>async(request:Parameters<typeof handler>[0],context:Parameters<typeof handler>[1])=>{
  const local=process.env.INNGEST_DEV==="1";
  if(!local&&(!process.env.INNGEST_SIGNING_KEY||!process.env.INNGEST_EVENT_KEY)){
    return Response.json({error:"Inngest production keys are not configured."},{status:503});
  }
  try{
    return await handler(request,context);
  }catch(error){
    const message=error instanceof Error?error.message:"";
    const code=typeof error==="object"&&error!==null&&"code" in error?String(error.code):"";
    const interruptedLocalSync=local&&request.method==="PUT"&&(request.signal.aborted||code==="ECONNRESET"||/aborted/i.test(message));
    if(interruptedLocalSync)return Response.json({error:"The local Inngest sync request was interrupted; retry it."},{status:503});
    throw error;
  }
};
// In cloud mode the Inngest SDK validates the request signature before it
// executes or synchronizes a function. Local development is explicitly opted in.
export const GET=protectedHandler(handlers.GET);
export const POST=protectedHandler(handlers.POST);
export const PUT=protectedHandler(handlers.PUT);

