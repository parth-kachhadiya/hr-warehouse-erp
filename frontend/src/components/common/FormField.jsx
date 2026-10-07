// A label with its input underneath. Pass the input as children.
export default function FormField({ label, required, hint, children, wide }) {
  return (
    <label className={`field ${wide ? 'field-wide' : ''}`}>
      <span>{label}{required ? ' *' : ''}</span>
      {children}
      {hint && <small className="hint">{hint}</small>}
    </label>
  );
}
