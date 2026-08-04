import { useEffect, useRef, useState } from 'react'
import PageHero from '../components/PageHero'
import SectionCard from '../components/ui/SectionCard'
import { usePageMeta } from '../hooks/usePageMeta'

const MODEL_ID = 'SmolLM2-135M-Instruct-q0f16-MLC'

export default function ChatPage() {
  usePageMeta({
    title: 'Fredric Hegland | Local Chat',
    description: 'Chat with SmolLM2-135M running entirely inside your browser via WebGPU.',
  })

  const [supported, setSupported] = useState(true)
  const [status, setStatus] = useState('idle') // idle | loading | ready | error
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [generating, setGenerating] = useState(false)

  const engineRef = useRef(null)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.gpu) {
      setSupported(false)
    }
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  async function loadModel() {
    setStatus('loading')
    setError('')
    try {
      const webllm = await import('@mlc-ai/web-llm')
      const engine = await webllm.CreateMLCEngine(MODEL_ID, {
        initProgressCallback: (report) => setProgress(report.text),
      })
      engineRef.current = engine
      setStatus('ready')
    } catch (err) {
      console.error(err)
      setError(err?.message || 'Failed to load the model.')
      setStatus('error')
    }
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
        messages: nextMessages,
        stream: true,
      })

      let text = ''
      for await (const chunk of stream) {
        text += chunk.choices[0]?.delta?.content || ''
        setMessages([...nextMessages, { role: 'assistant', content: text }])
      }
    } catch (err) {
      console.error(err)
      setMessages([...nextMessages, { role: 'assistant', content: 'Something went wrong generating a reply.' }])
    } finally {
      setGenerating(false)
    }
  }

  return (
    <>
      <PageHero
        eyebrow="Local Inference"
        title="Chat with SmolLM2-135M, running entirely in your browser."
        description="No server, no API keys, no data leaving your machine. The model downloads once via WebGPU and runs client-side from then on."
      />

      <div className="relative mx-auto w-full max-w-4xl px-4 pb-28 text-left sm:px-6 sm:pb-24 lg:px-8">
        <SectionCard
          id="chat"
          eyebrow="SmolLM2 · 135M · WebGPU"
          title="A tiny model, entirely local."
          description="This uses WebLLM to compile and run the model in your browser via WebGPU. The first load downloads a few hundred MB, which your browser then caches."
        >
          {!supported ? (
            <p className="rounded-[1rem] border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100">
              Your browser does not appear to support WebGPU, which this page needs to run the model locally.
              Try a recent version of Chrome or Edge on desktop.
            </p>
          ) : status === 'idle' ? (
            <button
              type="button"
              onClick={loadModel}
              className="inline-flex items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-300/10 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:-translate-y-0.5 hover:border-cyan-200 hover:bg-cyan-300/18"
            >
              Load model
            </button>
          ) : status === 'loading' ? (
            <p className="text-sm text-slate-200/84">{progress || 'Loading model…'}</p>
          ) : status === 'error' ? (
            <p className="rounded-[1rem] border border-red-300/30 bg-red-300/10 p-4 text-sm text-red-100">{error}</p>
          ) : (
            <div className="flex flex-col gap-4">
              <div
                ref={scrollRef}
                className="flex h-[28rem] flex-col gap-3 overflow-y-auto rounded-[1.2rem] border border-white/10 bg-black/20 p-4"
              >
                {messages.length === 0 ? (
                  <p className="text-sm text-slate-200/60">Say hello to get started.</p>
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
                  placeholder="Type a message…"
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
