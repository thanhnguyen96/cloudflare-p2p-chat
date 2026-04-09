interface StatusPanelProps {
  statusLabel: string;
  statusDotClassName: string;
  activeRoom: string;
}

export function StatusPanel({
  statusLabel,
  statusDotClassName,
  activeRoom,
}: StatusPanelProps) {
  return (
    <section className="chat-app__status status-panel">
      <div className="status-panel__left">
        <span className={statusDotClassName} aria-hidden="true" />
        <span className="status-panel__label">{statusLabel}</span>
      </div>
      <p className="status-panel__room">
        {activeRoom ? `Room: ${activeRoom}` : "Room: not connected"}
      </p>
    </section>
  );
}
