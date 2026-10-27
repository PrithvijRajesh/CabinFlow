import { useUndo } from '../context/useUndo'
import Icon from './Icon'

// "Removed 14C · Undo", or a plain confirmation, with a bar that runs out.
export default function UndoToast() {
  const { toast, undo } = useUndo()
  if (!toast) return null
  return (
    <div className="undo-toast" role="status" aria-live="polite" key={toast.id}>
      {!toast.undoable && <Icon name="check" size={20} className="undo-check" />}
      <span className="undo-text">{toast.message}</span>
      {toast.undoable && <button className="undo-btn" onClick={undo}>Undo</button>}
      <span className="undo-bar" style={{ animationDuration: `${toast.seconds}s` }} aria-hidden />
    </div>
  )
}
