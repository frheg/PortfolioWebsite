// Render quality picker (pause menu). Live-applied, remembered per device.
import { useSyncExternalStore } from 'react'
import { QUALITY_LEVELS, getQualityLevel, setQualityLevel, subscribeQuality } from '../three/qualityRuntime'

export default function ExploreQualityControl() {
  const level = useSyncExternalStore(subscribeQuality, getQualityLevel, getQualityLevel)
  return (
    <div>
      <p className="mb-3 text-[0.68rem] uppercase tracking-[0.28em] text-cyan-100/50">Grafikk</p>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Grafikkvalitet">
        {QUALITY_LEVELS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={level === id}
            onClick={() => setQualityLevel(id)}
            className={`rounded-xl border px-3 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.18em] transition active:scale-95 ${
              level === id
                ? 'border-cyan-300/50 bg-cyan-400/15 text-cyan-100'
                : 'border-white/10 bg-white/5 text-cyan-100/60 hover:border-cyan-300/30'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
