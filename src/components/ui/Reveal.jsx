import { useRef } from 'react'
import { useScrollReveal } from '../../hooks/useScrollReveal'

// Thin wrapper so existing markup can opt into useScrollReveal without
// restructuring the element itself — wrap a card/block and give it a
// variant + stagger delay.
export default function Reveal(props) {
  const { as = 'div', variant = 'up', delay = 0, className, children, ...rest } = props
  const RevealTag = as
  const ref = useRef(null)
  useScrollReveal(ref, { variant, delay })

  return (
    <RevealTag ref={ref} className={className} {...rest}>
      {children}
    </RevealTag>
  )
}
