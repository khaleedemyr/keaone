const ROW1 = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']
const ROW2 = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P']
const ROW3 = ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L']
const ROW4 = ['Z', 'X', 'C', 'V', 'B', 'N', 'M', '-']

export function VirtualKeyboard({
  onKey,
  onBackspace,
  onClear,
  onEnter,
  enterLabel = 'Enter',
}: {
  onKey: (key: string) => void
  onBackspace: () => void
  onClear: () => void
  onEnter?: () => void
  enterLabel?: string
}) {
  return (
    <div className="pos-vkb" onMouseDown={(event) => event.preventDefault()}>
      {[ROW1, ROW2, ROW3, ROW4].map((row) => (
        <div key={row[0]} className="pos-vkb-row">
          {row.map((key) => (
            <button key={key} type="button" className="pos-vkb-key" onClick={() => onKey(key)}>
              {key}
            </button>
          ))}
        </div>
      ))}
      <div className="pos-vkb-row">
        <button type="button" className="pos-vkb-key pos-vkb-key--wide" onClick={onClear}>
          C
        </button>
        <button type="button" className="pos-vkb-key pos-vkb-key--wide" onClick={onBackspace}>
          ⌫
        </button>
        {onEnter ? (
          <button type="button" className="pos-vkb-key pos-vkb-key--enter" onClick={onEnter}>
            {enterLabel}
          </button>
        ) : null}
      </div>
    </div>
  )
}
