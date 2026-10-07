// Replaces the old browser prompt() and confirm() popups.
//
//   const modal = useModal();
//   if (await modal.confirm('Archive this product?')) { ... }
//   const reason = await modal.prompt('Reason for cancelling?');          // null if cancelled
//   const values = await modal.form({ title, fields: [{ name, label, type, defaultValue, options }] });
//
// <Modal open title onClose> ... </Modal> is also available for custom content.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const ModalContext = createContext(null);

export default function Modal({ open, title, onClose, children, wide = false }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

function FormDialog({ dialog, close }) {
  const initial = Object.fromEntries((dialog.fields || []).map((f) => [f.name, f.defaultValue ?? '']));
  const [values, setValues] = useState(initial);
  const [error, setError] = useState('');
  const set = (name, value) => setValues((v) => ({ ...v, [name]: value }));

  const submit = (e) => {
    e.preventDefault();
    const missing = dialog.fields.find((f) => f.required !== false && f.type !== 'checkbox' && String(values[f.name] ?? '').trim() === '');
    if (missing) {
      setError(`${missing.label || 'Value'} is required`);
      return;
    }
    close(values);
  };

  return (
    <form onSubmit={submit}>
      {dialog.message && <p className="modal-message">{dialog.message}</p>}
      {dialog.fields.map((f, i) => (
        <label className="field" key={f.name}>
          {f.label && <span>{f.label}{f.required !== false && f.type !== 'checkbox' ? ' *' : ''}</span>}
          {f.type === 'select' ? (
            <select value={values[f.name]} onChange={(e) => set(f.name, e.target.value)} autoFocus={i === 0}>
              {f.options.map((o) => {
                const opt = typeof o === 'string' ? { value: o, label: o } : o;
                return <option key={opt.value} value={opt.value}>{opt.label}</option>;
              })}
            </select>
          ) : f.type === 'textarea' ? (
            <textarea value={values[f.name]} onChange={(e) => set(f.name, e.target.value)} rows={3} autoFocus={i === 0} />
          ) : (
            <input
              type={f.type || 'text'}
              value={values[f.name]}
              min={f.min}
              max={f.max}
              step={f.step ?? (f.type === 'number' ? 'any' : undefined)}
              onChange={(e) => set(f.name, e.target.value)}
              autoFocus={i === 0}
            />
          )}
          {f.hint && <small className="hint">{f.hint}</small>}
        </label>
      ))}
      {error && <div className="message message-error">{error}</div>}
      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={() => close(null)}>Cancel</button>
        <button type="submit" className={`btn ${dialog.danger ? 'btn-danger' : 'btn-primary'}`}>{dialog.confirmText || 'OK'}</button>
      </div>
    </form>
  );
}

export function ModalProvider({ children }) {
  const [dialog, setDialog] = useState(null);

  const open = useCallback((options) => new Promise((resolve) => setDialog({ ...options, resolve })), []);

  const api = useMemo(() => ({
    confirm: (message, opts = {}) =>
      open({ kind: 'confirm', title: opts.title || 'Please confirm', message, confirmText: opts.confirmText || 'Yes', danger: opts.danger }),
    prompt: (message, opts = {}) =>
      open({
        kind: 'form',
        title: opts.title || 'Enter a value',
        message,
        confirmText: opts.confirmText,
        danger: opts.danger,
        fields: [{ name: 'value', label: opts.label || '', type: opts.type || 'text', defaultValue: opts.defaultValue ?? '', min: opts.min, max: opts.max, step: opts.step }],
      }).then((r) => (r ? r.value : null)),
    form: (opts) => open({ kind: 'form', ...opts }),
  }), [open]);

  const close = (result) => {
    dialog.resolve(result);
    setDialog(null);
  };

  return (
    <ModalContext.Provider value={api}>
      {children}
      {dialog && (
        <Modal open title={dialog.title} onClose={() => close(dialog.kind === 'confirm' ? false : null)}>
          {dialog.kind === 'confirm' ? (
            <>
              <p className="modal-message">{dialog.message}</p>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => close(false)}>Cancel</button>
                <button type="button" className={`btn ${dialog.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => close(true)} autoFocus>
                  {dialog.confirmText}
                </button>
              </div>
            </>
          ) : (
            <FormDialog dialog={dialog} close={close} />
          )}
        </Modal>
      )}
    </ModalContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useModal() {
  return useContext(ModalContext);
}
