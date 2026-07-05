import { CheckCircle, WarningCircle } from "@phosphor-icons/react";

export default function StatusMessage({ message, tone = "error", id }) {
  if (!message) {
    return null;
  }

  const Icon = tone === "error" ? WarningCircle : CheckCircle;

  return (
    <div
      className={`status-message status-${tone}`}
      id={id}
      role={tone === "error" ? "alert" : "status"}
    >
      <Icon aria-hidden="true" size={20} weight="bold" />
      <span>{message}</span>
    </div>
  );
}
