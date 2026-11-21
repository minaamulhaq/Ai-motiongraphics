import type {CSSProperties} from "react";
import {AbsoluteFill,Easing,Sequence,interpolate,spring,useCurrentFrame,useVideoConfig} from "remotion";
import type {MotionTheme} from "@/lib/motion-theme";
import {BotMessageSquare,CalendarClock,Headset,Search} from "lucide-react";

export type RuntimeMotionTheme=MotionTheme;
export type RuntimeScene={description:string;startFrame:number;endFrame:number};
export type ProjectMotionVideoProps={title:string;prompt:string;art:string;theme:RuntimeMotionTheme;scenes:RuntimeScene[];searchDemo?:{query?:string;features?:string[]}};

const clamp={extrapolateLeft:"clamp",extrapolateRight:"clamp"} as const;

function SceneArtwork({art,theme,index}:{art:string;theme:RuntimeMotionTheme;index:number}){
  const frame=useCurrentFrame();
  const {fps,durationInFrames,width,height}=useVideoConfig();
  const strength=theme.motion.intensity==="energetic"?1.4:theme.motion.intensity==="subtle"?.65:1;
  const shared:CSSProperties={position:"absolute",border:`2px solid ${theme.colors.secondary}`,opacity:.42};
  if(art==="terrain")return <>
    {[0,1,2,3,4].map(line=><div key={line} style={{...shared,left:`${8+line*12}%`,top:`${10+line*7}%`,width:`${82-line*8}%`,height:`${70-line*8}%`,borderRadius:"50%",rotate:interpolate(frame,[0,durationInFrames],[`${-9+line*4}deg`,`${8+line*6}deg`],clamp),translate:interpolate(frame,[0,durationInFrames],["-30px 20px","35px -15px"],clamp)}}/>) }
  </>;
  if(art==="tide")return <>
    {[0,1,2,3].map(wave=><div key={wave} style={{position:"absolute",left:"-12%",top:`${18+wave*19}%`,width:"124%",height:Math.max(44,height*.08),borderRadius:"50%",borderTop:`${Math.max(3,width*.003)}px solid ${wave%2?theme.colors.primary:theme.colors.secondary}`,opacity:.35+.1*wave,translate:interpolate(frame,[0,durationInFrames],[`${-80*strength}px 0px`,`${80*strength}px ${wave%2?24:-24}px`],clamp),scale:interpolate(frame,[0,durationInFrames],[1,1.06],clamp)}}/>) }
  </>;
  if(art==="chrome")return <>
    {[0,1,2].map(orb=><div key={orb} style={{position:"absolute",width:Math.min(width,height)*(.32-orb*.055),height:Math.min(width,height)*(.32-orb*.055),borderRadius:"50%",right:`${8+orb*18}%`,top:`${8+orb*15}%`,background:`linear-gradient(${125+orb*35}deg,${theme.colors.foreground}bb,${theme.colors.primary}66 42%,${theme.colors.background} 78%)`,boxShadow:`0 0 ${80+orb*30}px ${theme.colors.primary}44`,rotate:interpolate(frame,[0,durationInFrames],[`${orb*22}deg`,`${180+orb*55}deg`],clamp),scale:spring({frame:frame-orb*5,fps,config:{damping:18,stiffness:90}})}}/>) }
  </>;
  return <>
    {[0,1,2,3].map(orb=><div key={orb} style={{...shared,width:Math.min(width,height)*(.52-orb*.08),height:Math.min(width,height)*(.52-orb*.08),borderRadius:"50%",right:`${-8+orb*7}%`,top:`${-15+orb*8}%`,borderColor:orb%2?theme.colors.primary:theme.colors.secondary,rotate:interpolate(frame,[0,durationInFrames],[`${index*18+orb*13}deg`,`${index*18+155+orb*35}deg`],clamp),scale:interpolate(frame,[0,durationInFrames],[.82,1.12],clamp)}}/>) }
  </>;
}

function MotionScene({index,art,theme}:{index:number;art:string;theme:RuntimeMotionTheme}){
  const frame=useCurrentFrame();
  const {durationInFrames}=useVideoConfig();
  const exitStart=Math.max(0,durationInFrames-theme.motion.transitionFrames);
  return <AbsoluteFill style={{backgroundColor:theme.colors.background,color:theme.colors.foreground,fontFamily:theme.typography.fontFamily,overflow:"hidden",opacity:interpolate(frame,[exitStart,durationInFrames],[1,0],{...clamp,easing:Easing.bezier(.4,0,1,1)})}}>
    <AbsoluteFill style={{background:`radial-gradient(circle at 76% 18%,${theme.colors.primary}55,transparent 38%),linear-gradient(145deg,${theme.colors.background},${theme.colors.secondary}18)`}}/>
    <SceneArtwork art={art} theme={theme} index={index}/>
  </AbsoluteFill>;
}

