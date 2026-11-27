import {DashboardHome} from '@/components/dashboard';
import {notFound} from 'next/navigation';
export const instant = false;
export default async function Page({params,searchParams}:{params:Promise<{section:string}>;searchParams:Promise<{q?:string}>}){const {section}=await params;const {q}=await searchParams;if(!['generate','motion-1','motion-2','auto-clipping','smart-highlights','scene-split','projects','assets','templates','workflows','exports','tools','help'].includes(section))notFound();return <DashboardHome key={section} section={section} query={typeof q==='string'?q:''}/>}
