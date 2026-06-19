import { useContext, useMemo, useState } from "react"
import axios from "axios"
import { Lock, LogOut, Save, UserRound } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { UserContext } from "../Contexts/UserContext"
import { withApiBase } from "../config/api"

const serverUrl = withApiBase()

const Settings = () => {
  const navigate = useNavigate()
  const { user, setUser, getAuthHeaders, logout } = useContext(UserContext)

  const initialName = useMemo(() => user?.name || "", [user?.name])
  const initialUsername = useMemo(() => user?.username || "", [user?.username])

  const [name, setName] = useState(initialName)
  const [username, setUsername] = useState(initialUsername)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const resetPasswordInputs = () => {
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
  }

  const handleLogout = async () => {
    try {
      await axios.post(
        `${serverUrl}/api/auth/logout`,
        {},
        {
          headers: {
            ...getAuthHeaders(),
          },
        }
      )
    } catch (e) {
      // Client-side logout still proceeds even if server logout fails.
    } finally {
      logout()
      navigate("/")
    }
  }

  const handleSave = async () => {
    if (!user) return

    const payload = {}
    const trimmedName = name.trim()
    const trimmedUsername = username.trim().toLowerCase()

    if (!trimmedName) {
      setError("Name cannot be empty.")
      setSuccess("")
      return
    }

    if (trimmedName !== (user.name || "")) {
      payload.name = trimmedName
    }

    if (trimmedUsername !== (user.username || "")) {
      payload.username = trimmedUsername
    }

    const wantsPasswordChange =
      currentPassword.trim() || newPassword.trim() || confirmPassword.trim()

    if (wantsPasswordChange) {
      if (!currentPassword || !newPassword || !confirmPassword) {
        setError("Fill current password, new password, and confirm password.")
        setSuccess("")
        return
      }

      if (newPassword.length < 8) {
        setError("New password must be at least 8 characters.")
        setSuccess("")
        return
      }

      if (newPassword !== confirmPassword) {
        setError("New password and confirm password do not match.")
        setSuccess("")
        return
      }

      payload.currentPassword = currentPassword
      payload.newPassword = newPassword
    }

    if (Object.keys(payload).length === 0) {
      setError("No changes to save.")
      setSuccess("")
      return
    }

    setLoading(true)
    setError("")
    setSuccess("")

    try {
      const response = await axios.put(`${serverUrl}/api/auth/settings`, payload, {
        headers: {
          ...getAuthHeaders(),
        },
      })

      if (response?.data?.user) {
        setUser(response.data.user)
      }

      resetPasswordInputs()
      setSuccess("Settings updated successfully.")
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to update settings.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="w-full px-4 md:px-8 pb-10">
      <div className="mx-auto max-w-3xl mono-panel p-6 md:p-8">
        <p className="mono-label text-[11px] uppercase text-black/60 dark:text-white/60">Account</p>
        <h1 className="text-3xl font-semibold mt-2 tracking-tight">User Settings</h1>
        <p className="text-sm text-black/65 dark:text-white/65 mt-2">
          Update your profile details and account password.
        </p>

        <div className="mt-7 grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block md:col-span-2">
            <span className="text-xs text-black/60 dark:text-white/60">Full Name</span>
            <div className="mt-1 flex items-center gap-2 rounded-xl border border-black/20 dark:border-white/20 px-3 py-2">
              <UserRound className="w-4 h-4" />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-transparent outline-none text-sm"
                placeholder="Your full name"
              />
            </div>
          </label>

          <label className="block md:col-span-2">
            <span className="text-xs text-black/60 dark:text-white/60">Username</span>
            <div className="mt-1 flex items-center gap-2 rounded-xl border border-black/20 dark:border-white/20 px-3 py-2">
              <UserRound className="w-4 h-4" />
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-transparent outline-none text-sm"
                placeholder="username"
              />
            </div>
          </label>
        </div>

        <div className="mt-8">
          <p className="mono-label text-[11px] uppercase text-black/60 dark:text-white/60">Password</p>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block md:col-span-2">
              <span className="text-xs text-black/60 dark:text-white/60">Current Password</span>
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-black/20 dark:border-white/20 px-3 py-2">
                <Lock className="w-4 h-4" />
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full bg-transparent outline-none text-sm"
                  placeholder="Enter current password"
                />
              </div>
            </label>

            <label className="block">
              <span className="text-xs text-black/60 dark:text-white/60">New Password</span>
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-black/20 dark:border-white/20 px-3 py-2">
                <Lock className="w-4 h-4" />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-transparent outline-none text-sm"
                  placeholder="Minimum 8 characters"
                />
              </div>
            </label>

            <label className="block">
              <span className="text-xs text-black/60 dark:text-white/60">Confirm Password</span>
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-black/20 dark:border-white/20 px-3 py-2">
                <Lock className="w-4 h-4" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-transparent outline-none text-sm"
                  placeholder="Repeat new password"
                />
              </div>
            </label>
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
        {success && <p className="mt-4 text-sm text-green-600 dark:text-green-400">{success}</p>}

        <div className="mt-6 flex flex-col md:flex-row gap-3">
          <button
            onClick={handleSave}
            disabled={loading}
            className="w-full md:w-auto h-11 px-5 rounded-xl bg-black text-white dark:bg-white dark:text-black disabled:opacity-50 font-medium inline-flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            {loading ? "Saving..." : "Save Settings"}
          </button>

          <button
            onClick={handleLogout}
            className="w-full md:w-auto h-11 px-5 rounded-xl border border-black/20 dark:border-white/20 font-medium inline-flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>
    </section>
  )
}

export default Settings
