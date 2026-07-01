const FRACTION_RE = /(\d+)\/(\d+)/g

export function renderQuestion(text) {
  if (!FRACTION_RE.test(text)) return text
  FRACTION_RE.lastIndex = 0

  const parts = []
  let lastIndex = 0
  let match

  while ((match = FRACTION_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    parts.push(
      <span key={match.index} className="inline-flex flex-col items-center mx-1 align-middle leading-none">
        <span className="border-b border-current px-0.5">{match[1]}</span>
        <span className="px-0.5">{match[2]}</span>
      </span>
    )
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts
}
