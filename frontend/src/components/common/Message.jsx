// Green (success) or red (error) banner with a close button.
export default function Message({ message, onClose }) {
  if (!message) return null;
  return (
    <div className={`message message-${message.type}`} role={message.type === 'error' ? 'alert' : 'status'}>
      <span>{message.text}</span>
      {onClose && <button type="button" className="icon-btn" onClick={onClose} aria-label="Dismiss">×</button>}
    </div>
  );
}
