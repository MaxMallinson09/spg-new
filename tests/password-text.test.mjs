import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import vm from 'node:vm'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

// Compile the real component in memory using the existing TypeScript toolchain.
const source = readFileSync(new URL('../src/components/PasswordText.tsx', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
  },
})
const exports = {}
vm.runInNewContext(outputText, { exports, require: createRequire(import.meta.url) })
const PasswordText = exports.default
const render = (password, advanced = false) => renderToStaticMarkup(
  createElement(PasswordText, { password, advanced }),
)
const text = (html) => html.replace(/<[^>]+>/g, '')

test('simple passwords retain every character and contain no added spaces', () => {
  for (const password of ['Cup0hat1bus!', 'Apple0mango1cup?', 'Book3honey4note*']) {
    const html = render(password)
    assert.equal(text(html), password)
    assert.equal((html.match(/class="pw-display__word"/g) ?? []).length, 3)
    assert.ok(!html.includes('aria-hidden="true"'))
  }
})

test('wrap groups keep each word and following separator together', () => {
  const html = render('Book3honey4note*')
  const chunks = [...html.matchAll(/<span class="pw-display__word">((?:<span class="pw-display__part">[^<]+<\/span>)+)<\/span>/g)]
    .map((m) => text(m[1]))
  assert.deepEqual(chunks, ['Book3', 'honey4', 'note*'])
})

test('each word, digit and symbol is a separate part with no added text', () => {
  for (const symbol of ['!', '*', '?']) {
    const password = `Book0honey1note${symbol}`
    const html = render(password)
    const parts = [...html.matchAll(/<span class="pw-display__part">([^<]+)<\/span>/g)]
      .map((m) => m[1])
    assert.deepEqual(parts, ['Book', '0', 'honey', '1', 'note', symbol])
    assert.equal(parts.join(''), password)
    assert.equal(text(html), password)
    assert.ok(!/[\s\u200b\u200c\u200d\ufeff]/u.test(text(html)))
  }
})

test('advanced passwords preserve lookalike characters and their exact case', () => {
  const password = 'Il1O0!?*AbCdEfGh23456789'
  const html = render(password, true)
  assert.equal(text(html), password)
  assert.ok(html.includes('pw-display__text--dense'))
  assert.ok(!html.includes('pw-display__word'))
})

test('the loading placeholder stays hidden from assistive technology', () => {
  const html = render(null)
  assert.ok(html.includes('aria-hidden="true"'))
  assert.equal(text(html), '·········')
})

test('unrecognised formats are displayed intact rather than losing characters', () => {
  assert.equal(text(render('1Example?')), '1Example?')
})
