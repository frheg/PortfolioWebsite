export default function OrbitDisclosure({ title, hint, children, defaultOpen = false }) {
  return (
    <details className="orbit-disclosure" open={defaultOpen}>
      <summary className="orbit-summary">
        <span>
          <span className="orbit-summary-title">{title}</span>
          {hint ? <span className="orbit-summary-hint">{hint}</span> : null}
        </span>
      </summary>
      <div className="mt-5">{children}</div>
    </details>
  )
}
