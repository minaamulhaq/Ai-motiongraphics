export const generationStages = [
  {status:"queued",label:"Credits reserved · Queued"},
  {status:"loading_project",label:"Loading project"},
  {status:"generating_prompt",label:"Planning the motion"},
  {status:"generating_theme",label:"Creating the theme"},
  {status:"generating_composition",label:"Writing the Remotion composition"},
  {status:"validating",label:"Validating the composition"},
] as const;
export type Generation = {
  project_id:string; run_id:string; attempt:number; status:string;
  progress:number; error:string|null; brief:unknown; theme:unknown;
  composition_code:string|null; updated_at:string; request_type:"legacy"|"new_video"|"modification";
  credit_cost:number; request_prompt:string|null;
};

