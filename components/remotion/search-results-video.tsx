import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from "remotion";
import type {MotionTheme} from "@/lib/motion-theme";

export type SearchDemo = {query: string; features: string[]};

export function SearchResultsVideo({query, features, theme}: SearchDemo & {theme: MotionTheme}) {
  const frame = useCurrentFrame();
  const {durationInFrames, width, height} = useVideoConfig();
  const reveal = Math.round(durationInFrames * 0.4);
  const typed = Math.ceil(query.length * Math.min(1, (frame + 1) / (reveal * 0.65)));
  const size = Math.min(width, height) * 0.048;
  const accent = theme.colors.primary;
  // Keep the query legible even when the saved foreground matches the background.
  const ink = (color: string) => {
    const channels = [1,3,5].map(i => parseInt(color.slice(i,i+2),16)/255)
      .map(x => x <= 0.04045 ? x/12.92 : ((x+0.055)/1.055)**2.4);
    return channels[0]*0.2126 + channels[1]*0.7152 + channels[2]*0.0722;
  };
  const bg = ink(theme.colors.background), fg = ink(theme.colors.foreground);
  const color = (Math.max(bg,fg)+0.05)/(Math.min(bg,fg)+0.05) >= 4.5
    ? theme.colors.foreground : bg > 0.179 ? "#101010" : "#ffffff";
  return <AbsoluteFill style={{backgroundColor:theme.colors.background,color,fontFamily:theme.typography.fontFamily,
    paddingTop:height*0.23,alignItems:"center"}}>
    <div style={{width:"80%",maxWidth:1150,fontSize:size}}>
      <div style={{display:"flex",alignItems:"center",gap:size*0.5,padding:"0.5em 0.7em",border:"3px solid "+accent,borderRadius:"0.45em"}}>
        <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2"><circle cx="10" cy="10" r="6.5"/><path d="m15 15 6 6"/></svg>
        <strong style={{flex:1,overflowWrap:"anywhere",fontWeight:theme.typography.headingWeight}}>{query.slice(0,typed)}</strong>
        {frame<reveal && <span style={{fontSize:"0.46em"}}>Searching…</span>}
      </div>
      {features.map((label,index)=>{
        const start = reveal + Math.round(index * durationInFrames * 0.28 / features.length);
        const opacity = interpolate(frame,[start,start+Math.max(2,Math.min(theme.motion.transitionFrames,durationInFrames*0.1))],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});
        return <div key={index} style={{opacity,translate:`0 ${(1-opacity)*size*0.35}px`,padding:"0.55em 0.75em",fontSize:"0.8em",borderBottom:"1px solid "+theme.colors.secondary+"55"}}>{label}</div>;
      })}
    </div>
  </AbsoluteFill>;
}
