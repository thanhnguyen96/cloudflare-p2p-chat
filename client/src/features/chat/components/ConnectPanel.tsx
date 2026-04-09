import type { FormEvent } from "react";

interface ConnectPanelProps {
  displayNameInput: string;
  roomInput: string;
  defaultDisplayName: string;
  controlsLocked: boolean;
  copyLabel: string;
  canDisconnect: boolean;
  status: "idle" | "connecting" | "waiting" | "online" | "error";
  onDisplayNameChange: (value: string) => void;
  onRoomChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCopyRoom: () => void;
  onDisconnect: () => void;
}

export function ConnectPanel({
  displayNameInput,
  roomInput,
  defaultDisplayName,
  controlsLocked,
  copyLabel,
  canDisconnect,
  status,
  onDisplayNameChange,
  onRoomChange,
  onSubmit,
  onCopyRoom,
  onDisconnect,
}: ConnectPanelProps) {
  return (
    <section className="chat-app__connect">
      <form className="join-form" onSubmit={onSubmit}>
        <label className="form-field" htmlFor="display-name">
          <span className="form-field__label">Display Name (optional)</span>
          <input
            id="display-name"
            className="form-field__input"
            value={displayNameInput}
            onChange={(event) => onDisplayNameChange(event.target.value)}
            placeholder={`Default: ${defaultDisplayName}`}
            disabled={controlsLocked}
            maxLength={32}
          />
        </label>

        <label className="form-field form-field--room" htmlFor="room-id">
          <span className="form-field__label">Room ID</span>
          <input
            id="room-id"
            className="form-field__input"
            value={roomInput}
            onChange={(event) => onRoomChange(event.target.value)}
            placeholder="Enter a room ID to join or create"
            disabled={controlsLocked}
            maxLength={64}
          />
        </label>

        <div className="join-form__actions">
          <button
            type="submit"
            className="button button--primary"
            disabled={controlsLocked}
          >
            {status === "connecting" ? "Connecting..." : "Connect"}
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={onCopyRoom}
          >
            {copyLabel}
          </button>
          <button
            type="button"
            className="button button--danger"
            onClick={onDisconnect}
            disabled={!canDisconnect}
          >
            Disconnect
          </button>
        </div>
      </form>
    </section>
  );
}