function SearchFeatures({query,features,theme}:{query:string;features:string[];theme:RuntimeMotionTheme}){
  const frame=useCurrentFrame();
  const {width,height,durationInFrames,fps}=useVideoConfig();
  const scale=Math.min(width/1920,height/1080);
  const timeline=Math.min(1,durationInFrames/180);
  const at=(frame:number)=>Math.round(frame*timeline);
  const cardWidth=480*scale,gap=60*scale,rowWidth=cardWidth*3+gap*2,left=(width-rowWidth)/2;
  const icons=[BotMessageSquare,Headset,CalendarClock];
  return <AbsoluteFill style={{backgroundColor:theme.colors.background,color:theme.colors.foreground,fontFamily:theme.typography.fontFamily,overflow:"hidden"}}>
    <div style={{position:"absolute",inset:0,background:`radial-gradient(ellipse at 50% 39%,${theme.colors.primary}12,transparent 55%)`}}/>
    <div style={{position:"absolute",top:300*scale,left:"50%",translate:"-50% 0",width:1200*scale,height:88*scale,border:`2px solid ${theme.colors.primary}`,borderRadius:18*scale,backgroundColor:"#17130f",boxShadow:`0 0 20px ${theme.colors.primary}28`,display:"flex",alignItems:"center",gap:24*scale,padding:`0 ${32*scale}px`,boxSizing:"border-box"}}><Search size={28*scale} color={theme.colors.primary}/><span style={{fontSize:38*scale,fontWeight:600,flex:1}}>{query}</span><span style={{fontSize:17*scale,color:theme.colors.secondary,opacity:interpolate(frame,[0,Math.max(1,at(20))],[1,0],clamp)}}>Searching...</span></div>
    <div style={{position:"absolute",top:430*scale,width:"100%",textAlign:"center",fontSize:22*scale,letterSpacing:2*scale,color:theme.colors.secondary,opacity:interpolate(frame,[at(15),Math.max(at(16),at(25))],[0,1],clamp)}}>Features</div>
    {features.slice(0,3).map((label,index)=>{const start=at(25+index*12),Icon=icons[index];const enter=spring({frame:Math.max(0,frame-start),fps,config:{damping:22,stiffness:105}});const pulseStart=at(110+index*12);return <div key={index} style={{position:"absolute",left:left+index*(cardWidth+gap),top:540*scale,width:cardWidth,height:240*scale,boxSizing:"border-box",border:`1px solid ${theme.colors.primary}77`,borderRadius:16*scale,backgroundColor:"#151311",padding:26*scale,opacity:interpolate(frame,[start,Math.max(start+1,at(35+index*12))],[0,1],clamp),translate:`0 ${(1-enter)*42*scale}px`,boxShadow:"0 12px 34px #00000038"}}><div style={{position:"absolute",left:0,top:0,width:"100%",height:3*scale,backgroundColor:theme.colors.primary,opacity:interpolate(frame,[pulseStart,Math.max(pulseStart+1,at(115+index*12)),Math.max(pulseStart+2,at(122+index*12))],[.45,1,.45],clamp)}}/><Icon size={38*scale} color={theme.colors.primary} strokeWidth={1.6}/><div style={{marginTop:30*scale,fontSize:30*scale,fontWeight:650}}>{label}</div></div>})}
    <div style={{position:"absolute",top:818*scale,left,width:rowWidth,height:1*scale,backgroundColor:theme.colors.primary,opacity:interpolate(frame,[at(160),Math.max(at(161),at(180))],[0,.4],clamp)}}/>
    <div style={{position:"absolute",top:832*scale,left:left+rowWidth-28*scale,fontSize:22*scale,color:theme.colors.secondary,opacity:interpolate(frame,[at(160),Math.max(at(161),at(180))],[0,.5],clamp)}}>…</div>
  </AbsoluteFill>;
}

export function ProjectMotionVideo({art,theme,scenes,searchDemo}:ProjectMotionVideoProps){
  const demo=searchDemo?.query&&searchDemo.features?.length?searchDemo:null;
  if(demo)return <SearchFeatures query={demo.query!} features={demo.features!} theme={theme}/>;
  return <AbsoluteFill style={{backgroundColor:theme.colors.background}}>{scenes.map((scene,index)=><Sequence key={`${scene.startFrame}-${index}`} name={`Scene ${index+1}`} from={scene.startFrame} durationInFrames={Math.max(1,scene.endFrame-scene.startFrame)} premountFor={Math.min(15,scene.startFrame)}><MotionScene index={index} art={art} theme={theme}/></Sequence>)}</AbsoluteFill>;
}
