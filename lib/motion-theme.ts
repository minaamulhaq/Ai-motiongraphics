export const motionFonts=["Arial","Georgia","Verdana","Trebuchet MS"] as const;
export const motionIntensities=["subtle","balanced","energetic"] as const;

export type MotionTheme={
  colors:{background:string;foreground:string;primary:string;secondary:string};
  typography:{fontFamily:typeof motionFonts[number];headingWeight:number;bodySize:number};
  mood:string;
  motion:{intensity:typeof motionIntensities[number];transitionFrames:number};
};

export const defaultMotionThemes:Record<string,MotionTheme>={
  ember:{colors:{background:"#11100f",foreground:"#fff8f1",primary:"#ff7043",secondary:"#d8b7a5"},typography:{fontFamily:"Arial",headingWeight:800,bodySize:34},mood:"Warm, sculptural and confident",motion:{intensity:"energetic",transitionFrames:12}},
  chrome:{colors:{background:"#101016",foreground:"#faf8ff",primary:"#a98cff",secondary:"#c8c1dc"},typography:{fontFamily:"Verdana",headingWeight:700,bodySize:32},mood:"Polished, precise and luminous",motion:{intensity:"balanced",transitionFrames:15}},
  terrain:{colors:{background:"#10140f",foreground:"#f3f7ed",primary:"#8da866",secondary:"#bdc9ad"},typography:{fontFamily:"Trebuchet MS",headingWeight:700,bodySize:32},mood:"Organic, tactile and grounded",motion:{intensity:"subtle",transitionFrames:18}},
  tide:{colors:{background:"#08131d",foreground:"#f2f9ff",primary:"#258be8",secondary:"#9fc8e8"},typography:{fontFamily:"Arial",headingWeight:800,bodySize:34},mood:"Fluid, focused and atmospheric",motion:{intensity:"balanced",transitionFrames:15}},
};

const isHex=(value:unknown):value is string=>typeof value==="string"&&/^#[0-9a-f]{6}$/i.test(value);
export function resolveMotionTheme(value:unknown,art="ember"):MotionTheme{
  const fallback=defaultMotionThemes[art]||defaultMotionThemes.ember;
  if(!value||typeof value!=="object")return fallback;
  const item=value as Record<string,unknown>,colors=item.colors as Record<string,unknown>|undefined,typography=item.typography as Record<string,unknown>|undefined,motion=item.motion as Record<string,unknown>|undefined;
  return {
    colors:{background:isHex(colors?.background)?colors.background:fallback.colors.background,foreground:isHex(colors?.foreground)?colors.foreground:fallback.colors.foreground,primary:isHex(colors?.primary)?colors.primary:fallback.colors.primary,secondary:isHex(colors?.secondary)?colors.secondary:fallback.colors.secondary},
    typography:{fontFamily:motionFonts.includes(typography?.fontFamily as typeof motionFonts[number])?typography?.fontFamily as MotionTheme["typography"]["fontFamily"]:fallback.typography.fontFamily,headingWeight:typeof typography?.headingWeight==="number"?typography.headingWeight:fallback.typography.headingWeight,bodySize:typeof typography?.bodySize==="number"?typography.bodySize:fallback.typography.bodySize},
    mood:typeof item.mood==="string"?item.mood:fallback.mood,
    motion:{intensity:motionIntensities.includes(motion?.intensity as typeof motionIntensities[number])?motion?.intensity as MotionTheme["motion"]["intensity"]:fallback.motion.intensity,transitionFrames:typeof motion?.transitionFrames==="number"?motion.transitionFrames:fallback.motion.transitionFrames},
  };
}
