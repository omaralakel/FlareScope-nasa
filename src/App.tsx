import logo from './assets/logo.svg'
import { FlameCanvas } from './components/Flame/FlameCanvas'
import { FlameControls } from './components/Flame/FlameControls'
import { ConditionMap } from './components/ConditionMap/ConditionMap'
import { dataset } from './data/dataset'
import { MissionPicker } from './components/MissionPicker/MissionPicker'
import { RankedList } from './components/RankedList/RankedList'
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
      <MissionPicker />
      {/* Temporary mount; final layout lands in Task 13. */}
      <main className="flame-demo">
        <LiveFlame />
        <FlameControls />
      </main>
      <div className="map-demo" style={{ padding: 28, paddingTop: 0 }}>
        <ConditionMap dataset={dataset} />
      </div>
      <RankedList dataset={dataset} />
    </StoreProvider>
  )
}
