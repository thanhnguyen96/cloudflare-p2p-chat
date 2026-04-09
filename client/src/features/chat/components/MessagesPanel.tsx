import type { RefObject } from "react";
import type { ChatMessage } from "../types";
import { formatFileSize } from "../utils";

interface MessagesPanelProps {
  messages: ChatMessage[];
  viewportRef: RefObject<HTMLDivElement>;
}

export function MessagesPanel({ messages, viewportRef }: MessagesPanelProps) {
  return (
    <section className="chat-app__messages messages" ref={viewportRef}>
      {messages.length === 0 && (
        <p className="messages__empty">No chat messages yet.</p>
      )}
      {messages.map((message) => (
        <article
          key={message.id}
          className={`chat-message chat-message--${message.type}`}
        >
          <p className="chat-message__sender">{message.sender}</p>
          <p className="chat-message__text">{message.text}</p>
          {message.attachment && (
            <div className="chat-message__file">
              <a
                className="chat-message__file-link"
                href={message.attachment.fileUrl}
                download={message.attachment.fileName}
              >
                {message.attachment.fileName}
              </a>
              <p className="chat-message__file-meta">
                {formatFileSize(message.attachment.fileSize)}
              </p>
            </div>
          )}
          <time className="chat-message__time">{message.createdAt}</time>
        </article>
      ))}
    </section>
  );
}


