import { useContext, useState } from "react"
import axios from "axios"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Eye, EyeOff, Lock, User } from "lucide-react"
import { UserContext } from "../Contexts/UserContext"

const serverUrl = "http://localhost:3000"

const Login = () => {
  const navigate = useNavigate()
  const { login } = useContext(UserContext)

  const [usernameOrEmail, setUsernameOrEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState("")

  const handleLogin = async () => {
    if (!usernameOrEmail.trim() || !password.trim()) {
      setError("Please enter both username/email and password.")
      return
    }

    setError("")
    setLoading(true)

    try {
      const response = await axios.post(`${serverUrl}/api/auth/login`, {
        usernameOrEmail: usernameOrEmail.trim().toLowerCase(),
        password,
      })

      login(response.data)
      navigate("/dashboard")
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to login. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = () => {
    setError("")
    setGoogleLoading(true)
    window.location.href = `${serverUrl}/api/auth/google`
  }

  return (
    <div className="w-full min-h-full bg-app px-4 py-10 flex items-center justify-center">
      <div className="w-full max-w-md mono-panel p-6 md:p-8">
        <button
          onClick={() => navigate(-1)}
          className="mb-5 h-10 w-10 rounded-xl border border-black/20 dark:border-white/20 grid place-items-center hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition"
          aria-label="Go back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <p className="mono-label text-[11px] uppercase text-black/60 dark:text-white/60">Welcome back</p>
        <h1 className="text-3xl font-semibold mt-2 tracking-tight">Sign In</h1>
        <p className="text-sm text-black/65 dark:text-white/65 mt-2">Access your secure Spyder workspace.</p>

        <div className="mt-6 space-y-3">
          <label className="block">
            <span className="text-xs text-black/60 dark:text-white/60">Username or Email</span>
            <div className="mt-1 flex items-center gap-2 rounded-xl border border-black/20 dark:border-white/20 px-3 py-2">
              <User className="w-4 h-4" />
              <input
                value={usernameOrEmail}
                onChange={(e) => setUsernameOrEmail(e.target.value)}
                className="w-full bg-transparent outline-none text-sm"
                placeholder="you@example.com"
              />
            </div>
          </label>

          <label className="block">
            <span className="text-xs text-black/60 dark:text-white/60">Password</span>
            <div className="mt-1 flex items-center gap-2 rounded-xl border border-black/20 dark:border-white/20 px-3 py-2">
              <Lock className="w-4 h-4" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent outline-none text-sm"
                placeholder="••••••••"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleLogin()
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="text-black/70 dark:text-white/70"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </label>
        </div>

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="mt-5 w-full h-11 rounded-xl bg-black text-white dark:bg-white dark:text-black disabled:opacity-50 font-medium"
        >
          {loading ? "Signing In..." : "Sign In"}
        </button>

        <button
          onClick={handleGoogleLogin}
          disabled={googleLoading}
          className="mt-3 w-full h-11 rounded-xl border border-black/20 dark:border-white/20 font-medium"
        >
          {googleLoading ? "Redirecting to Google..." : "Continue with Google"}
        </button>

        <button
          onClick={() => navigate("/newAccount")}
          className="mt-3 w-full h-11 rounded-xl border border-black/20 dark:border-white/20 font-medium"
        >
          Create new account
        </button>
      </div>
    </div>
  )
}

export default Login
