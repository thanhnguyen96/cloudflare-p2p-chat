import type { ChangeEvent, FormEvent, RefObject } from "react";

interface ComposerProps {
  isConnected: boolean;
  isImmersiveMode: boolean;
  isSendingFile: boolean;
  messageInput: string;
  localDisplayName: string;
  fileInputRef: RefObject<HTMLInputElement>;
  onMessageInputChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onPickFile: () => void;
  onFileInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onDisconnect: () => void;
}

export function Composer({
  isConnected,
  isImmersiveMode,
  isSendingFile,
  messageInput,
  localDisplayName,
  fileInputRef,
  onMessageInputChange,
  onSubmit,
  onPickFile,
  onFileInputChange,
  onDisconnect,
}: ComposerProps) {
  return (
    <form className="chat-app__composer composer" onSubmit={onSubmit}>
      <input
        className="composer__input"
        value={messageInput}
        onChange={(event) => onMessageInputChange(event.target.value)}
        placeholder={
          isConnected
            ? `Message as ${localDisplayName}...`
            : "Connect to a room before sending messages"
        }
        disabled={!isConnected}
        maxLength={1024}
      />
      <div className="composer__actions">
        <button
          type="button"
          className="button button--ghost composer__button"
          onClick={onPickFile}
          disabled={!isConnected || isSendingFile}
        >
          {isSendingFile ? "Sending file..." : "Send file"}
        </button>
        <button
          type="submit"
          className="button button--accent composer__button"
          disabled={!isConnected || messageInput.trim().length === 0}
        >
          Send
        </button>
        {isImmersiveMode && (
          <button
            type="button"
            className="button button--danger composer__button"
            onClick={onDisconnect}
          >
            Disconnect
          </button>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        className="composer__file-input"
        onChange={onFileInputChange}
        disabled={!isConnected || isSendingFile}
      />
    </form>
  );
}


