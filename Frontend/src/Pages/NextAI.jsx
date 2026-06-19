import { useContext, useEffect, useMemo, useRef, useState } from "react"
import { Button, Input } from "@nextui-org/react"
import { Bot, Upload } from "lucide-react"
import { FaBolt } from "react-icons/fa6"
import { IoSend } from "react-icons/io5"
import Markdown from "react-markdown"
import remarkBreaks from "remark-breaks"
import axios from "axios"
import { UserContext } from "../Contexts/UserContext"
import { withApiBase } from "../config/api"

const api = axios.create({
  baseURL: withApiBase(),
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
})

const GREETING = { text: "How can I assist your security workflow today?", type: "received" }

const createConversationId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  return `conv_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

const formatConversationTitle = (text) => {
  const clean = String(text || "").replace(/\s+/g, " ").trim()
  if (!clean) return "Untitled chat"
  if (clean.length <= 42) return clean
  return `${clean.slice(0, 42)}...`
}

const NextAI = () => {
  const { getAuthHeaders } = useContext(UserContext)
  const [messages, setMessages] = useState([GREETING])
  const [inputValue, setInputValue] = useState("")
  const [typing, setTyping] = useState(false)
  const [scanBtnDisabled, setScanBtnDisabled] = useState(false)
  const [scanBtnTxt, setScanBtnTxt] = useState("Scan")
  const [file, setFile] = useState(null)
  const [activeConversationId, setActiveConversationId] = useState(() => createConversationId())
  const [conversations, setConversations] = useState([])
  const [loadingConversationId, setLoadingConversationId] = useState("")
  const chatScrollRef = useRef(null)

  const authHeaders = useMemo(() => getAuthHeaders(), [getAuthHeaders])

  const loadConversationList = async () => {
    if (!authHeaders.Authorization) {
      setConversations([])
      return
    }

    try {
      const response = await api.get("/api/chat/conversations", { headers: authHeaders })
      setConversations(response.data?.conversations || [])
    } catch {
      setConversations([])
    }
  }

  const loadConversationMessages = async (conversationId) => {
    if (!authHeaders.Authorization || !conversationId) {
      setMessages([GREETING])
      return
    }

    setLoadingConversationId(conversationId)

    try {
      const response = await api.get("/api/chat/history", {
        params: { conversationId, limit: 60 },
        headers: authHeaders,
      })

      const history = (response.data?.history || []).slice().reverse()

      if (history.length === 0) {
        setMessages([GREETING])
      } else {
        const loadedMessages = []
        history.forEach((item) => {
          loadedMessages.push({ text: item.prompt, type: "sent" })
          loadedMessages.push({ text: item.response, type: "received" })
        })
        setMessages(loadedMessages)
      }
    } catch {
      setMessages([GREETING])
    } finally {
      setLoadingConversationId("")
    }
  }

  const handleNewChat = () => {
    setActiveConversationId(createConversationId())
    setMessages([GREETING])
    setInputValue("")
    setTyping(false)
    setScanBtnDisabled(false)
    setScanBtnTxt("Scan")
    setFile(null)
  }

  const handleOpenConversation = async (conversationId) => {
    if (!conversationId || conversationId === activeConversationId) return
    setActiveConversationId(conversationId)
    await loadConversationMessages(conversationId)
  }

  useEffect(() => {
    setMessages([GREETING])
    loadConversationList()
  }, [authHeaders.Authorization])

  useEffect(() => {
    if (!chatScrollRef.current) return
    chatScrollRef.current.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, typing, loadingConversationId])

  const handleFileChange = (event) => {
    setFile(event.target.files[0])
  }

  const handleFileScan = async () => {
    if (!file) {
      alert("Please select a file first")
      return
    }

    const formData = new FormData()
    formData.append("file", file)
    setScanBtnTxt("Scanning")
    setScanBtnDisabled(true)

    try {
      const response = await api.post("/scanFile", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })

      const data = response.data
      const receivedMessage = {
        text: data.answer.ai_output,
        type: "received",
        server_cmd: data.answer.server_cmd,
      }
      setMessages((prevMessages) => [...prevMessages, receivedMessage])
      setScanBtnTxt("Scan")
      setScanBtnDisabled(false)
    } catch (error) {
      setScanBtnTxt("Scan Failed")
      setScanBtnDisabled(false)
      alert("There was an issue scanning the file. Please try again.")
      console.error(error)
    }
  }

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return

    const message = inputValue.trim()
    setMessages((prevMessages) => [...prevMessages, { text: message, type: "sent" }])
    setTyping(true)
    setInputValue("")

    try {
      const response = await api.post("/groqChat", { q: message })
      const answer = response.data.answer || response.data
      const parsed = {
        ai_output: answer.ai_output || answer.text || "No response content",
        server_cmd: answer.server_cmd || "none",
      }

      setMessages((prevMessages) => [
        ...prevMessages,
        { text: parsed.ai_output, type: "received", server_cmd: parsed.server_cmd },
      ])

      if (authHeaders.Authorization) {
        await api.post(
          "/api/chat/history",
          {
            conversationId: activeConversationId,
            prompt: message,
            response: parsed.ai_output,
            model: "groq",
            metadata: {
              route: "nextai",
              source: "web",
            },
          },
          { headers: authHeaders }
        )

        await loadConversationList()
      }
    } catch (error) {
      const serverErrorMessage =
        typeof error?.response?.data === "string"
          ? error.response.data
          : error?.response?.data?.message || error?.response?.data?.error || null

      const errorText =
        !navigator.onLine
          ? "You appear to be offline."
          : error?.response?.status === 429
          ? "Groq is rate-limited right now. Please wait a few seconds and try again."
          : error.response
          ? `Server error: ${serverErrorMessage || error.message}`
          : "No response from server. Please try again."

      setMessages((prevMessages) => [...prevMessages, { text: errorText, type: "received", server_cmd: "none" }])
    } finally {
      setTyping(false)
    }
  }

  return (
    <div className="w-full min-h-full px-4 md:px-8 py-6 md:py-8 bg-app">
      <div className="max-w-6xl mx-auto mono-panel h-[calc(100vh-9.5rem)] overflow-hidden flex">
        <aside className="w-[280px] border-r border-black/10 dark:border-white/10 p-4 md:p-5 hidden md:flex md:flex-col gap-3">
          <Button radius="lg" className="bg-black text-white dark:bg-white dark:text-black font-medium" onClick={handleNewChat}>
            New Chat
          </Button>

          <div className="mono-label text-[10px] uppercase text-black/55 dark:text-white/55 px-1">Previous Chats</div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {conversations.length === 0 ? (
              <p className="text-xs text-black/55 dark:text-white/55 px-1">No previous chats yet.</p>
            ) : (
              conversations.map((conversation) => {
                const isActive = conversation._id === activeConversationId
                const isLoading = loadingConversationId === conversation._id

                return (
                  <button
                    type="button"
                    key={conversation._id}
                    onClick={() => handleOpenConversation(conversation._id)}
                    className={`w-full text-left rounded-xl border px-3 py-2 transition-colors ${
                      isActive
                        ? "bg-black text-white border-black dark:bg-white dark:text-black dark:border-white"
                        : "border-black/12 dark:border-white/12 hover:bg-black/5 dark:hover:bg-white/10"
                    }`}
                  >
                    <p className="text-sm font-medium leading-tight">{formatConversationTitle(conversation.latestPrompt)}</p>
                    <p className={`text-[11px] mt-1 ${isActive ? "text-white/80 dark:text-black/70" : "text-black/55 dark:text-white/55"}`}>
                      {conversation.messageCount} msg {conversation.messageCount > 1 ? "turns" : "turn"}
                      {isLoading ? " - loading..." : ""}
                    </p>
                  </button>
                )
              })
            )}
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          <div className="border-b border-black/10 dark:border-white/10 px-5 md:px-7 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl border border-black/20 dark:border-white/20 grid place-items-center">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <p className="text-lg font-semibold tracking-tight">NextAI Console</p>
                <p className="mono-label text-[10px] uppercase text-black/55 dark:text-white/55">Secure conversational assistant</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button radius="lg" variant="bordered" className="md:hidden" onClick={handleNewChat}>
                New Chat
              </Button>
              <div className="text-xs px-3 py-1 rounded-full border border-black/15 dark:border-white/15">Active</div>
            </div>
          </div>

          <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3">
            {messages.map((msg, index) => (
              <div key={index} className={`flex ${msg.type === "sent" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] md:max-w-[68%] rounded-2xl px-4 py-3 text-sm border ${
                    msg.type === "sent"
                      ? "bg-black text-white border-black dark:bg-white dark:text-black dark:border-white"
                      : "bg-white/80 dark:bg-black/40 border-black/10 dark:border-white/10"
                  }`}
                >
                  {msg.type === "received" ? (
                    <Markdown remarkPlugins={[remarkBreaks]}>{msg.text}</Markdown>
                  ) : (
                    <p>{msg.text}</p>
                  )}

                  {msg.server_cmd === "filescan" && (
                    <div className="mt-3 p-3 rounded-xl border border-black/15 dark:border-white/15">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Input
                          radius="lg"
                          variant="bordered"
                          type="file"
                          onChange={handleFileChange}
                          startContent={<Upload className="w-4 h-4" />}
                        />
                        <Button
                          radius="lg"
                          className="bg-black text-white dark:bg-white dark:text-black font-medium"
                          onClick={handleFileScan}
                          isDisabled={scanBtnDisabled}
                        >
                          {scanBtnTxt}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {typing && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-black/10 dark:border-white/10 px-4 py-3 text-sm text-black/70 dark:text-white/70">
                  Thinking...
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-black/10 dark:border-white/10 p-4 md:p-5">
            <div className="flex gap-3">
              <div className="flex-1">
                <Input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Ask about malware, indicators, triage, or response"
                  radius="lg"
                  size="lg"
                  variant="bordered"
                  startContent={<FaBolt className="w-4 h-4" />}
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                />
              </div>
              <Button
                radius="lg"
                size="lg"
                className="bg-black text-white dark:bg-white dark:text-black min-w-[58px]"
                onClick={handleSendMessage}
                isDisabled={!inputValue.trim()}
              >
                <IoSend className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default NextAI
