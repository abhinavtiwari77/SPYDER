import { useMemo, useState } from "react"
import { Activity, AlertTriangle, CheckCircle2, Globe, Hash, Network, Share2, Shield, Upload } from "lucide-react"
import { withApiBase } from "../config/api"

const API_BASE = withApiBase()

const defaultShareMessage = "Automated alert from Spyder: suspicious indicator detected. Please investigate."

const inputTypes = [
  { value: "url", label: "URL", icon: Globe, placeholder: "https://example.com/suspicious" },
  { value: "domain", label: "Domain", icon: Globe, placeholder: "suspicious-domain.com" },
  { value: "ip", label: "IP", icon: Network, placeholder: "185.199.111.153" },
  { value: "fileHash", label: "File Hash", icon: Hash, placeholder: "SHA256 / MD5 / SHA1" },
]

function detectSeverity(result) {
  if (!result || !result.success) return "unknown"
  if (result.verdict === "malicious") return "high"
  if (result.verdict === "suspicious") return "medium"
  return "low"
}

function parseBulkLine(line) {
  const raw = line.trim()
  if (!raw) return null

  if (/^https?:\/\//i.test(raw)) return { type: "url", value: raw }
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(raw)) return { type: "ip", value: raw }

  const commaParts = raw.split(",")
  if (commaParts.length >= 2) {
    const type = commaParts[0].trim()
    const value = commaParts.slice(1).join(",").trim()
    return { type, value }
  }

  const colonParts = raw.split(":")
  if (colonParts.length >= 2 && ["url", "domain", "ip", "fileHash"].includes(colonParts[0].trim())) {
    const type = colonParts[0].trim()
    const value = colonParts.slice(1).join(":").trim()
    return { type, value }
  }

  return { type: "domain", value: raw }
}

