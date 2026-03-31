import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { Activity, Brain, FileText, Home, Menu, Moon, Settings, Shield, Sun, X } from "lucide-react"

const LeftNav = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [mounted, setMounted] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const navItems = [
    { id: "home", label: "Home", icon: Home, href: "/dashboard" },
    { id: "nextai", label: "AI Chat", icon: Brain, href: "/dashboard/nextai" },
    { id: "file-scanner", label: "File Scanner", icon: FileText, href: "/dashboard/file-scanner" },
    { id: "threat-intel", label: "Threat Intel", icon: Activity, href: "/dashboard/threat-intel" },
    { id: "nsfw", label: "NSFW", icon: Shield, href: "/dashboard/nsfw" },
    { id: "settings", label: "Settings", icon: Settings, href: "/dashboard/settings" },
  ]

  useEffect(() => {
    setMounted(true)
    const savedTheme = localStorage.getItem("hakverse-theme")
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    const startDark = savedTheme ? savedTheme === "dark" : prefersDark
    setDarkMode(startDark)
    document.documentElement.classList.toggle("dark", startDark)
  }, [])

  const setTheme = (mode) => {
    const isDark = mode === "dark"
    setDarkMode(isDark)
    document.documentElement.classList.toggle("dark", isDark)
    localStorage.setItem("hakverse-theme", mode)
  }

  const goTo = (href) => {
    navigate(href)
    setMobileOpen(false)
  }

  if (!mounted) return null

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-black/10 dark:border-white/10 backdrop-blur-xl bg-white/90 dark:bg-black/85">
      <div className="mx-auto max-w-7xl px-4 md:px-8 h-20 flex items-center gap-4">
        <div className="flex items-center gap-3 min-w-fit">
          <div className="h-9 w-9 grid place-items-center rounded-xl border border-black dark:border-white font-semibold text-sm tracking-widest">
            SPY
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.22em] font-semibold text-black dark:text-white">Spyder</p>
            <p className="text-[11px] uppercase tracking-[0.18em] text-black/55 dark:text-white/55">Security Suite</p>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-2 ml-6">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = location.pathname === item.href
            return (
              <button
                key={item.id}
                onClick={() => goTo(item.href)}
                className={`group px-3 py-2 rounded-full border text-sm font-medium transition-all ${
                  active
                    ? "bg-black text-white border-black dark:bg-white dark:text-black dark:border-white"
                    : "bg-transparent text-black/75 border-transparent hover:border-black/20 dark:text-white/75 dark:hover:border-white/20"
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  {item.label}
                </span>
              </button>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div className="relative h-12 w-[158px] rounded-full border border-black/20 dark:border-white/20 p-1 bg-gradient-to-b from-black/[0.03] to-black/[0.01] dark:from-white/[0.10] dark:to-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <div
              className={`absolute top-1 h-10 w-[74px] rounded-full bg-black dark:bg-white transition-all duration-300 ease-out shadow-[0_6px_14px_rgba(0,0,0,0.2)] dark:shadow-[0_6px_14px_rgba(255,255,255,0.1)] ${
                darkMode ? "translate-x-[78px]" : "translate-x-0"
              }`}
            />

            <div className="relative z-10 h-full w-full grid grid-cols-2">
              <button
                onClick={() => setTheme("light")}
                className={`text-[11px] font-semibold rounded-full transition-all duration-300 active:scale-95 ${
                  !darkMode ? "text-white" : "text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white"
                }`}
                aria-label="Switch to light theme"
              >
                <span className="inline-flex items-center gap-1.5 tracking-wide">
                  <Sun className="w-3.5 h-3.5" />
                  LIGHT
                </span>
              </button>

              <button
                onClick={() => setTheme("dark")}
                className={`text-[11px] font-semibold rounded-full transition-all duration-300 active:scale-95 ${
                  darkMode ? "text-black" : "text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white"
                }`}
                aria-label="Switch to dark theme"
              >
                <span className="inline-flex items-center gap-1.5 tracking-wide">
                  <Moon className="w-3.5 h-3.5" />
                  DARK
                </span>
              </button>
            </div>
          </div>

          <button
            onClick={() => setMobileOpen((prev) => !prev)}
            className="md:hidden h-10 w-10 grid place-items-center rounded-full border border-black/20 dark:border-white/20"
            aria-label="Open navigation"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-black/10 dark:border-white/10 px-4 pb-4 pt-3 bg-white dark:bg-black">
          <div className="grid grid-cols-2 gap-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = location.pathname === item.href
              return (
                <button
                  key={item.id}
                  onClick={() => goTo(item.href)}
                  className={`rounded-xl border px-3 py-2 text-sm text-left ${
                    active
                      ? "bg-black text-white border-black dark:bg-white dark:text-black dark:border-white"
                      : "bg-transparent border-black/15 dark:border-white/15"
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </header>
  )
}

export default LeftNav
