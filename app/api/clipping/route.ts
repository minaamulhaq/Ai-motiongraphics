import {auth} from '@clerk/nextjs/server';
import {randomUUID} from 'node:crypto';
import {PutObjectCommand,HeadObjectCommand,GetObjectCommand} from '@aws-sdk/client-s3';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';
import {z} from 'zod';
import {clipDatabase,clipStorage} from '@/lib/clipping/server';
import {inngest} from '@/lib/inngest/client';
const input=z.object({name:z.string().min(1).max(255),size:z.number().int().min(1).max(524288000),count:z.number().int().min(1).max(10),ratio:z.literal('9:16')});
export async function POST(request:Request){
 const {userId}=await auth();if(!userId)return Response.json({error:'Please sign in.'},{status:401});
 try{
  const body=await request.json();const db=clipDatabase();const {client,bucket}=clipStorage();
  if(body.action==='complete'){
   const id=z.string().uuid().parse(body.id);
   const {data:job,error}=await db.from('clip_jobs').select('*').eq('id',id).eq('owner_id',userId).single();
   if(error||!job)return Response.json({error:'Upload not found.'},{status:404});
   if(job.status==='uploading'){
   const object=await client.send(new HeadObjectCommand({Bucket:bucket,Key:job.source_key}));
   if(object.ContentLength!==job.source_size)return Response.json({error:'Upload incomplete. Please upload again.'},{status:400});
   }
   const queued=await db.rpc('queue_paid_clip',{p_owner:userId,p_job:id});
   if(queued.error)throw queued.error;
   if(queued.data==='busy')return Response.json({error:'Wait for your current video to finish.'},{status:409});
   if(queued.data==='insufficient')return Response.json({error:'You need 100 credits to clip a video.'},{status:402});
   if(queued.data!=='queued')return Response.json({id});
   try{await inngest.send({id:`clip-${id}`,name:'video/clipping.requested',data:{jobId:id,ownerId:userId}});}catch(err){
    await db.from('clip_jobs').update({stage:'Queue delivery pending'}).eq('id',id).eq('status','queued');throw err;
   }
   return Response.json({id});
  }
  const parsed=input.parse(body);const id=randomUUID();const key=`clipping/${userId}/${id}/source`;
  const active=await db.from('clip_jobs').select('id',{count:'exact',head:true}).eq('owner_id',userId).in('status',['queued','processing']);
  if(active.error)throw active.error;
  if((active.count||0)>=1)return Response.json({error:'Please wait for your current video to finish.'},{status:409});
  const balance=await db.from('users').select('credit').eq('id',userId).maybeSingle();
  if(balance.error)throw balance.error;
  if((balance.data?.credit??0)<100)return Response.json({error:'You need 100 credits to clip a video.'},{status:402});
  const result=await db.from('clip_jobs').insert({id,owner_id:userId,source_key:key,source_name:parsed.name,source_size:parsed.size,requested_clips:parsed.count,ratio:parsed.ratio});
  if(result.error)throw result.error;
  const url=await getSignedUrl(client,new PutObjectCommand({Bucket:bucket,Key:key,ContentType:'application/octet-stream',ContentLength:parsed.size}),{expiresIn:900});
  return Response.json({id,url});
 }catch(error){if(error instanceof z.ZodError||error instanceof SyntaxError)return Response.json({error:'Check the upload details. Maximum size is 500 MB.'},{status:400});console.error('Clipping request failed',error);return Response.json({error:'Clipping is temporarily unavailable. Please try again later.'},{status:503});}
}
export async function GET(){
 const {userId}=await auth();if(!userId)return Response.json({error:'Please sign in.'},{status:401});
 try{const db=clipDatabase();const {data,error}=await db.from('clip_jobs').select('id,source_name,status,stage,progress,error,outputs,created_at').neq('status','uploading').eq('owner_id',userId).order('created_at',{ascending:false}).limit(20);if(error){if(['42P01','PGRST205'].includes(error.code))return Response.json({jobs:[],available:false},{headers:{'Cache-Control':'private, no-store'}});throw error;}
 const {client,bucket}=clipStorage();
 const jobs=await Promise.all((data||[]).map(async job=>({...job,outputs:await Promise.all((job.outputs as {key:string;title:string;duration:number}[]).map(async output=>({title:output.title,duration:output.duration,url:await getSignedUrl(client,new GetObjectCommand({Bucket:bucket,Key:output.key}),{expiresIn:3600})})))})));
 return Response.json({jobs,available:true},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){console.error('Clipping results failed',error);return Response.json({error:'Your clips could not be loaded. Please try again.'},{status:503});}
}
