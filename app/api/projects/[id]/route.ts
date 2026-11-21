import { currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { studioDatabase } from "@/lib/supabase/admin";
import { durations, ratios } from "@/lib/studio";
import { themeSchema, generateText } from "@/lib/ai/generate";
import { generateStructured } from "@/lib/ai/structured";
import { z } from "zod";

const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
type Context={params:Promise<{id:string}>};

async function accessible(id:string) {
  const user=await currentUser(), db=await studioDatabase();
  if(!/^[0-9a-f-]{36}$/i.test(id))return null;
  const {data:project,error}=await db.from("projects").select("*").eq("id",id).maybeSingle();
  if(error)throw error;
  if(!project || (!project.shared && project.user_id!==user?.id))return null;
  return {db,project,canEdit:!!user && project.user_id===user.id};
}
export async function GET(_req:NextRequest,{params}:Context) {
  try {
    const found=await accessible((await params).id);
    if(!found)return reply({error:"This project is unavailable."},404);
    const {db,project,canEdit}=found;
    const history=canEdit ? await db.from("project_messages").select("id,role,content,created_at").eq("project_id",project.id).order("created_at").limit(200) : {data:[],error:null};
    if(history.error)throw history.error;
    return reply({project,messages:history.data,canEdit});
  }catch{return reply({error:"Could not load the project. Please try again."},503)}
}
export async function PATCH(req:NextRequest,{params}:Context) {
  if(req.headers.get("origin")!==new URL(req.url).origin)return reply({error:"Invalid request origin."},403);
  try {
    const found=await accessible((await params).id);
    if(!found)return reply({error:"This project is unavailable."},404);
    if(!found.canEdit)return reply({error:"Only the creator can edit this project."},403);
    const body=await req.json();
    const {db,project}=found;
    if(body.action==="theme"){
      const parsedTheme=themeSchema.safeParse(body.themeConfig);
      if(!parsedTheme.success||!durations.includes(body.seconds)||!ratios.includes(body.ratio))return reply({error:"Check the colors, typography, motion and screen format."},400);
      const {data,error}=await db.from("projects").update({theme_config:parsedTheme.data,seconds:body.seconds,ratio:body.ratio}).eq("id",project.id).select().single();
      if(error)throw error;
      return reply({project:data});
    }
    if(body.action==="chat"){
      const text=typeof body.content==="string"?body.content.trim():"";
      if(!text || text.length>2000)return reply({error:"Enter a message of up to 2,000 characters."},400);
      const answer=await generateStructured("scene assistant",z.object({content:z.string().min(1).max(2000),editPrompt:z.string().min(1).max(2000).nullable()}),
        'You are a video editing assistant. Return JSON {content:string,editPrompt:string|null}. For questions, answer briefly and set editPrompt=null. For an actionable edit, explain the proposed change and return a complete revised video brief in editPrompt. Preserve existing subjects, exact feature labels and sequence except where the user requests changes. Ask for clarification if needed. Never invent product claims. Do not claim the edit has been applied. Applying the draft costs 10 credits. Chat does not deduct credits. True 3D rendering is not currently supported.',
        instructions=>generateText(instructions,JSON.stringify({videoBrief:project.prompt,message:text}),true));
      const content=answer.content;
      const {data,error}=await db.from("project_messages").insert([
        {project_id:project.id,role:"user",content:text,created_at:new Date().toISOString()},
        {project_id:project.id,role:"assistant",content,created_at:new Date(Date.now()+1).toISOString()}
      ]).select("id,role,content,created_at");
      if(error)throw error;
      return reply({messages:data,editPrompt:answer.editPrompt});
    }
    return reply({error:"Unknown action."},400);
  }catch{return reply({error:"Could not save your changes. Please try again."},503)}
}
