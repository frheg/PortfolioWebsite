import BackgroundCanvas from './components/BackgroundCanvas'
import Intro from './components/Intro'
import Sections from './components/Sections'
import Nav from './components/Nav'

export default function App() {
  return (
    <main>
      <Nav />
      <BackgroundCanvas />
      <Intro />
      <Sections />
    </main>
  )
}
