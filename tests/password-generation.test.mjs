import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const source = readFileSync(new URL('../src/lib/passwords.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const words = [...source.match(/const WORDS = \[([\s\S]*?)\]/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
const allowedWords = new Set(words.map((w) => w.toLowerCase()))

function loadGenerator(random = crypto) {
  const exports = {}
  vm.runInNewContext(compiled, { exports, crypto: random })
  return exports
}

function scripted(values) {
  let index = 0
  return {
    getRandomValues(buffer) {
      assert.ok(index < values.length, 'unexpected additional random draw')
      buffer[0] = values[index++]
      return buffer
    },
  }
}

function checkSimple(result) {
  const parts = Array.from(result.parts)
  assert.equal(parts.length, 4)
  assert.equal(result.password, parts.join(''))
  assert.match(parts[0], /^[A-Z][a-z]{2,4}$/)
  assert.match(parts[3], /^[!*?]$/)
  const middleNumber = /^\d{3}$/.test(parts[1])
  const secondWord = parts[middleNumber ? 2 : 1]
  assert.match(secondWord, /^[a-z]{3,5}$/)
  assert.match(parts[middleNumber ? 1 : 2], /^\d{3}$/)
  assert.notEqual(parts[0].toLowerCase(), secondWord)
  assert.ok(allowedWords.has(parts[0].toLowerCase()) && allowedWords.has(secondWord))
  assert.ok(result.password.length >= 10 && result.password.length <= 14)
  assert.ok(!/\s/.test(result.password))
  return middleNumber
}

test('all ordered word pairs and both number positions are distinct and valid', () => {
  const seen = new Set()
  for (let first = 0; first < words.length; first++) {
    for (let draw = 0; draw < words.length - 1; draw++) {
      for (const position of [0, 1]) {
        const result = loadGenerator(scripted([first, draw, 482, position, 0])).generateSimplePassword()
        assert.equal(checkSimple(result), position === 0)
        seen.add(result.password)
      }
    }
  }
  assert.equal(seen.size, words.length * (words.length - 1) * 2)
  // The requested three-digit format provides 1,000 numbers and three symbols.
  // Record the reduced keyspace explicitly; it no longer meets the old baseline.
  assert.equal(seen.size * 1000 * 3, 49140000)
})

test('rejection sampling and leading zeros work with the number at the end', () => {
  const result = loadGenerator(scripted([0xffffffff, 0, 0, 0xffffffff, 7, 1, 0])).generateSimplePassword()
  assert.equal(result.password, 'Albumamber007!')
  assert.deepEqual(Array.from(result.parts), ['Album', 'amber', '007', '!'])
})

test('cryptographic samples preserve two words, three digits and both layouts', () => {
  const generator = loadGenerator()
  const layouts = new Set()
  for (let i = 0; i < 10000; i++) layouts.add(checkSimple(generator.generateSimplePassword()))
  assert.equal(layouts.size, 2)
  assert.equal(typeof generator.generatePassword(), 'string')
})

test('advanced mode still covers all supported lengths and character classes', () => {
  const generator = loadGenerator()
  for (const requested of [1, 10, 16, 24, 100]) {
    const length = Math.min(24, Math.max(10, requested))
    for (let i = 0; i < 100; i++) {
      const password = generator.generateAdvancedPassword(requested)
      assert.equal(password.length, length)
      for (const pattern of [/[A-Z]/, /[a-z]/, /[0-9]/, /[!*?]/, /^[A-Za-z0-9!*?]+$/]) assert.match(password, pattern)
    }
  }
})
