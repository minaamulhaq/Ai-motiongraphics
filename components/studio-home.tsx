"use client";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Clapperboard, Clock3, Coins, Frame, Lightbulb, Loader2, Play, Send, Sparkles, X } from "lucide-react";
import { useUser, useClerk } from "@clerk/nextjs";
import { useStudioUser } from "@/components/user-provider";
import { AccountMenu } from "@/components/account-menu";
import { ProjectThumbnail } from "@/components/remotion/project-thumbnail";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { durations, ratioOptions, type Project } from "@/lib/studio";

type Panel = "contact" | "preview" | null;
const durationOptions = durations.map(value => ({ value, label: `${value} seconds` }));
function Mark() { return <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span> }
function Modal({ title, children, close }: { title: string; children: ReactNode; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const el = ref.current!; el.showModal(); return () => el.close() }, []);
  return <dialog ref={ref} aria-labelledby="dialog-title" onCancel={close} onClick={e => { if (e.target === ref.current) close() }}><section className="dialog-body"><button className="close" onClick={close} aria-label="Close dialog"><X size={19} /></button><h2 id="dialog-title">{title}</h2>{children}</section></dialog>
}
async function post(data: Record<string, unknown>) {
  const response = await fetch("/api/studio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Please try again.");
  return result;
}

