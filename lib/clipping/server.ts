import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {S3Client} from '@aws-sdk/client-s3';
export function clipDatabase(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw new Error('Database configuration missing');
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
export function clipStorage(){
 // Reuse the existing Remotion bucket when a dedicated clipping bucket is not configured.
 const bucket=process.env.CLIP_S3_BUCKET||process.env.REMOTION_LAMBDA_BUCKET;
 if(!bucket)throw new Error('Clip storage configuration missing');
 const region=process.env.AWS_REGION||process.env.REMOTION_AWS_REGION;
 if(!region)throw new Error('AWS region configuration missing');
 const accessKeyId=process.env.AWS_ACCESS_KEY_ID||process.env.REMOTION_AWS_ACCESS_KEY_ID;
 const secretAccessKey=process.env.AWS_SECRET_ACCESS_KEY||process.env.REMOTION_AWS_SECRET_ACCESS_KEY;
 const credentials=accessKeyId&&secretAccessKey?{accessKeyId,secretAccessKey}:undefined;
 return {bucket,client:new S3Client({region,credentials})};
}
