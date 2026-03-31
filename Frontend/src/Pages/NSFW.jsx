import { useContext, useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, Camera, CheckCircle2, Loader2, Play, Shield, Square, Upload, Webcam } from "lucide-react"
import { UserContext } from "../Contexts/UserContext"

const API_BASE = "http://localhost:3000"
const LIVE_INTERVAL_MS = 1600
const HISTORY_WINDOW = 5

function badgeTone(verdict) {
  if (verdict === "high-risk") return "bg-black text-white dark:bg-white dark:text-black"
  if (verdict === "review") return "border border-black/20 dark:border-white/20"
  return "border border-black/15 dark:border-white/15"
}

function smoothVerdict(history) {
  if (!history.length) {
    return { verdict: "clean", score: 0 }
  }

  const recent = history.slice(-HISTORY_WINDOW)
  const avg = recent.reduce((sum, item) => sum + Number(item.riskScore || 0), 0) / recent.length

  let verdict = "clean"
  if (avg >= 0.72) verdict = "high-risk"
  else if (avg >= 0.45) verdict = "review"

  return {
    verdict,
    score: Number(avg.toFixed(4)),
  }
}

const NSFW = () => {
  const { getAuthHeaders } = useContext(UserContext)

  const [isReady, setIsReady] = useState(false)
  const [isModelChecking, setIsModelChecking] = useState(true)
  const [isCameraOn, setIsCameraOn] = useState(false)
  const [isLiveRunning, setIsLiveRunning] = useState(false)
  const [isLiveLoading, setIsLiveLoading] = useState(false)
  const [isImageLoading, setIsImageLoading] = useState(false)
  const [lastResult, setLastResult] = useState(null)
  const [history, setHistory] = useState([])
  const [error, setError] = useState("")

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const inFlightRef = useRef(false)
  const loopRef = useRef(null)

  const authHeaders = useMemo(() => getAuthHeaders(), [getAuthHeaders])
  const smoothed = smoothVerdict(history)

  useEffect(() => {
    const verifyModel = async () => {
      if (!authHeaders.Authorization) {
        setIsModelChecking(false)
        setIsReady(false)
        setError("Please login again to use NSFW scanner.")
        return
      }

      setIsModelChecking(true)
      setError("")

      try {
        const response = await fetch(`${API_BASE}/api/nsfw/health`, {
          headers: authHeaders,
        })

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}))
          throw new Error(payload.message || "NSFW service is unavailable")
        }

        setIsReady(true)
      } catch (serviceError) {
        setIsReady(false)
        setError(serviceError.message || "Failed to initialize NSFW engine")
      } finally {
        setIsModelChecking(false)
      }
    }

    verifyModel()
  }, [authHeaders])

  useEffect(() => {
    return () => {
      if (loopRef.current) {
        clearInterval(loopRef.current)
      }

      const stream = videoRef.current?.srcObject
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  const postImage = async (blobOrFile, filename = "capture.jpg") => {
    const formData = new FormData()
    formData.append("image", blobOrFile, filename)

    const response = await fetch(`${API_BASE}/api/nsfw/analyze-image`, {
      method: "POST",
      headers: authHeaders,
      body: formData,
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok || !payload?.success) {
      throw new Error(payload?.message || payload?.error || "NSFW analysis failed")
    }

    return payload.result
  }

  const handleUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsImageLoading(true)
    setError("")

    try {
      const result = await postImage(file, file.name)
      setLastResult(result)
      setHistory((prev) => [...prev.slice(-14), result])
    } catch (uploadError) {
      setError(uploadError.message || "Image scan failed")
    } finally {
      setIsImageLoading(false)
      event.target.value = ""
    }
  }

  const startCamera = async () => {
    if (!videoRef.current) return

    setError("")

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })

      videoRef.current.srcObject = stream
      await videoRef.current.play()
      setIsCameraOn(true)
    } catch (cameraError) {
      setError(cameraError.message || "Unable to access camera")
      setIsCameraOn(false)
    }
  }

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      videoRef.current.srcObject = null
    }

    if (loopRef.current) {
      clearInterval(loopRef.current)
      loopRef.current = null
    }

    setIsLiveRunning(false)
    setIsCameraOn(false)
  }

  const analyzeLiveFrame = async () => {
    if (!videoRef.current || !canvasRef.current || inFlightRef.current) return
    if (!videoRef.current.videoWidth || !videoRef.current.videoHeight) return

    inFlightRef.current = true
    setIsLiveLoading(true)

    try {
      const canvas = canvasRef.current
      const context = canvas.getContext("2d")

      const width = 640
      const height = Math.round((videoRef.current.videoHeight / videoRef.current.videoWidth) * width)

      canvas.width = width
      canvas.height = height
      context.drawImage(videoRef.current, 0, 0, width, height)

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82))
      if (!blob) throw new Error("Failed to capture frame")

      const result = await postImage(blob, `frame_${Date.now()}.jpg`)
      setLastResult(result)
      setHistory((prev) => [...prev.slice(-24), result])
    } catch (frameError) {
      setError(frameError.message || "Live frame analysis failed")
      setIsLiveRunning(false)

      if (loopRef.current) {
        clearInterval(loopRef.current)
        loopRef.current = null
      }
    } finally {
      inFlightRef.current = false
      setIsLiveLoading(false)
    }
  }

  const startLiveScan = () => {
    if (!isCameraOn || isLiveRunning) return

    setIsLiveRunning(true)
    setError("")
    analyzeLiveFrame()
    loopRef.current = setInterval(analyzeLiveFrame, LIVE_INTERVAL_MS)
  }

  const stopLiveScan = () => {
    if (loopRef.current) {
      clearInterval(loopRef.current)
      loopRef.current = null
    }
    setIsLiveRunning(false)
  }

  return (
    <div className="w-full min-h-full px-4 md:px-8 py-6 md:py-8 bg-app">
      <div className="max-w-7xl mx-auto space-y-4">
        <section className="mono-panel px-5 md:px-7 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl border border-black/20 dark:border-white/20 grid place-items-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight">NSFW Detector</p>
              <p className="mono-label text-[10px] uppercase text-black/55 dark:text-white/55">Controlled backend moderation engine</p>
            </div>
          </div>

          <div className={`text-xs px-3 py-1 rounded-full ${badgeTone(smoothed.verdict)}`}>
            {isModelChecking ? "Initializing..." : `${smoothed.verdict.toUpperCase()} • ${Math.round(smoothed.score * 100)}%`}
          </div>
        </section>

        <section className="grid lg:grid-cols-2 gap-4">
          <div className="mono-panel p-5 md:p-6">
            <p className="text-sm font-semibold">Live Camera Scan</p>
            <p className="text-sm text-black/65 dark:text-white/65 mt-1">Stream frames are analyzed by your backend model in near real-time.</p>

            <div className="mt-4 rounded-2xl border border-black/15 dark:border-white/15 overflow-hidden bg-black/5 dark:bg-white/5">
              <div className="aspect-video relative">
                <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                {!isCameraOn && (
                  <div className="absolute inset-0 grid place-items-center text-center px-6">
                    <div>
                      <Webcam className="w-8 h-8 mx-auto mb-2" />
                      <p className="text-sm font-medium">Camera is off</p>
                    </div>
                  </div>
                )}
                {isLiveLoading && (
                  <div className="absolute top-3 right-3 rounded-full bg-black text-white dark:bg-white dark:text-black px-3 py-1 text-xs inline-flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Scanning
                  </div>
                )}
              </div>
            </div>

            <canvas ref={canvasRef} className="hidden" />

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                onClick={startCamera}
                disabled={!isReady || isCameraOn}
                className="h-10 rounded-xl border border-black/20 dark:border-white/20 text-sm inline-flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <Camera className="w-4 h-4" />
                Camera
              </button>

              <button
                onClick={stopCamera}
                disabled={!isCameraOn}
                className="h-10 rounded-xl border border-black/20 dark:border-white/20 text-sm inline-flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <Square className="w-4 h-4" />
                Stop
              </button>

              <button
                onClick={startLiveScan}
                disabled={!isCameraOn || isLiveRunning || !isReady}
                className="h-10 rounded-xl bg-black text-white dark:bg-white dark:text-black text-sm inline-flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <Play className="w-4 h-4" />
                Live Scan
              </button>

              <button
                onClick={stopLiveScan}
                disabled={!isLiveRunning}
                className="h-10 rounded-xl border border-black/20 dark:border-white/20 text-sm inline-flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <Square className="w-4 h-4" />
                Pause
              </button>
            </div>
          </div>

          <div className="mono-panel p-5 md:p-6">
            <p className="text-sm font-semibold">On-Demand Image Scan</p>
            <p className="text-sm text-black/65 dark:text-white/65 mt-1">Upload an image for immediate classification.</p>

            <label className="mt-4 rounded-2xl border-2 border-dashed border-black/20 dark:border-white/20 p-5 block cursor-pointer hover:border-black dark:hover:border-white transition">
              <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
              <div className="text-center">
                <Upload className="w-7 h-7 mx-auto mb-2" />
                <p className="text-sm font-medium">Click to upload image</p>
              </div>
            </label>

            <div className="mt-4 rounded-2xl border border-black/15 dark:border-white/15 p-4 min-h-[220px] transition-all duration-300">
              {isModelChecking && (
                <div className="h-full min-h-[180px] grid place-items-center text-center">
                  <div>
                    <Loader2 className="w-7 h-7 mx-auto mb-2 animate-spin" />
                    <p className="text-sm font-medium">Loading moderation model</p>
                  </div>
                </div>
              )}

              {!isModelChecking && error && (
                <div className="h-full min-h-[180px] grid place-items-center text-center">
                  <div>
                    <AlertTriangle className="w-7 h-7 mx-auto mb-2" />
                    <p className="text-sm font-medium">{error}</p>
                  </div>
                </div>
              )}

              {!isModelChecking && !error && !lastResult && (
                <div className="h-full min-h-[180px] grid place-items-center text-center">
                  <div>
                    <CheckCircle2 className="w-7 h-7 mx-auto mb-2" />
                    <p className="text-sm font-medium">Ready for analysis</p>
                  </div>
                </div>
              )}

              {lastResult && !error && (
                <div className="space-y-3 animate-[fadeIn_350ms_ease-out]">
                  <div className={`rounded-xl px-3 py-2 text-sm inline-flex items-center gap-2 ${badgeTone(lastResult.verdict)}`}>
                    {lastResult.verdict === "high-risk" ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                    {lastResult.verdict.toUpperCase()} - {Math.round(Number(lastResult.riskScore || 0) * 100)}%
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-lg border border-black/10 dark:border-white/10 p-2">
                      <p className="text-[10px] uppercase text-black/55 dark:text-white/55">Porn</p>
                      <p className="font-semibold">{Math.round((lastResult.scores?.Porn || 0) * 100)}%</p>
                    </div>
                    <div className="rounded-lg border border-black/10 dark:border-white/10 p-2">
                      <p className="text-[10px] uppercase text-black/55 dark:text-white/55">Hentai</p>
                      <p className="font-semibold">{Math.round((lastResult.scores?.Hentai || 0) * 100)}%</p>
                    </div>
                    <div className="rounded-lg border border-black/10 dark:border-white/10 p-2">
                      <p className="text-[10px] uppercase text-black/55 dark:text-white/55">Sexy</p>
                      <p className="font-semibold">{Math.round((lastResult.scores?.Sexy || 0) * 100)}%</p>
                    </div>
                    <div className="rounded-lg border border-black/10 dark:border-white/10 p-2">
                      <p className="text-[10px] uppercase text-black/55 dark:text-white/55">Neutral</p>
                      <p className="font-semibold">{Math.round((lastResult.scores?.Neutral || 0) * 100)}%</p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-black/10 dark:border-white/10 p-2 text-xs text-black/65 dark:text-white/65">
                    Top class: {lastResult.topClass} • Engine: {lastResult.model?.provider}
                    {isImageLoading ? " • Processing image..." : ""}
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

export default NSFW