export default function StudioHome() {
  const router = useRouter();
  const { isSignedIn, user, isLoaded } = useUser();
  const { openSignIn } = useClerk();
  const { dbUser, isNewUser, refetchUser } = useStudioUser();

  const [projects, setProjects] = useState<Project[]>([]);
  const [panel, setPanel] = useState<Panel>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState(""), [seconds, setSeconds] = useState(20), [ratio, setRatio] = useState("16:9");
  const [hero, setHero] = useState<Project | null>(null);
  const [clip, setClip] = useState<Project | null>(null), [draft, setDraft] = useState(false), [shared, setShared] = useState(false), [sent, setSent] = useState(false), [notice, setNotice] = useState("");
  const [playing, setPlaying] = useState(false), [playKey, setPlayKey] = useState(0);
  const field = useRef<HTMLTextAreaElement>(null);

  async function refresh() {
    const r = await fetch("/api/studio", { cache: "no-store" });
    if (!r.ok) throw new Error("Could not load the project library.");
    const data = await r.json();
    setProjects(data.projects);
    setHero(data.hero);
  }
  useEffect(() => {
    if (!isLoaded) return;
    refresh().then(() => setNotice("")).catch(() => setNotice("Your library could not be loaded. Refresh to try again."));
  }, [isLoaded, isSignedIn]);

  function open(p: Panel) { setError(""); setSent(false); setPanel(p) }
  function focusPrompt() {
    document.getElementById("composer")?.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    field.current?.focus({ preventScroll: true });
  }
  function preview(project: Project, isDraft = false) {
    setClip(project); setDraft(isDraft); setShared(false); setPlaying(false); setPlayKey(0); open("preview");
  }

  function handleGetStarted() {
    // Clerk queues openSignIn() while it initializes. If the session resolves
    // as signed in first, Clerk reports cannot_render_single_session_enabled.
    if (!isLoaded) return;
    if (!isSignedIn) {
      openSignIn();
    } else {
      focusPrompt();
    }
  }

  async function generate(e: FormEvent) {
    e.preventDefault();
    if (!isLoaded) return;
    if (!isSignedIn) {
      openSignIn();
      return;
    }
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt) {
      field.current?.setCustomValidity("Describe a scene first.");
      field.current?.reportValidity();
      return;
    }
    if (cleanPrompt.length > 2000) {
      field.current?.setCustomValidity("Prompt cannot exceed 2000 characters.");
      field.current?.reportValidity();
      return;
    }

    setBusy(true);
    setError("");
    try {
      const res = await post({
        action: "project",
        prompt: cleanPrompt,
        seconds,
        ratio,
        shared: false,
      });

      if (res.projectId) {
        // Navigate to the newly created project page /project/[id]
        router.push(`/project/${res.projectId}`);
      } else {
        await refresh();
        setNotice("Project created successfully!");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setBusy(false);
    }
  }

  async function submit(data: Record<string, unknown>) {
    setError(""); setBusy(true);
    try {
      const result = await post(data);
      if (data.action === "contact") { setSent(true); return }
      await refresh();
      open(null); setNotice(data.action === "project" ? "Project saved to your library." : "");
    } catch (e) { setError(e instanceof Error ? e.message : "Please try again.") } finally { setBusy(false) }
  }

  const close = () => { if (!busy) { setPanel(null); setDraft(false) } };
  const visible = projects;

  return (
    <div id="home" className="studio">
      <header>
        <div className="shell topbar">
          <a className="brand" href="#home" aria-label="AI Vid home">
            <Mark />AI Vid<span className="brand-period">.</span>
          </a>
          <nav aria-label="Main navigation">
            <a className="active" href="#home">Home</a>
            <button onClick={() => { if (!isLoaded) return; if (isSignedIn) router.push("/settings#plans"); else openSignIn(); }}>Pricing</button>
            <button onClick={() => open("contact")}>Contact Us</button>
          </nav>
          <div className="flex items-center gap-3 justify-self-end">
            {isSignedIn && (
              <div className="credit-badge flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-neutral-900 border border-neutral-800 text-neutral-300">
                <Coins size={13} className="text-amber-400" />
                <span>{dbUser?.credit ?? 100} credits</span>
              </div>
            )}
            {isSignedIn ? <AccountMenu /> : (
              <button className="start" onClick={handleGetStarted} disabled={!isLoaded}>
                Get Started <ArrowDownRight size={15} />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="shell">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <div className="eyebrow"><span className="signal" />AI VIDEO GENERATOR</div>
            <h1 id="hero-title">Ideas into<br /><em>motion.</em></h1>
            <p>Turn a simple prompt into a moving visual. Shape the scene, set the pace, and make it yours.</p>
            <button className="start" onClick={handleGetStarted} disabled={!isLoaded}>Get Started <ArrowDownRight size={16} /></button>
          </div>
          <button
            className="hero-art"
            disabled={!hero}
            onClick={() => hero && preview(hero)}
            aria-label={hero ? "Preview " + hero.title : "Featured motion"}
            style={hero ? { backgroundImage: "linear-gradient(0deg,#11110ff0,transparent 23%),url(/art/" + hero.art + ".webp)" } : undefined}
          >
            <span className="viewfinder tl" /><span className="viewfinder tr" /><span className="viewfinder bl" /><span className="viewfinder br" />
            <span className="art-label"><span /> STUDIO REEL</span>
            <span className="hero-art-foot">
              <span><small>FEATURED MOTION</small><strong>{hero?.title}</strong></span>
              <span className="reel-play"><Play size={16} fill="currentColor" /></span>
            </span>
          </button>
        </section>

        <section id="composer" aria-label="Video prompt composer">
          <form onSubmit={generate} className="composer">
            <div className="flex items-center justify-between">
              <label htmlFor="scene" className="flex items-center gap-2 font-semibold text-sm">
                <Sparkles size={16} className="text-[var(--primary)]" /> Scene prompt
              </label>
              <span className={`text-xs font-mono ${prompt.length > 1800 ? "text-amber-400 font-bold" : "text-[var(--muted-foreground)]"}`}>
                {prompt.length}/2000
              </span>
            </div>

            <textarea
              id="scene"
              ref={field}
              required
              maxLength={2000}
              rows={3}
              placeholder="Describe what you want to see in motion (max 2000 characters)…"
              value={prompt}
              onChange={e => {
                e.target.setCustomValidity("");
                setPrompt(e.target.value);
              }}
              onKeyDown={e => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                  e.currentTarget.form?.requestSubmit();
                }
              }}
            />

            <div className="toolbar">
              <div className="pickers">
                <Select
                  items={durationOptions}
                  value={seconds}
                  onValueChange={value => { if (value !== null) setSeconds(value); }}
                >
                  <SelectTrigger className="picker" aria-label="Video duration">
                    <Clock3 aria-hidden="true" /><SelectValue />
                  </SelectTrigger>
                  <SelectContent align="start" alignItemWithTrigger={false}>
                    {durationOptions.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={ratio}
                  onValueChange={value => { if (value !== null) setRatio(value); }}
                >
                  <SelectTrigger className="picker" aria-label="Frame aspect ratio">
                    <Frame aria-hidden="true" /><SelectValue />
                  </SelectTrigger>
                  <SelectContent align="start" alignItemWithTrigger={false}>
                    {ratioOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>{option.label} · {option.value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <button className="primary flex items-center gap-2" type="submit" disabled={busy || !isLoaded}>
                {busy ? (
                  <>Saving <Loader2 size={15} className="animate-spin" /></>
                ) : (
                  <>Generate <Send size={15} /></>
                )}
              </button>
            </div>
          </form>
          {error && <p className="text-xs text-[var(--destructive)] mt-2 font-medium">{error}</p>}
          <p className="hint"><Lightbulb size={14} /> Try describing the subject, lighting, and camera movement.</p>
        </section>

        <section className="library">
          <div className="library-head">
            <div className="eyebrow"><span className="bar" />{isSignedIn ? "YOUR WORKSPACE" : "THE SHOWCASE"}</div>
            <h2>{isSignedIn ? "Your projects" : "Community projects"}<span>.</span></h2>
          </div>
          {notice && <p role="status">{notice}</p>}
          {visible.length === 0 ? (
            <div className="empty">
              <Clapperboard />
              <p>Your first project starts with a scene prompt.</p>
              <button className="start" onClick={focusPrompt}>Create a project <ArrowRight size={15} /></button>
            </div>
          ) : (
            <div className="cards">
              {visible.map(p => (
                <button key={p.id} className="project" onClick={() => router.push(`/project/${p.id}`)}>
                  <div className="poster">
                    <ProjectThumbnail project={p} />
                    <span className="runtime"><Play size={10} fill="currentColor" />0:{String(p.seconds).padStart(2, "0")}</span>
                  </div>
                  <div className="card-line">
                    <h3>{p.title}</h3>
                    <ArrowUpRight size={17} />
                  </div>
                  <small>{p.creator} <b>&bull;</b> {p.ratio}</small>
                </button>
              ))}
            </div>
          )}
        </section>
      </main>

      {panel && (
        <Modal title={panel === "contact" ? "Contact us" : clip?.title ?? "Preview"} close={close}>
          {panel === "contact" && (
            sent ? (
              <p role="status">Your message has been saved in the studio inbox.</p>
            ) : (
              <form className="dialog-form" onSubmit={e => { e.preventDefault(); void submit({ action: "contact", ...Object.fromEntries(new FormData(e.currentTarget)) }); }}>
                <label>Your email<input type="email" name="email" required /></label>
                <label>Message<textarea name="message" required maxLength={2000} rows={4} /></label>
                <button className="primary" disabled={busy}>Send message <Send size={15} /></button>
              </form>
            )
          )}
          {panel === "preview" && clip && (
            <>
              <div className="player" style={{ aspectRatio: clip.ratio.replace(":", "/"), maxWidth: ["9:16","10:19"].includes(clip.ratio) ? "240px" : "100%" }}>
                <div key={playKey} className={playing ? "still running" : "still"} onAnimationEnd={() => setPlaying(false)} style={{ backgroundImage: "url(/art/" + clip.art + ".webp)", filter: "hue-rotate(" + clip.hue + "deg)", animationDuration: clip.seconds + "s" }} />
                {!playing && (
                  <button className="reel-play" aria-label="Play motion preview" onClick={() => { setPlayKey(k => k + 1); setPlaying(true); }}>
                    <Play fill="currentColor" size={20} />
                  </button>
                )}
              </div>
              <div className="clip-meta">{clip.seconds} seconds &nbsp; / &nbsp; {clip.ratio} &nbsp; / &nbsp; Motion study</div>
              <p>{clip.prompt}</p>
            </>
          )}
          {error && <p role="alert" className="error">{error}</p>}
        </Modal>
      )}
    </div>
  );
}
