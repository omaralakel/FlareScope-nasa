import { useCallback, useRef, useState, type ReactNode } from 'react'
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
import { Compare } from './components/DnaCard/Compare'
import { GravityBridge } from './components/GravityBridge/GravityBridge'
import { AskPanel } from './components/Ask/AskPanel'
import { fmtG, fmtNum } from './lib/format'
import { HABITATS } from './model/habitats'
import { STEPS, STEP_LABELS, stepNumber, usePresenter, type IntroHandle, type StepId } from './presenter/usePresenter'
import './styles/layout.css'

function LiveFlame() {
  const { o2, pressure, flow, gravity } = useStore()
  return <FlameCanvas o2={o2} pressure={pressure} flow={flow} gravity={gravity} />
}

/** Current habitat and the live conditions everything on the page is using. */
function HabitatBadge() {
  const { habitat, o2, pressure, gravity } = useStore()
  return (
    <p className="fs-badge" aria-label={`Current habitat ${HABITATS[habitat].label}: ${fmtNum(o2)} percent oxygen, ${fmtNum(pressure)} psi, ${fmtG(gravity)} g`}>
      <span className="fs-badge__name">{HABITATS[habitat].label}</span>
      <span className="fs-badge__vals" aria-hidden="true">
        <span>{+o2.toFixed(1)}<small>% O₂</small></span>
        <span>{pressure.toFixed(1)}<small> psi</small></span>
        <span>{+gravity.toFixed(3)}<small> g</small></span>
      </span>
    </p>
  )
}

/** A numbered page section; its id and number match the presenter step. */
function Section({ id, className, children }: { id: StepId; className?: string; children: ReactNode }) {
  const i = STEPS.indexOf(id)
  return (
    <section id={id} className={`fs-section${className ? ` ${className}` : ''}`} aria-labelledby={`${id}-eyebrow`}>
      <p className="fs-eyebrow" id={`${id}-eyebrow`}>
        <span className="fs-eyebrow__n">{stepNumber(i)}</span> — {STEP_LABELS[id]}
      </p>
      {children}
    </section>
  )
}

function StepIndicator({ step }: { step: number }) {
  return (
    <div className="fs-indicator" role="status" aria-live="polite">
      <span className="fs-indicator__n">{step + 1}/{STEPS.length}</span>
      <span>{STEP_LABELS[STEPS[step]]}</span>
    </div>
  )
}

function Page() {
  const { compare, setCompare } = useStore()
  const introRef = useRef<IntroHandle>(null)
  const [mapReset, setMapReset] = useState(0)
  const onMapReset = useCallback(() => setMapReset((n) => n + 1), [])
  const { step, indicator, goTo } = usePresenter({ introRef, onMapReset })

  /** Selecting an investigation anywhere puts it in slot A of Compare and scrolls there. */
  const openInvestigation = (id: string) => {
    // Chosen id goes to slot A; if it was in B, swap so B is never dropped.
    setCompare(id, compare[1] === id ? compare[0] : compare[1])
    // Same path as the presenter (scroll-sync paused until it lands), without the step's demo pair.
    goTo(STEPS.indexOf('compare'), false)
  }

  return (
    <>
      <div id="intro">
        <StoryIntro ref={introRef} onDone={() => goTo(STEPS.indexOf('mission'), false)} />
      </div>
      <header className="fs-header">
        <div className="fs-header__inner">
          <a className="fs-brand" href="#intro" onClick={(e) => { e.preventDefault(); goTo(0, false) }}>
            <img src={logo} alt="" />
            <span className="fs-brand__name">FlameScope</span>
            <span className="fs-brand__by">by Buffet Conquerers</span>
          </a>
          <HabitatBadge />
        </div>
      </header>
      <main className="fs-main">
        <Section id="mission">
          <MissionPicker />
        </Section>
        <div className="fs-stage">
          <Section id="flame" className="fs-flame">
            <LiveFlame />
            <FlameControls />
          </Section>
          <Section id="map" className="fs-map">
            <ConditionMap dataset={dataset} axisResetKey={mapReset} onSelectInvestigation={openInvestigation} />
          </Section>
        </div>
        <Section id="ranking">
          <RankedList dataset={dataset} onSelectInvestigation={openInvestigation} />
        </Section>
        <Section id="gravity">
          <GravityBridge dataset={dataset} onSelectInvestigation={openInvestigation} />
        </Section>
        <Section id="compare">
          <Compare />
        </Section>
        <Section id="ask">
          <AskPanel onSelectInvestigation={openInvestigation} />
        </Section>
        <Section id="earth">
          <EarthSection onSelectInvestigation={openInvestigation} />
        </Section>
      </main>
      <footer className="fs-footer">
        <div className="fs-footer__inner">
          <p>
            Data: NASA Physical Sciences Informatics (PSI) —{' '}
            <a href="https://psi.nasa.gov" target="_blank" rel="noopener noreferrer">psi.nasa.gov</a>
          </p>
          <p className="fs-footer__meta">FlameScope · Buffet Conquerers · NASA Space Apps 2026</p>
        </div>
      </footer>
      {indicator && <StepIndicator step={step} />}
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
