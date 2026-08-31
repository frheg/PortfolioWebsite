import { useEffect, useRef, useState } from 'react'
import SectionCard from '../components/ui/SectionCard'
import { chatSystemPrompt } from '../data/chatKnowledge'

// A range of sizes so visitors can pick whichever actually fits their
// browser/device — mobile browsers in particular enforce a much stricter
// per-tab memory ceiling than desktop regardless of the device's actual RAM
// (iOS Safari in particular kills tabs around ~1.5-2GB), and that ceiling
// varies enough by device that no single automatic guess is reliable.
const MODEL_OPTIONS = [
  {
    id: 'SmolLM2-135M-Instruct-q0f16-MLC',
    name: 'SmolLM2 135M',
    downloadSize: '~360 MB',
    note: 'Minst, mest sannsynlig til å laste hvor som helst. Minst kapabel. Bra hvis ingenting annet fungerer.',
  },
  {
    id: 'SmolLM2-360M-Instruct-q4f16_1-MLC',
    name: 'SmolLM2 360M',
    downloadSize: '~380 MB',
    note: 'Samme størrelse som 135M-alternativet, merkbart mer kapabel. Bra standardvalg for mobil.',
  },
  {
    id: 'gemma3-1b-it-q4f16_1-MLC',
    name: 'Gemma 3 1B',
    downloadSize: '~710 MB',
    note: 'Merkbart mer kapabel. Vanligvis fint på PC, i grenseland på enkelte mobiler.',
  },
  {
    id: 'gemma-2-2b-it-q4f16_1-MLC',
    name: 'Gemma 2 2B',
    downloadSize: '~1.9 GB',
    note: 'Mest kapabel av de fire. Kun PC. Vil krasje de fleste mobilnettlesere.',
  },
]

function isMobileDevice() {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || navigator.maxTouchPoints > 2
}

function defaultModelId() {
  return isMobileDevice() ? MODEL_OPTIONS[1].id : MODEL_OPTIONS[3].id
}

// The model runs with a 4k-token context window. The system prompt + knowledge
// base already use a good chunk of that, so cap how much back-and-forth we
// resend each turn rather than let a long conversation overflow it.
const MAX_HISTORY_MESSAGES = 16

const WEBGPU_LIMIT_PATTERNS = [
  'exceeds limit',
  'maxbuffersize',
  'maxstoragebufferbindingsize',
  'maxstoragebuffersperShaderstage',
  'maxcomputeworkgroupstoragesize',
  'maxcomputeinvocationsperworkgroup',
]

function isLikelyImmatureWebGpu(message) {
  const text = (message || '').toLowerCase()
  return WEBGPU_LIMIT_PATTERNS.some((pattern) => text.includes(pattern.toLowerCase()))
}

