import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { studioDatabase } from "@/lib/supabase/admin";
import { inngest } from "@/lib/inngest/client";

export async function GET(_req:NextRequest,{params}:{params:Promise<{id:string}>}) {
  try {
    const db=await studioDatabase(),{id}=await params;
    const user=await currentUser();
    const project=await db.from("projects").select("id,user_id,shared").eq("id",id).maybeSingle();
    if(project.error)throw project.error;
    if(!project.data||(!project.data.shared&&project.data.user_id!==user?.id))return NextResponse.json({error:"Project unavailable."},{status:404});
    const [result,saved]=await Promise.all([
      db.from("project_generations").select("*").eq("project_id",id).maybeSingle(),
      db.from("project_video_versions").select("*").eq("project_id",id).order("completed_at",{ascending:false}).limit(1).maybeSingle(),
    ]);
    if(result.error||saved.error)throw result.error||saved.error;
    const version=saved.data;
    const playback=version?{
      project_id:id,run_id:version.run_id,attempt:1,status:"completed",progress:100,error:null,
      brief:version.brief,theme:version.theme,composition_code:version.composition_code,
      video_engine:version.video_engine??"remotion",updated_at:version.completed_at,request_type:"legacy",credit_cost:0,request_prompt:version.request_prompt,
    }:null;
    const generation = result.data && process.env.NODE_ENV === "production" && result.data.error
      ? { ...result.data, error: result.data.error.includes("after two corrections")
        ? "We couldn't match the animation to your brief after two corrections. Try a shorter, more specific prompt. Your reserved credits were returned."
        : "The video could not be created. Please try again later." }
      : result.data;
    return NextResponse.json({generation,playback},{headers:{"Cache-Control":"private, no-store"}});
  }catch{return NextResponse.json({error:"Could not load generation status."},{status:503})}
}

export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}) {
  if(req.headers.get("origin")!==new URL(req.url).origin)return NextResponse.json({error:"Invalid request origin."},{status:403});
  const user=await currentUser();
  if(!user)return NextResponse.json({error:"Please sign in."},{status:401});
  if(!process.env.OPENAI_API_KEY?.trim()){
    console.error("Video generation unavailable: OPENAI_API_KEY is not configured.");
    const message=process.env.NODE_ENV === "production"
      ? "Video generation is temporarily unavailable. Please try again later."
      : "Set OPENAI_API_KEY in .env.local to generate videos. This app calls OpenAI directly.";
    return NextResponse.json({error:message},{status:503});
  }
  try{
    const db=await studioDatabase(),{id}=await params;
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))return NextResponse.json({error:"Invalid project."},{status:400});
    const body=await req.json().catch(()=>({}));
    if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({error:"Invalid request."},{status:400});
    const prompt=typeof body.prompt==="string"?body.prompt.trim():null;
    if((body.prompt!==undefined&&(!prompt||prompt.length>2000))||(body.retry===true&&prompt))return NextResponse.json({error:"Enter a modification prompt of up to 2,000 characters."},{status:400});
    const project=await db.from("projects").select("video_engine").eq("id",id).eq("user_id",user.id).maybeSingle();
    if(project.error)throw project.error;
    if(!project.data)return NextResponse.json({error:"Project unavailable."},{status:404});
    const {data,error}=await db.rpc("queue_project_generation",{target:id,requested_prompt:prompt,retry_requested:body.retry===true,actor_id:user.id});
    if(error){
      if(error.message.includes("insufficient_credits"))return NextResponse.json({error:prompt?"You need 10 credits to modify this video.":"You need 20 credits to generate this video."},{status:402});
      if(error.message.includes("generation_in_progress"))return NextResponse.json({error:"A generation is already running for this project."},{status:409});
      if(error.message.includes("generate_original_first"))return NextResponse.json({error:"Complete the original video before requesting a modification."},{status:409});
      if(error.message.includes("generation_not_retryable"))return NextResponse.json({error:"This generation cannot be retried."},{status:409});
      console.error("Generation queue RPC failed",{code:error.code,message:error.message,details:error.details,hint:error.hint,projectId:id});
      return NextResponse.json({error:"Could not queue generation for this project."},{status:error.code==="42501"?403:500});
    }
    const job=data[0];
    if(job?.status==="queued"){
      const engineUpdate=await db.from("project_generations").update({video_engine:project.data.video_engine}).eq("project_id",id).eq("run_id",job.run_id).eq("status","queued");
      if(engineUpdate.error)throw engineUpdate.error;
      job.video_engine=project.data.video_engine;
      try{await inngest.send({id:"motion-"+job.run_id,name:"video/generation.requested",data:{projectId:id,runId:job.run_id}})}
      catch{
        const message=process.env.INNGEST_DEV==="1"
          ? "The local Inngest worker is offline. Run `npm.cmd run inngest:dev`, then retry; your credits will not be charged again."
          : "The generation queue is temporarily unavailable. Retry this same run; your credits will not be charged again.";
        return NextResponse.json({error:message},{status:503});
      }
    }
    const balance=await db.from("users").select("credit").maybeSingle();
    return NextResponse.json({generation:job,credit:balance.data?.credit??null},{headers:{"Cache-Control":"private, no-store"}});
  }catch{return NextResponse.json({error:"Could not start generation. Please try again."},{status:503})}
}

