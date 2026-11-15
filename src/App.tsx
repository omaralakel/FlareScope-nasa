import logo from './assets/logo.svg'
import { FlameCanvas } from './components/Flame/FlameCanvas'
import { FlameControls } from './components/Flame/FlameControls'
import { ConditionMap } from './components/ConditionMap/ConditionMap'
import { dataset } from './data/dataset'
import { HABITATS, type HabitatId } from './model/habitats'
import { StoreProvider, useStore } from './state/store'

function LiveFlame() {
  const { o2, pressure, flow, gravity } = useStore()
  return <FlameCanvas o2={o2} pressure={pressure} flow={flow} gravity={gravity} />
}

/** Temporary habitat picker so the map can be exercised; replaced by the real selector later. */
function TempHabitatPicker() {
  const { habitat, setHabitat } = useStore()
  return (
    <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: 14, marginBottom: 12 }}>
      Habitat
      <select value={habitat} onChange={(e) => setHabitat(e.currentTarget.value as HabitatId)}>
        {Object.values(HABITATS).map((h) => (
          <option key={h.id} value={h.id}>{h.label}</option>
        ))}
      </select>
    </label>
  )
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
      <div className="map-demo" style={{ padding: 28, paddingTop: 0 }}>
        <TempHabitatPicker />
        <ConditionMap dataset={dataset} />
      </div>
    </StoreProvider>
  )
}
