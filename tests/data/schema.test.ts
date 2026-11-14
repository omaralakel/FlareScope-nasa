import { describe, it, expect } from 'vitest';
import { loadDataset } from '../../src/data/loadData';

const missing = { value: null, source: null, confidence: 'missing' };

function makeInvestigation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv-1',
    name: 'Test Investigation',
    years: '2010-2012',
    platform: 'ISS',
    hardware: 'Combustion Integrated Rack',
    fuelPhase: 'solid',
    fuels: ['PMMA'],
    sampleGeometry: { value: 'flat', source: 'Paper A', confidence: 'stated' },
    o2Percent: { value: { min: 18, max: 21 }, source: 'Paper A', confidence: 'stated' },
    pressurePsi: missing,
    flowCmS: missing,
    diluents: ['N2'],
    varied: ['o2'],
    fixed: ['pressure'],
    sensors: ['camera'],
    findings: [{ text: 'Flames spread slowly', source: 'Paper A' }],
    pillars: ['prevention'],
    psiUrl: null,
    summary: 'A test investigation.',
    ...overrides,
  };
}

function makeTest(overrides: Record<string, unknown> = {}) {
  return {
    investigationId: 'inv-1',
    o2Percent: 21,
    pressurePsi: 14.7,
    flowCmS: null,
    fuel: 'PMMA',
    outcome: 'burned',
    source: 'Paper A',
    ...overrides,
  };
}

function makeDataset(overrides: Record<string, unknown> = {}) {
  return {
    investigations: [makeInvestigation()],
    tests: [makeTest()],
    generatedAt: '2026-11-15T00:00:00Z',
    ...overrides,
  };
}

describe('dataset schema', () => {
  it('accepts a valid dataset', () => {
    expect(loadDataset(makeDataset()).investigations).toHaveLength(1);
  });

  it("rejects a Sourced value with confidence 'stated' and null source", () => {
    const raw = makeDataset({
      investigations: [
        makeInvestigation({
          sampleGeometry: { value: 'flat', source: null, confidence: 'stated' },
        }),
      ],
    });
    expect(() => loadDataset(raw)).toThrow(/sampleGeometry/);
  });

  it("accepts a Sourced value with confidence 'missing', value null, source null", () => {
    const raw = makeDataset({
      investigations: [makeInvestigation({ sampleGeometry: missing })],
    });
    expect(() => loadDataset(raw)).not.toThrow();
  });

  it("rejects confidence 'missing' with a non-null value", () => {
    const raw = makeDataset({
      investigations: [
        makeInvestigation({
          sampleGeometry: { value: 'flat', source: null, confidence: 'missing' },
        }),
      ],
    });
    expect(() => loadDataset(raw)).toThrow();
  });

  it("rejects confidence 'derived' with a null value", () => {
    const raw = makeDataset({
      investigations: [
        makeInvestigation({
          sampleGeometry: { value: null, source: 'x', confidence: 'derived' },
        }),
      ],
    });
    expect(() => loadDataset(raw)).toThrow();
  });

  it('rejects duplicate investigation ids', () => {
    const raw = makeDataset({
      investigations: [makeInvestigation(), makeInvestigation()],
    });
    expect(() => loadDataset(raw)).toThrow(/duplicate/i);
  });

  it('rejects a TestPoint whose investigationId is not in investigations', () => {
    const raw = makeDataset({ tests: [makeTest({ investigationId: 'nope' })] });
    expect(() => loadDataset(raw)).toThrow(/nope/);
  });

  it('rejects o2Percent outside 0..100', () => {
    expect(() => loadDataset(makeDataset({ tests: [makeTest({ o2Percent: 101 })] }))).toThrow(/o2Percent/);
    expect(() => loadDataset(makeDataset({ tests: [makeTest({ o2Percent: -1 })] }))).toThrow(/o2Percent/);
  });
});
