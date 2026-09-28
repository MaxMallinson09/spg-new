// Child-friendly, neutral words only: food, colors, nature, and everyday
// objects/places. No scary, violent, offensive, or awkward-to-dictate words.
//
// Animal names are deliberately excluded. They used to make up a large slice
// of the list ('Pig', 'Koala', 'Bunny' and 26 others) and were removed on
// request, so do not reintroduce them when topping the list up — reach for
// food, nature or object words instead.
//
// Words are chosen to survive being read aloud over the phone. Avoid exact
// homophones ('ball'/'bawl', 'bean'/'been', 'ice'/'eyes'), silent letters,
// unusual spellings, and words close enough to profanity to become awkward on
// a poor line ('beach', 'ship'). Simple to hear and write beats clever.
//
// Keep the list professionally neutral as well: avoid human descriptors,
// slang/innuendo, terms with obvious social or political baggage, and words
// that can sound childish or patronising when dictated to another person.
//
// The list is kept to words that read the same either side of the Atlantic.
// American-only terms ('candy', 'truck', 'corn', 'taco', 'bagel', 'wagon',
// 'cabin') were removed: a word the reader would never use themselves is a
// word they hesitate over when dictating it.
//
// Keep every word to 3-5 characters. Two words, four digits and a symbol
// then fit 11-15 characters without rejecting or truncating any combination.
const WORDS = [
  'Album', 'Amber', 'Apple', 'Audio', 'Badge', 'Bench', 'Bike', 'Boat',
  'Book', 'Boot', 'Brick', 'Brush', 'Bus', 'Cable', 'Card',
  'Cave', 'Chair', 'Cloud', 'Coin', 'Cube',
  'Desk', 'Door', 'Dust', 'Earth',
  'Fan', 'Farm', 'Field', 'Film', 'Flag', 'Fruit',
  'Game', 'Gift', 'Glass', 'Glove', 'Gold', 'Green', 'Hat',
  'Hill', 'Home', 'Honey', 'House', 'Jet', 'Kit',
  'Lake', 'Land', 'Lava', 'Leaf', 'Lemon', 'Log',
  'Mango', 'Map', 'Moon', 'Motor', 'Note', 'Ocean',
  'Onion', 'Paint', 'Paper', 'Park', 'Pasta', 'Pen',
  'Piano', 'Pink', 'Pizza', 'Plant', 'Plate', 'Pond',
  'Rice', 'River', 'Robot', 'Rock', 'Room',
  'Sand', 'Shelf', 'Sink', 'Slide', 'Snow', 'Soup',
  'Star', 'Sugar', 'Table', 'Tent', 'Tile', 'Toast',
  'Town', 'Train', 'Tree', 'Video', 'Watch', 'Wire',
  'Zone',
]

// Symbols that are unambiguous when spoken aloud. '$', '%', '&' and '#' were
// dropped because 'dollar sign' / 'percent' / 'ampersand' / 'hash' get
// misheard or mis-typed more often than they are worth ('#' also goes by
// pound, number sign and hashtag, so listeners disagree on what was said).
// '@' is deliberately excluded so generated passwords never contain it.
// Advanced mode deliberately reuses this same set rather than widening it.
const SPECIAL_CHARS = ['!', '*', '?']

// Advanced mode: the user picks the length, so these only bound the slider.
// 'I' / 'l' / '1' / 'O' / '0' are kept in: advanced passwords are meant to be
// copied and pasted rather than dictated, and dropping them would cost
// entropy for a readability benefit this mode is not aiming at.
const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz'.split('')
const DIGITS = '0123456789'.split('')
const ADVANCED_ALPHABET = [...UPPERCASE, ...LOWERCASE, ...DIGITS, ...SPECIAL_CHARS]

export const ADVANCED_MIN_LENGTH = 10
export const ADVANCED_MAX_LENGTH = 24
export const ADVANCED_DEFAULT_LENGTH = 16

const UINT32_RANGE = 0x100000000

/**
 * Uniform random integer in [0, maxExclusive) taken from the platform CSPRNG.
 *
 * Math.random() is not usable here: V8 implements it as xorshift128+, and its
 * internal state can be recovered from a handful of observed outputs. Since a
 * single page session hands out many passwords, that would let anyone who saw
 * one of them derive the others.
 */
function randomInt(maxExclusive: number): number {
  // Discard the short tail of the uint32 range that does not divide evenly,
  // otherwise the modulo below would favour the lowest values.
  const limit = Math.floor(UINT32_RANGE / maxExclusive) * maxExclusive
  const buffer = new Uint32Array(1)
  let value = 0
  do {
    crypto.getRandomValues(buffer)
    value = buffer[0]
  } while (value >= limit)
  return value % maxExclusive
}

function randomItem<T>(list: T[]): T {
  return list[randomInt(list.length)]
}

export type GeneratedPassword = {
  password: string
  parts?: string[]
}

/** Two distinct words, four random digits in either position, then a symbol. */
export function generateSimplePassword(): GeneratedPassword {
  const firstIndex = randomInt(WORDS.length)
  // Draw uniformly from the remaining words without a retry loop.
  const secondDraw = randomInt(WORDS.length - 1)
  const secondIndex = secondDraw >= firstIndex ? secondDraw + 1 : secondDraw
  const firstWord = WORDS[firstIndex]
  const secondWord = WORDS[secondIndex].toLowerCase()
  // Leading zeros count: all 10,000 four-digit strings are equally likely.
  const number = String(randomInt(10000)).padStart(4, '0')
  const numberBetweenWords = randomInt(2) === 0
  const parts = numberBetweenWords
    ? [firstWord, number, secondWord, randomItem(SPECIAL_CHARS)]
    : [firstWord, secondWord, number, randomItem(SPECIAL_CHARS)]

  // Preserve the true word boundaries for visual gaps, including when the
  // words are adjacent. The clipboard receives only the joined string.
  return { password: parts.join(''), parts }
}

export function generatePassword(): string {
  return generateSimplePassword().password
}

/**
 * Advanced mode: `length` characters drawn from the full alphabet, with one
 * character of each class seeded up front so the result always satisfies the
 * "needs an uppercase/number/symbol" rules sites impose.
 *
 * Seeding then shuffling matters. Placing the guaranteed characters at fixed
 * positions would tell an attacker where the symbol is; the Fisher-Yates pass
 * below (also CSPRNG-driven) leaves every arrangement equally likely.
 */
export function generateAdvancedPassword(length: number): string {
  const size = Math.min(
    ADVANCED_MAX_LENGTH,
    Math.max(ADVANCED_MIN_LENGTH, Math.floor(length)),
  )

  const chars = [
    randomItem(UPPERCASE),
    randomItem(LOWERCASE),
    randomItem(DIGITS),
    randomItem(SPECIAL_CHARS),
  ]
  while (chars.length < size) {
    chars.push(randomItem(ADVANCED_ALPHABET))
  }

  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }

  return chars.join('')
}

