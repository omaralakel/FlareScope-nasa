import logo from './assets/logo.svg'
import { FlameCanvas } from './components/Flame/FlameCanvas'
import { FlameControls } from './components/Flame/FlameControls'
import { ConditionMap } from './components/ConditionMap/ConditionMap'
import { dataset } from './data/dataset'
import { MissionPicker } from './components/MissionPicker/MissionPicker'
import { RankedList } from './components/RankedList/RankedList'
import { StoreProvider, useStore } from './state/store'
import { StoryIntro } from './components/StoryIntro/StoryIntro'
import { EarthSection } from './components/EarthSection/EarthSection'
import { Compare, DEFAULT_COMPARE } from './components/DnaCard/Compare'

// Temporary wiring; Task 13 replaces this with the presenter layout.
const scrollToId = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

function LiveFlame() {
  const { o2, pressure, flow, gravity } = useStore()
  return <FlameCanvas o2={o2} pressure={pressure} flow={flow} gravity={gravity} />
}

/** Selecting an investigation anywhere puts it in slot A of Compare and scrolls there. */
function Page() {
  const { compare, setCompare } = useStore()
  const openInvestigation = (id: string) => {
    const second = compare[0] === null && compare[1] === null ? DEFAULT_COMPARE[1] : compare[1]
    setCompare(id, second === id ? null : second)
    scrollToId('compare')
  }
  return (
    <>
      <StoryIntro onDone={() => scrollToId('mission')} />
      <header className="app-header">
        <img src={logo} alt="" />
        <h1>FlameScope</h1>
        <span className="byline">by Buffet Conquerers</span>
      </header>
      <div id="mission">
        <MissionPicker />
      </div>
      {/* Temporary mount; final layout lands in Task 13. */}
      <main className="flame-demo">
        <LiveFlame />
        <FlameControls />
      </main>
      <div className="map-demo" style={{ padding: 28, paddingTop: 0 }}>
        <ConditionMap dataset={dataset} onSelectInvestigation={openInvestigation} />
      </div>
      <div id="ranked">
        <RankedList dataset={dataset} onSelectInvestigation={openInvestigation} />
      </div>
      <EarthSection onSelectInvestigation={openInvestigation} />
      <div id="compare">
        <Compare />
      </div>
    </>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Page />
    </StoreProvider>
  )
}