export default function ChatPage() {
  const [modelId, setModelId] = useState(defaultModelId)
  const modelInfo = MODEL_OPTIONS.find((option) => option.id === modelId) ?? MODEL_OPTIONS[0]

  const [supported, setSupported] = useState(true)
  const [unsupportedReason, setUnsupportedReason] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | ready | error
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [generating, setGenerating] = useState(false)

  const engineRef = useRef(null)
  const scrollRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    async function checkGpu() {
      if (typeof navigator === 'undefined' || !navigator.gpu) {
        if (!cancelled) {
          setSupported(false)
          setUnsupportedReason('Nettleseren din ser ikke ut til å støtte WebGPU. Prøv en nyere versjon av Chrome eller Edge på PC.')
        }
        return
      }

      try {
        const adapter = await navigator.gpu.requestAdapter()
        if (!adapter) {
          if (!cancelled) {
            setSupported(false)
            setUnsupportedReason('Nettleseren din støtter WebGPU, men ingen kompatibel GPU-adapter ble funnet.')
          }
          return
        }
        if (!adapter.features?.has('shader-f16')) {
          if (!cancelled) {
            setSupported(false)
            setUnsupportedReason('Denne modellen trenger en GPU med støtte for float16-shadere (shader-f16), som enheten din ikke rapporterer.')
          }
        }
      } catch (err) {
        console.error(err)
        if (!cancelled) {
          setSupported(false)
          setUnsupportedReason('Klarte ikke å sjekke GPU-en din for WebGPU-støtte.')
        }
      }
    }

    checkGpu()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  async function loadModel() {
    setStatus('loading')
    setError('')
    setProgress('')
    try {
      const webllm = await import('@mlc-ai/web-llm')
      const engine = await webllm.CreateMLCEngine(modelId, {
        initProgressCallback: (report) => setProgress(report.text),
      })
      engineRef.current = engine
      setStatus('ready')
    } catch (err) {
      console.error(err)
      const message = err?.message || 'Klarte ikke å laste modellen.'
      if (isLikelyImmatureWebGpu(message)) {
        setError(
          'Nettleseren din rapporterer lavere GPU-grenser enn denne modellen trenger. Dette er vanlig i Firefox-baserte nettlesere ' +
            '(inkludert Zen), der WebGPU-støtten fortsatt er ufullstendig. Prøv Chrome, Edge eller Safari, eller velg en mindre modell under.'
        )
      } else {
        setError(message)
      }
      setStatus('error')
    }
  }

  async function changeModel() {
    if (engineRef.current) {
      try {
        await engineRef.current.unload()
      } catch (err) {
        console.error(err)
      }
      engineRef.current = null
    }
    setMessages([])
    setProgress('')
    setError('')
    setStatus('idle')
  }

  async function sendMessage(event) {
    event.preventDefault()
    const text = input.trim()
    if (!text || !engineRef.current || generating) return

    const nextMessages = [...messages, { role: 'user', content: text }]
    setMessages(nextMessages)
    setInput('')
    setGenerating(true)

    try {
      const reply = { role: 'assistant', content: '' }
      setMessages([...nextMessages, reply])

      const stream = await engineRef.current.chat.completions.create({
        messages: [
          { role: 'system', content: chatSystemPrompt },
          ...nextMessages.slice(-MAX_HISTORY_MESSAGES),
        ],
        stream: true,
      })

      let text = ''
      for await (const chunk of stream) {
        text += chunk.choices[0]?.delta?.content || ''
        setMessages([...nextMessages, { role: 'assistant', content: text }])
      }
    } catch (err) {
      console.error(err)
      setMessages([...nextMessages, { role: 'assistant', content: 'Noe gikk galt under generering av svar.' }])
    } finally {
      setGenerating(false)
    }
  }

  return (
    <>
      <div className="relative mx-auto w-full max-w-4xl px-4 pb-28 text-left sm:px-6 sm:pb-24 lg:px-8">
        <SectionCard
          id="chat"
          eyebrow={`${modelInfo.name} · WebGPU`}
          title="Chat med en liten AI-modell, som kjører helt i nettleseren din."
          description="Ingen server, ingen API-nøkler, ingen data forlater maskinen din. Alle modellene her kjører helt lokalt i nettleseren — velg en størrelse som passer enheten din. Hvis den ikke laster eller krasjer fanen, prøv en mindre en."
        >
          {!supported ? (
            <p className="rounded-[1rem] border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100">
              {unsupportedReason || 'Nettleseren din ser ikke ut til å støtte WebGPU, som denne siden trenger for å kjøre modellen lokalt.'}
            </p>
          ) : status === 'idle' ? (
            <div className="space-y-4">
              <div className="grid gap-2.5 sm:grid-cols-2">
                {MODEL_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setModelId(option.id)}
                    aria-pressed={option.id === modelId}
                    className={`rounded-[1rem] border p-3.5 text-left transition ${
                      option.id === modelId
                        ? 'border-cyan-300/50 bg-cyan-300/10'
                        : 'border-white/10 bg-black/20 hover:border-cyan-300/25'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-cyan-100">{option.name}</span>
                      <span className="text-xs text-cyan-300/70">{option.downloadSize}</span>
                    </div>
                    <p className="mt-1.5 text-xs leading-5 text-slate-200/70">{option.note}</p>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={loadModel}
                className="inline-flex items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-300/10 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:-translate-y-0.5 hover:border-cyan-200 hover:bg-cyan-300/18"
              >
                Last {modelInfo.name}
              </button>
            </div>
          ) : status === 'loading' ? (
            <p className="text-sm text-slate-200/84">{progress || `Laster ${modelInfo.name}…`}</p>
          ) : status === 'error' ? (
            <div className="space-y-3">
              <p className="rounded-[1rem] border border-red-300/30 bg-red-300/10 p-4 text-sm text-red-100">{error}</p>
              <button
                type="button"
                onClick={changeModel}
                className="inline-flex items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-300/10 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:-translate-y-0.5 hover:border-cyan-200 hover:bg-cyan-300/18"
              >
                Prøv en annen modell
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/70">{modelInfo.name}</p>
                <button
                  type="button"
                  onClick={changeModel}
                  className="text-xs font-semibold text-cyan-200 transition hover:text-cyan-100"
                >
                  Bytt modell
                </button>
              </div>

              <div
                ref={scrollRef}
                className="flex h-[28rem] flex-col gap-3 overflow-y-auto rounded-[1.2rem] border border-white/10 bg-black/20 p-4"
              >
                {messages.length === 0 ? (
                  <p className="text-sm text-slate-200/60">Si hei for å komme i gang.</p>
                ) : (
                  messages.map((message, index) => (
                    <div
                      key={index}
                      className={`max-w-[85%] rounded-[1rem] px-4 py-2.5 text-sm leading-6 ${
                        message.role === 'user'
                          ? 'self-end bg-cyan-300/15 text-cyan-50'
                          : 'self-start bg-white/5 text-slate-100/88'
                      }`}
                    >
                      {message.content || (generating && index === messages.length - 1 ? '…' : '')}
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={sendMessage} className="flex gap-3">
                <input
                  type="text"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Skriv en melding…"
                  disabled={generating}
                  className="min-w-0 flex-1 rounded-full border border-white/15 bg-black/20 px-4 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-400 focus:border-cyan-300/40"
                />
                <button
                  type="submit"
                  disabled={generating || !input.trim()}
                  className="inline-flex items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-300/10 px-5 py-2.5 text-sm font-semibold text-cyan-100 transition hover:-translate-y-0.5 hover:border-cyan-200 hover:bg-cyan-300/18 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
                >
                  Send
                </button>
              </form>
            </div>
          )}
        </SectionCard>
      </div>
    </>
  )
}
