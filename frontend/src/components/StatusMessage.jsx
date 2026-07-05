export default function StatusMessage({ message, tone = "error", id }) {
  if (!message) {
    return null;
  }

  return (
    <div
      className={`status-message status-${tone}`}
      id={id}
      role={tone === "error" ? "alert" : "status"}
    >
      {message}
    </div>
  );
}
