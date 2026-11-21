import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { exportProjectVideo, generateMotion } from "@/lib/inngest/functions";
export const maxDuration = 300;
const handlers=serve({client:inngest,functions:[generateMotion,exportProjectVideo]});
const protectedHandler=(handler:typeof handlers.POST)=>async(request:Parameters<typeof handler>[0],context:Parameters<typeof handler>[1])=>{
  const local=process.env.INNGEST_DEV==="1";
  if(!local&&(!process.env.INNGEST_SIGNING_KEY||!process.env.INNGEST_EVENT_KEY)){
    return Response.json({error:"Inngest production keys are not configured."},{status:503});
  }
  return handler(request,context);
};
// In cloud mode the Inngest SDK validates the request signature before it
// executes or synchronizes a function. Local development is explicitly opted in.
export const GET=protectedHandler(handlers.GET);
export const POST=protectedHandler(handlers.POST);
export const PUT=protectedHandler(handlers.PUT);

