import logo from './assets/logo.svg'
import { FlameCanvas } from './components/Flame/FlameCanvas'
import { FlameControls } from './components/Flame/FlameControls'
import { StoreProvider, useStore } from './state/store'

function LiveFlame() {
  const { o2, pressure, flow, gravity } = useStore()
  return <FlameCanvas o2={o2} pressure={pressure} flow={flow} gravity={gravity} />
}

export default function App() {
  return (
    <StoreProvider>
      <header className="app-header">
        <img src={logo} alt="" />
        <h1>FlameScope</h1>
        <span className="byline">by Buffet Conquerers</span>
      </header>
      {/* Temporary mount; final layout lands in Task 13. */}
      <main className="flame-demo">
        <LiveFlame />
        <FlameControls />
      </main>
    </StoreProvider>
  )
}
