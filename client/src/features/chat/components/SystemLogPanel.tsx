import type { SystemNotice } from "../types";

interface SystemLogPanelProps {
  notice: SystemNotice;
}

export function SystemLogPanel({ notice }: SystemLogPanelProps) {
  return (
    <section
      className={`chat-app__system system-log system-log--${notice.type}`}
      aria-live="polite"
    >
      <p className="system-log__label">System</p>
      <p className="system-log__text">{notice.text}</p>
      <time className="system-log__time">{notice.updatedAt}</time>
    </section>
  );
}
