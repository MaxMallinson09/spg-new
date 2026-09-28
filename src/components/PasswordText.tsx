/** Presentation only: never insert spaces or change the password's characters. */
export default function PasswordText({
  password,
  advanced,
  parts,
}: {
  password: string | null
  advanced: boolean
  parts?: readonly string[]
}) {
  // Keep each simple-mode word with the number/symbol that follows it. These
  // inline chunks can wrap between words, but never halfway through a word.
  // Nested parts give words, digits and the symbol CSS-only spacing. Keeping
  // the text nodes adjacent ensures those gaps are not password characters.
  // Advanced passwords stay a continuous string and may wrap at any character.
  // Supplied parts preserve adjacent word boundaries when the number is last.
  // Validate them so stale or mismatched metadata can never change the text.
  const chunks = !advanced && password
    ? parts?.length && parts.join('') === password
      ? parts
      : password.match(/[A-Za-z]+[^A-Za-z]*/g)
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
              {chunk.match(/[A-Za-z]+|[0-9]+|[^A-Za-z0-9]/g)?.map((part, partIndex) => (
                <span className="pw-display__part" key={partIndex}>{part}</span>
              ))}
            </span>
          ))
        : password ?? '·········'}
    </code>
  )
}