const ThreatIntel = () => {
  const [type, setType] = useState("url")
  const [value, setValue] = useState("")
  const [bulkText, setBulkText] = useState("")
  const [autoShare, setAutoShare] = useState(true)
  const [file, setFile] = useState(null)
  const [shareText, setShareText] = useState(defaultShareMessage)
  const [results, setResults] = useState([])
  const [loadingSingle, setLoadingSingle] = useState(false)
  const [loadingBulk, setLoadingBulk] = useState(false)
  const [loadingFile, setLoadingFile] = useState(false)
  const [sharingId, setSharingId] = useState("")
  const [error, setError] = useState("")

  const selectedType = useMemo(() => inputTypes.find((item) => item.value === type) || inputTypes[0], [type])

  const counters = useMemo(() => {
    return results.reduce(
      (acc, item) => {
        const severity = detectSeverity(item)
        if (severity === "high") acc.high += 1
        if (severity === "medium") acc.medium += 1
        if (severity === "low") acc.low += 1
        if (!item.success) acc.failed += 1
        return acc
      },
      { high: 0, medium: 0, low: 0, failed: 0 }
    )
  }, [results])

  const addResults = (incoming) => {
    const list = Array.isArray(incoming) ? incoming : [incoming]
    setResults((prev) => [...list, ...prev])
  }

  const handleSingleScan = async () => {
    if (!value.trim()) {
      setError("Enter a value to scan.")
      return
    }

    setError("")
    setLoadingSingle(true)
    try {
      const response = await fetch(`${API_BASE}/intel/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, value: value.trim(), autoShare }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.message || data?.error || "Threat intel scan failed")
      addResults(data)
      setValue("")
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingSingle(false)
    }
  }

  const handleBulkScan = async () => {
    const items = bulkText
      .split("\n")
      .map((line) => parseBulkLine(line))
      .filter(Boolean)

    if (items.length === 0) {
      setError("Paste at least one IOC line for bulk scanning.")
      return
    }

    setError("")
    setLoadingBulk(true)
    try {
      const response = await fetch(`${API_BASE}/intel/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, autoShare }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.message || data?.error || "Bulk threat intel scan failed")
      addResults(data.results || [])
      setBulkText("")
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingBulk(false)
    }
  }

  const handleFileScan = async () => {
    if (!file) {
      setError("Select a file before running file intel scan.")
      return
    }

    setError("")
    setLoadingFile(true)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("autoShare", String(autoShare))

      const response = await fetch(`${API_BASE}/intel/file`, {
        method: "POST",
        body: formData,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.message || data?.error || "File intel scan failed")
      addResults(data)
      setFile(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingFile(false)
    }
  }

  const handleManualShare = async (item) => {
    if (!item?.id || !item?.communityItemType) {
      setError("This item does not have a shareable VirusTotal id.")
      return
    }

    setError("")
    setSharingId(item.id)

    try {
      const response = await fetch(`${API_BASE}/intel/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemType: item.communityItemType,
          itemId: item.id,
          text: shareText.trim() || defaultShareMessage,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.message || data?.error || "Manual share failed")

      setResults((prev) =>
        prev.map((entry) => {
          if (entry.id !== item.id) return entry
          return {
            ...entry,
            shareStatus: { attempted: true, shared: true, result: data },
          }
        })
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setSharingId("")
    }
  }

  return (
    <div className="w-full min-h-full px-4 md:px-8 py-6 md:py-8 bg-app">
      <div className="max-w-7xl mx-auto space-y-4">
        <section className="mono-panel px-5 md:px-7 py-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl border border-black/20 dark:border-white/20 grid place-items-center">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight">Threat Intelligence</p>
              <p className="mono-label text-[10px] uppercase text-black/55 dark:text-white/55">IOC triage and community collaboration</p>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 text-xs rounded-full border border-black/15 dark:border-white/15 px-3 py-1">
            <Shield className="w-3.5 h-3.5" />
            Sharing Enabled
          </div>
        </section>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="mono-panel p-4"><p className="text-xs text-black/60 dark:text-white/60">High Risk</p><p className="text-2xl font-semibold">{counters.high}</p></div>
          <div className="mono-panel p-4"><p className="text-xs text-black/60 dark:text-white/60">Suspicious</p><p className="text-2xl font-semibold">{counters.medium}</p></div>
          <div className="mono-panel p-4"><p className="text-xs text-black/60 dark:text-white/60">Clean</p><p className="text-2xl font-semibold">{counters.low}</p></div>
          <div className="mono-panel p-4"><p className="text-xs text-black/60 dark:text-white/60">Failed</p><p className="text-2xl font-semibold">{counters.failed}</p></div>
        </section>

        <section className="grid lg:grid-cols-2 gap-4">
          <div className="mono-panel p-5 md:p-6 space-y-4">
            <p className="font-semibold">Single IOC Scan</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {inputTypes.map((item) => {
                const Icon = item.icon
                const active = type === item.value
                return (
                  <button
                    key={item.value}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      active
                        ? "bg-black text-white border-black dark:bg-white dark:text-black dark:border-white"
                        : "border-black/20 dark:border-white/20"
                    }`}
                    onClick={() => setType(item.value)}
                  >
                    <span className="inline-flex items-center gap-1"><Icon className="w-4 h-4" />{item.label}</span>
                  </button>
                )
              })}
            </div>
            <input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={selectedType.placeholder}
              className="w-full rounded-xl border border-black/20 dark:border-white/20 bg-transparent px-4 py-3 outline-none focus:border-black dark:focus:border-white"
            />
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={autoShare} onChange={(event) => setAutoShare(event.target.checked)} />
              Auto-share malicious findings
            </label>
            <button
              onClick={handleSingleScan}
              disabled={loadingSingle}
              className="w-full rounded-xl bg-black text-white dark:bg-white dark:text-black py-3 font-medium disabled:opacity-50"
            >
              {loadingSingle ? "Scanning..." : "Run IOC Scan"}
            </button>
          </div>

          <div className="mono-panel p-5 md:p-6 space-y-4">
            <p className="font-semibold">File Intel Scan</p>
            <label className="w-full rounded-xl border-2 border-dashed border-black/20 dark:border-white/20 px-4 py-10 cursor-pointer hover:border-black dark:hover:border-white transition flex items-center justify-center gap-2">
              <Upload className="w-5 h-5" />
              <span className="text-sm">{file ? file.name : "Choose suspicious file"}</span>
              <input type="file" className="hidden" onChange={(event) => setFile(event.target.files?.[0] || null)} />
            </label>
            <button
              onClick={handleFileScan}
              disabled={loadingFile}
              className="w-full rounded-xl bg-black text-white dark:bg-white dark:text-black py-3 font-medium disabled:opacity-50"
            >
              {loadingFile ? "Scanning file..." : "Scan File"}
            </button>
          </div>
        </section>

        <section className="mono-panel p-5 md:p-6 space-y-3">
          <p className="font-semibold">Bulk IOC Scan</p>
          <textarea
            value={bulkText}
            onChange={(event) => setBulkText(event.target.value)}
            rows={5}
            placeholder={"One indicator per line\nhttps://bad.site\n8.8.8.8\nurl,https://example.com\nfileHash:abcd1234"}
            className="w-full rounded-xl border border-black/20 dark:border-white/20 bg-transparent px-4 py-3 outline-none focus:border-black dark:focus:border-white"
          />
          <button
            onClick={handleBulkScan}
            disabled={loadingBulk}
            className="rounded-xl bg-black text-white dark:bg-white dark:text-black px-5 py-3 font-medium disabled:opacity-50"
          >
            {loadingBulk ? "Scanning..." : "Run Bulk Scan"}
          </button>
        </section>

        <section className="mono-panel p-5 md:p-6 space-y-3">
          <p className="font-semibold">Share Message Template</p>
          <input
            value={shareText}
            onChange={(event) => setShareText(event.target.value)}
            className="w-full rounded-xl border border-black/20 dark:border-white/20 bg-transparent px-4 py-3 outline-none focus:border-black dark:focus:border-white"
            placeholder="Message for manual VirusTotal sharing"
          />
        </section>

        {error && (
          <div className="rounded-xl border border-black/20 dark:border-white/20 bg-black/5 dark:bg-white/10 p-4 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        <section className="space-y-3">
          <p className="font-semibold text-lg">Results</p>
          {results.length === 0 && (
            <div className="mono-panel p-7 text-sm text-black/65 dark:text-white/65 text-center">Run a scan to view findings.</div>
          )}

          {results.map((item, index) => (
            <div key={`${item.id || item.value || "entry"}-${index}`} className="mono-panel p-5 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-xs uppercase text-black/60 dark:text-white/60">{item.type || "unknown"}</p>
                  <p className="font-semibold break-all">{item.value || "N/A"}</p>
                </div>
                <div className="text-sm">malicious: {item.maliciousScore ?? 0}</div>
              </div>

              {item.success ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    <div className="rounded-lg border border-black/15 dark:border-white/15 p-2"><p className="text-xs text-black/60 dark:text-white/60">Malicious</p><p className="font-semibold">{item.stats?.malicious ?? 0}</p></div>
                    <div className="rounded-lg border border-black/15 dark:border-white/15 p-2"><p className="text-xs text-black/60 dark:text-white/60">Suspicious</p><p className="font-semibold">{item.stats?.suspicious ?? 0}</p></div>
                    <div className="rounded-lg border border-black/15 dark:border-white/15 p-2"><p className="text-xs text-black/60 dark:text-white/60">Harmless</p><p className="font-semibold">{item.stats?.harmless ?? 0}</p></div>
                    <div className="rounded-lg border border-black/15 dark:border-white/15 p-2"><p className="text-xs text-black/60 dark:text-white/60">Undetected</p><p className="font-semibold">{item.stats?.undetected ?? 0}</p></div>
                  </div>

                  {Array.isArray(item.topDetections) && item.topDetections.length > 0 && (
                    <div className="overflow-x-auto rounded-xl border border-black/15 dark:border-white/15">
                      <table className="w-full text-sm">
                        <thead className="border-b border-black/15 dark:border-white/15">
                          <tr>
                            <th className="text-left p-2">Engine</th>
                            <th className="text-left p-2">Category</th>
                            <th className="text-left p-2">Result</th>
                          </tr>
                        </thead>
                        <tbody>
                          {item.topDetections.slice(0, 6).map((det) => (
                            <tr key={`${det.engine}-${det.result}`} className="border-t border-black/10 dark:border-white/10">
                              <td className="p-2">{det.engine}</td>
                              <td className="p-2">{det.category}</td>
                              <td className="p-2">{det.result}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="flex items-center gap-3 flex-wrap">
                    {item.shareStatus?.shared ? (
                      <div className="inline-flex items-center gap-1 text-xs rounded-full px-2 py-1 border border-black/15 dark:border-white/15">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Shared
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1 text-xs rounded-full px-2 py-1 border border-black/15 dark:border-white/15">
                        <Activity className="w-3.5 h-3.5" /> Not shared
                      </div>
                    )}

                    {item.vtGuiLink && (
                      <a href={item.vtGuiLink} target="_blank" rel="noreferrer" className="text-sm underline">
                        Open in VirusTotal
                      </a>
                    )}

                    <button
                      onClick={() => handleManualShare(item)}
                      disabled={sharingId === item.id}
                      className="inline-flex items-center gap-1 text-sm rounded-lg px-3 py-1.5 bg-black text-white dark:bg-white dark:text-black disabled:opacity-50"
                    >
                      <Share2 className="w-4 h-4" />
                      {sharingId === item.id ? "Sharing..." : "Share Now"}
                    </button>
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-black/15 dark:border-white/15 p-3 text-sm">{item.error || "Scan failed for this item."}</div>
              )}
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}

export default ThreatIntel
