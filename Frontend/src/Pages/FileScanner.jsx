import { useRef, useState } from "react"
import { FileCheck, FileText, Loader2, Shield, Trash2, Upload, XCircle } from "lucide-react"
import { withApiBase } from "../config/api"

const FileScanner = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [scanResult, setScanResult] = useState(null)
  const [uploadedFile, setUploadedFile] = useState(null)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  const verdictTone = (vt) => {
    if (!vt?.success) return "neutral"
    if ((vt.summary?.malicious || 0) > 0) return "high"
    if ((vt.summary?.suspicious || 0) > 0) return "medium"
    return "low"
  }

  const toneClass = (tone) => {
    if (tone === "high") return "border-black bg-black text-white dark:bg-white dark:text-black dark:border-white"
    if (tone === "medium") return "border-black/30 dark:border-white/30"
    if (tone === "low") return "border-black/20 dark:border-white/20"
    return "border-black/15 dark:border-white/15"
  }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true)
    if (e.type === "dragleave") setDragActive(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0])
  }

  const handleFile = (file) => {
    setError(null)
    setScanResult(null)
    setUploadedFile(file)
  }

  const scanFile = async () => {
    if (!uploadedFile) return

    setIsLoading(true)
    setError(null)
    setScanResult(null)

    try {
      const formData = new FormData()
      formData.append("file", uploadedFile)

      const response = await fetch(withApiBase("/scanFile"), {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        let message = `HTTP error! status: ${response.status}`
        try {
          const errorPayload = await response.json()
          message = errorPayload?.message || errorPayload?.error || message
        } catch {
          // Keep fallback message.
        }
        throw new Error(message)
      }

      const data = await response.json()
      if (data.error) throw new Error(data.error)

      setScanResult({
        answer: data.answer || null,
        vt: data.vt || null,
      })
    } catch (err) {
      setError(err.message || "Failed to scan file")
    } finally {
      setIsLoading(false)
    }
  }

  const clearFile = () => {
    setUploadedFile(null)
    setScanResult(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  return (
    <div className="w-full min-h-full px-4 md:px-8 py-6 md:py-8 bg-app">
      <div className="max-w-7xl mx-auto space-y-4">
        <section className="mono-panel px-5 md:px-7 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl border border-black/20 dark:border-white/20 grid place-items-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight">File Scanner</p>
              <p className="mono-label text-[10px] uppercase text-black/55 dark:text-white/55">Static + AI-assisted file analysis</p>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full border border-black/15 dark:border-white/15">
            <Shield className="w-3.5 h-3.5" />
            Protected Session
          </div>
        </section>

        <section className="grid lg:grid-cols-2 gap-4">
          <div className="mono-panel p-5 md:p-6">
            <p className="text-sm font-semibold">Upload File</p>
            <p className="text-sm text-black/65 dark:text-white/65 mt-1">Drop a sample or choose from disk.</p>

            <div
              className={`mt-5 rounded-2xl border-2 border-dashed p-6 min-h-[240px] transition ${
                dragActive ? "border-black dark:border-white" : "border-black/20 dark:border-white/20"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {!uploadedFile ? (
                <div className="h-full min-h-[180px] flex flex-col items-center justify-center text-center">
                  <Upload className="w-7 h-7 mb-3" />
                  <p className="font-medium">Drop file here</p>
                  <p className="text-sm text-black/60 dark:text-white/60 mt-1 mb-4">or browse manually</p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 rounded-xl bg-black text-white dark:bg-white dark:text-black text-sm font-medium"
                  >
                    Choose File
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border border-black/15 dark:border-white/15 p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg border border-black/20 dark:border-white/20 grid place-items-center">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{uploadedFile.name}</p>
                    <p className="text-xs text-black/60 dark:text-white/60">{formatFileSize(uploadedFile.size)}</p>
                  </div>
                  <button onClick={clearFile} className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              accept=".txt,.pdf,.doc,.docx,.js,.ts,.jsx,.tsx,.py,.java,.cpp,.c"
            />

            <button
              onClick={scanFile}
              disabled={isLoading || !uploadedFile}
              className="w-full mt-4 py-3 rounded-xl bg-black text-white dark:bg-white dark:text-black disabled:opacity-40 inline-flex items-center justify-center gap-2 font-medium"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Scanning
                </>
              ) : (
                "Scan File"
              )}
            </button>
          </div>

          <div className="mono-panel p-5 md:p-6">
            <p className="text-sm font-semibold">Result</p>
            <p className="text-sm text-black/65 dark:text-white/65 mt-1">Output from backend analysis appears here.</p>

            <div className="mt-5 min-h-[360px] rounded-2xl border border-black/15 dark:border-white/15 p-4">
              {isLoading && (
                <div className="h-full min-h-[320px] grid place-items-center text-center">
                  <div>
                    <Loader2 className="w-7 h-7 animate-spin mx-auto mb-3" />
                    <p className="font-medium">Analyzing file</p>
                  </div>
                </div>
              )}

              {error && !isLoading && (
                <div className="h-full min-h-[320px] grid place-items-center text-center">
                  <div>
                    <XCircle className="w-7 h-7 mx-auto mb-3" />
                    <p className="font-medium">Scan failed</p>
                    <p className="text-sm text-black/65 dark:text-white/65 mt-1">{error}</p>
                  </div>
                </div>
              )}

              {!error && !isLoading && scanResult && (
                <div className="space-y-4 animate-[fadeIn_350ms_ease-out]">
                  {scanResult.vt && (
                    <div className={`rounded-xl border p-4 transition-all duration-300 ${toneClass(verdictTone(scanResult.vt))}`}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="mono-label text-[10px] uppercase opacity-75">VirusTotal Verdict</p>
                          <p className="text-sm font-semibold mt-1">
                            {scanResult.vt.success
                              ? `${scanResult.vt.summary?.malicious || 0} malicious, ${scanResult.vt.summary?.suspicious || 0} suspicious`
                              : "Scan failed"}
                          </p>
                        </div>

                        {scanResult.vt.vtLink && (
                          <a
                            href={scanResult.vt.vtLink}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs px-3 py-1.5 rounded-full border border-current/30 hover:opacity-80 transition"
                          >
                            View on VirusTotal
                          </a>
                        )}
                      </div>

                      {scanResult.vt.success && (
                        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div className="rounded-lg border border-black/10 dark:border-white/10 p-2">
                            <p className="text-[10px] uppercase opacity-60">Malicious</p>
                            <p className="text-lg font-semibold">{scanResult.vt.summary?.malicious || 0}</p>
                          </div>
                          <div className="rounded-lg border border-black/10 dark:border-white/10 p-2">
                            <p className="text-[10px] uppercase opacity-60">Suspicious</p>
                            <p className="text-lg font-semibold">{scanResult.vt.summary?.suspicious || 0}</p>
                          </div>
                          <div className="rounded-lg border border-black/10 dark:border-white/10 p-2">
                            <p className="text-[10px] uppercase opacity-60">Undetected</p>
                            <p className="text-lg font-semibold">{scanResult.vt.summary?.undetected || 0}</p>
                          </div>
                          <div className="rounded-lg border border-black/10 dark:border-white/10 p-2">
                            <p className="text-[10px] uppercase opacity-60">Harmless</p>
                            <p className="text-lg font-semibold">{scanResult.vt.summary?.harmless || 0}</p>
                          </div>
                        </div>
                      )}

                      {!scanResult.vt.success && (
                        <p className="text-sm mt-3 opacity-90">
                          {scanResult.vt.error}
                          {scanResult.vt.details ? ` - ${scanResult.vt.details}` : ""}
                        </p>
                      )}
                    </div>
                  )}

                  {scanResult.vt?.success && Array.isArray(scanResult.vt.detections) && scanResult.vt.detections.length > 0 && (
                    <div className="rounded-xl border border-black/15 dark:border-white/15 p-4">
                      <p className="mono-label text-[10px] uppercase text-black/60 dark:text-white/60">Top Detections</p>
                      <div className="mt-3 space-y-2 max-h-44 overflow-y-auto pr-1">
                        {scanResult.vt.detections.slice(0, 8).map((det) => (
                          <div
                            key={`${det.engine}-${det.result}`}
                            className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 flex items-start justify-between gap-3"
                          >
                            <p className="text-sm font-medium">{det.engine}</p>
                            <p className="text-xs text-right text-black/65 dark:text-white/65">{det.result || "n/a"}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="rounded-xl border border-black/15 dark:border-white/15 p-4">
                    <p className="mono-label text-[10px] uppercase text-black/60 dark:text-white/60">AI Output</p>
                    <p className="text-sm leading-relaxed mt-2 whitespace-pre-wrap">{scanResult.answer?.ai_output || "No AI summary available."}</p>
                  </div>

                  {scanResult.answer?.server_cmd && scanResult.answer.server_cmd !== "none" && (
                    <div className="rounded-xl border border-black/15 dark:border-white/15 p-4">
                      <p className="mono-label text-[10px] uppercase text-black/60 dark:text-white/60">Server Command</p>
                      <pre className="text-xs mt-2 overflow-x-auto">{scanResult.answer.server_cmd}</pre>
                    </div>
                  )}
                </div>
              )}

              {!error && !isLoading && !scanResult && (
                <div className="h-full min-h-[320px] grid place-items-center text-center">
                  <div>
                    <FileCheck className="w-7 h-7 mx-auto mb-3" />
                    <p className="font-medium">Awaiting Scan</p>
                    <p className="text-sm text-black/65 dark:text-white/65 mt-1">Upload a file to begin analysis.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default FileScanner
