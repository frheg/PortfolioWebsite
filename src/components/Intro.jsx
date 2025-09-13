import { useEffect } from 'react'

export default function Intro() {
  useEffect(() => {
    const intro = document.querySelector('.intro')
    if (intro) {
      intro.addEventListener('animationend', () => {
        document.body.style.overflow = 'auto'
        document.body.setAttribute('data-intro-complete', 'true')
      })
    }
  }, [])

  return (
    <>
      <section className="intro text-cyan-300">Welcome to my portfolio website!</section>
      <section className="instruction">
        <p>Scroll down to learn more about me!</p>
      </section>
    </>
  )
}
