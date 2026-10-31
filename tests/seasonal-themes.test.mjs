import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const source = readFileSync(new URL('../src/lib/themes.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
function load(globals = {}) {
  const exports = {}
  vm.runInNewContext(compiled, { exports, ...globals })
  return exports
}
const themes = load()

test('Christmas follows the local December calendar including both boundaries', () => {
  for (const year of [2026, 2027, 2028]) {
    assert.equal(themes.isChristmasSeason(new Date(year, 10, 30, 23, 59, 59, 999)), false)
    assert.equal(themes.isChristmasSeason(new Date(year, 11, 1, 0, 0, 0, 0)), true)
    assert.equal(themes.isChristmasSeason(new Date(year, 11, 31, 23, 59, 59, 999)), true)
    assert.equal(themes.isChristmasSeason(new Date(year + 1, 0, 1, 0, 0, 0, 0)), false)
  }
  for (let month = 0; month < 11; month++) {
    assert.equal(themes.isChristmasSeason(new Date(2026, month, 15)), false)
  }
})

test('December shows only Christmas regardless of normal theme or contrast', () => {
  assert.deepEqual(Array.from(themes.themeOptions(true), (item) => item.id), ['christmas'])
  for (const { id } of themes.THEMES) {
    for (const contrast of ['standard', 'high']) {
      assert.equal(themes.resolveTheme(id, contrast, true), 'christmas')
    }
  }
})

test('normal choices return after December and high contrast resolves compatibly', () => {
  assert.equal(themes.themeOptions(false).length, 12)
  assert.ok(themes.themeOptions(false).every((item) => item.id !== 'christmas'))
  for (const { id } of themes.THEMES) {
    assert.equal(themes.resolveTheme(id, 'standard', false), id)
    const high = themes.resolveTheme(id, 'high', false)
    assert.equal(high, ['dark', 'neon', 'midnight'].includes(id) ? 'dark' : 'original')
    // Resolving temporary palettes never mutates the normal preference.
    themes.resolveTheme(id, 'high', true)
    assert.equal(themes.resolveTheme(id, 'standard', false), id)
  }
  assert.equal(themes.isThemeName('christmas'), false)
  assert.equal(themes.isThemeName('unexpected'), false)
})

function clockHarness(initial) {
  let now = initial
  let timer = null
  let timerId = 0
  const windowEvents = new Map()
  const documentEvents = new Map()
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [now])) }
  }
  const events = (map) => ({
    addEventListener: (name, callback) => map.set(name, callback),
    removeEventListener: (name, callback) => { if (map.get(name) === callback) map.delete(name) },
  })
  const globals = {
    Date: Clock,
    window: {
      ...events(windowEvents),
      setTimeout: (callback, delay) => { timer = { callback, delay, id: ++timerId }; return timerId },
      clearTimeout: (id) => { if (timer?.id === id) timer = null },
    },
    document: events(documentEvents),
  }
  return {
    api: load(globals), windowEvents, documentEvents,
    setNow: (value) => { now = value },
    getTimer: () => timer,
    fireTimer: () => timer.callback(),
  }
}

test('an open page switches at December and January midnight and cleans up listeners', () => {
  const harness = clockHarness(new Date(2026, 10, 30, 23, 59, 59, 900).getTime())
  const states = []
  const stop = harness.api.watchChristmasSeason((value) => states.push(value))
  assert.deepEqual(states, [false])
  assert.equal(harness.getTimer().delay, 125)
  harness.setNow(new Date(2026, 11, 1, 0, 0, 0, 25).getTime())
  harness.fireTimer()
  assert.deepEqual(states, [false, true])
  harness.setNow(new Date(2027, 0, 1, 0, 0, 0, 25).getTime())
  harness.fireTimer()
  assert.deepEqual(states, [false, true, false])
  stop()
  assert.equal(harness.getTimer(), null)
  assert.equal(harness.windowEvents.size, 0)
  assert.equal(harness.documentEvents.size, 0)
})

test('focus, visibility and page restore refresh a suspended page', () => {
  for (const event of ['focus', 'pageshow', 'visibilitychange']) {
    const harness = clockHarness(new Date(2026, 11, 31, 12).getTime())
    let active
    const stop = harness.api.watchChristmasSeason((value) => { active = value })
    assert.equal(active, true)
    harness.setNow(new Date(2027, 0, 2, 12).getTime())
    const map = event === 'visibilitychange' ? harness.documentEvents : harness.windowEvents
    map.get(event)()
    assert.equal(active, false)
    assert.ok(harness.getTimer().delay > 0 && harness.getTimer().delay <= 86400025)
    stop()
  }
})
