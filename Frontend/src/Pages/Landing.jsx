import { useNavigate } from "react-router-dom";
import {
  ArrowDown,
  ArrowRight,
  Bot,
  LockKeyhole,
  Radar,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const featureCards = [
  {
    title: "Threat Intelligence",
    description: "Analyze domains, IPs, URLs and hashes with verdict-first workflows.",
    icon: Radar,
  },
  {
    title: "AI Security Copilot",
    description: "Operational chat assistant with context-aware investigation support.",
    icon: Bot,
  },
  {
    title: "Secure Access",
    description: "Mongo-backed identity, session token auth, and protected APIs.",
    icon: LockKeyhole,
  },
  {
    title: "Actionable Dashboard",
    description: "One place for triage, scanning, moderation, and activity history.",
    icon: ShieldCheck,
  },
];

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="w-full min-h-full bg-app landing-grid-bg overflow-x-hidden">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/70 dark:bg-black/40 border-b border-black/10 dark:border-white/10">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="inline-flex items-center gap-2 reveal-up">
            <div className="w-8 h-8 rounded-lg border border-black/20 dark:border-white/20 overflow-hidden bg-white dark:bg-black">
              <img src="/spider.jpeg" alt="Spyder logo" className="w-full h-full object-cover" />
            </div>
            <p className="font-semibold tracking-tight">Spyder</p>
          </div>
          <div className="inline-flex items-center gap-2 reveal-up reveal-delay-1">
            <button
              onClick={() => navigate("/login")}
              className="h-9 px-4 rounded-lg border border-black/20 dark:border-white/20 text-sm"
            >
              Login
            </button>
            <button
              onClick={() => navigate("/newAccount")}
              className="h-9 px-4 rounded-lg bg-black text-white dark:bg-white dark:text-black text-sm"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      <section className="relative min-h-[calc(100svh-4rem)] flex items-center">
        <div className="landing-orb landing-orb-a" />
        <div className="landing-orb landing-orb-b" />

        <div className="max-w-7xl mx-auto px-4 md:px-8 py-16 md:py-24 w-full">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div className="space-y-6 min-w-0">
              <p className="mono-label text-[11px] uppercase text-black/60 dark:text-white/60 reveal-up">
                Security Workspace Platform
              </p>
              <h1 className="text-[clamp(2.35rem,8vw,6.2rem)] font-semibold leading-[0.98] tracking-tight break-words reveal-up reveal-delay-1">
                Monitor.
                <br />
                Analyze.
                <br />
                Respond.
              </h1>
              <p className="max-w-[62ch] text-base md:text-lg text-black/70 dark:text-white/70 leading-relaxed break-words reveal-up reveal-delay-2">
                A modern cyber operations interface combining threat intelligence, file analysis, secure AI assistance,
                and moderation tooling in one focused command center.
              </p>
              <div className="flex flex-wrap gap-3 reveal-up reveal-delay-3">
                <button
                  onClick={() => navigate("/newAccount")}
                  className="h-11 px-6 rounded-xl bg-black text-white dark:bg-white dark:text-black font-medium inline-flex items-center gap-2"
                >
                  Create Account
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => navigate("/login")}
                  className="h-11 px-6 rounded-xl border border-black/20 dark:border-white/20 font-medium"
                >
                  Login
                </button>
              </div>
            </div>

            <div className="mono-panel p-5 md:p-8 reveal-up reveal-delay-2 min-w-0">
              <div className="inline-flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-md border border-black/20 dark:border-white/20 overflow-hidden bg-white dark:bg-black">
                  <img src="/spider.jpeg" alt="Spyder logo" className="w-full h-full object-cover" />
                </div>
                <p className="mono-label text-[10px] uppercase text-black/60 dark:text-white/60">Live Capability Stack</p>
              </div>
              <div className="space-y-3">
                {featureCards.slice(0, 3).map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.title}
                      className="rounded-xl border border-black/15 dark:border-white/15 p-4 bg-white/55 dark:bg-white/5"
                    >
                      <div className="inline-flex items-center gap-2 mb-2 min-w-0">
                        <Icon className="w-4 h-4" />
                        <p className="font-semibold break-words">{item.title}</p>
                      </div>
                      <p className="text-sm text-black/65 dark:text-white/65 break-words">{item.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <a
            href="#capabilities"
            className="mt-10 inline-flex items-center gap-2 text-sm text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white transition reveal-up reveal-delay-3"
          >
            Explore capabilities
            <ArrowDown className="w-4 h-4" />
          </a>
        </div>
      </section>

      <section id="capabilities" className="max-w-7xl mx-auto px-4 md:px-8 py-14 md:py-20">
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
          {featureCards.map((item, index) => {
            const Icon = item.icon;
            return (
              <article
                key={item.title}
                className={`mono-panel p-5 md:p-6 reveal-up reveal-delay-${(index % 4) + 1}`}
              >
                <Icon className="w-5 h-5 mb-3" />
                <h2 className="font-semibold text-lg break-words">{item.title}</h2>
                <p className="mt-2 text-sm text-black/65 dark:text-white/65 break-words">{item.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 md:px-8 pb-20 md:pb-24">
        <div className="mono-panel p-7 md:p-10 text-center reveal-up reveal-delay-2">
          <div className="inline-flex items-center gap-2 text-sm mb-3 text-black/65 dark:text-white/65">
            <Sparkles className="w-4 h-4" />
            Ready for operations
          </div>
          <h3 className="text-3xl md:text-4xl font-semibold tracking-tight">Start your security workspace now</h3>
          <p className="mt-3 text-black/70 dark:text-white/70 max-w-2xl mx-auto">
            Create your account and move directly into the dashboard for threat intel, scanning, and response flows.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => navigate("/newAccount")}
              className="h-11 px-6 rounded-xl bg-black text-white dark:bg-white dark:text-black font-medium"
            >
              Create Account
            </button>
            <button
              onClick={() => navigate("/login")}
              className="h-11 px-6 rounded-xl border border-black/20 dark:border-white/20 font-medium"
            >
              Login
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Landing;
