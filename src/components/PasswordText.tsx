/** Presentation only: never insert spaces or change the password's characters. */
export default function PasswordText({
  password,
  advanced,
}: {
  password: string | null
  advanced: boolean
}) {
  // Keep each simple-mode word with the number/symbol that follows it. These
  // inline chunks can wrap between words, but never halfway through a word.
  // Nested parts give words, digits and the symbol CSS-only spacing. Keeping
  // the text nodes adjacent ensures those gaps are not password characters.
  // Advanced passwords stay a continuous string and may wrap at any character.
  const chunks = !advanced && password
    ? password.match(/[A-Za-z]+[^A-Za-z]*/g)
    : null
  const canGroup = chunks !== null && chunks.join('') === password

  return (
    <code
      className={`pw-display__text ${advanced ? 'pw-display__text--dense' : ''}`}
      aria-hidden={password === null || undefined}
    >
      {canGroup
        ? chunks.map((chunk, index) => (
            <span className="pw-display__word" key={index}>
              {chunk.match(/[A-Za-z]+|[^A-Za-z]/g)?.map((part, partIndex) => (
                <span className="pw-display__part" key={partIndex}>{part}</span>
              ))}
            </span>
          ))
        : password ?? '·········'}
    </code>
  )
}
