export const ratios = ["16:9", "9:16", "1:1"] as const;
export const ratioOptions = [
  {value:"16:9",label:"YouTube video",detail:"Landscape"},
  {value:"9:16",label:"YouTube Shorts",detail:"Mobile portrait"},
  {value:"1:1",label:"Square social",detail:"Feed post"},
] as const;
export const durations = [5, 10, 20] as const;
export const artworks = ["ember", "chrome", "terrain", "tide"] as const;
export type Artwork = typeof artworks[number];
export type Project = {
  id: string; title: string; prompt: string; art: Artwork; seconds: number;
  ratio: string; creator: string; hue: number; theme_config?:unknown; created_at?:string;
  playback?:{
    brief:unknown; theme:unknown; request_prompt:string|null; completed_at:string;
    composition_code?:string|null;
    video_engine?:"remotion"|"hyperframes";
  };
};
export function motionStyle(prompt: string) {
  const hash = Array.from(prompt).reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))>>>0,0);
  const art = /fire|orange|ember/i.test(prompt) ? "ember" : /green|terrain|landscape|mountain/i.test(prompt) ? "terrain" : /water|blue|ocean/i.test(prompt) ? "tide" : /silver|chrome|purple/i.test(prompt) ? "chrome" : artworks[hash % artworks.length];
  return {art, hue: (hash % 35)-17};
}
