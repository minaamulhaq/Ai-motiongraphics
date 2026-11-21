alter table public.projects
  add column if not exists theme_config jsonb;

alter table public.projects drop constraint if exists projects_ratio_check;
alter table public.projects add constraint projects_ratio_check
  check (ratio in ('16:9','9:16','1:1','10:19','19:6'));

alter table public.projects drop constraint if exists projects_theme_config_check;
alter table public.projects add constraint projects_theme_config_check check (
  theme_config is null or jsonb_typeof(theme_config)='object'
);

notify pgrst,'reload schema';
