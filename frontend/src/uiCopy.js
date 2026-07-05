export function friendlyError(error, fallback = "That move did not land. Try once more.") {
  if (!error) {
    return fallback;
  }
  if (error.code === "network_error") {
    return "The internet wandered off. Check your connection, then deal again.";
  }
  if (error.code === "request_timeout" || error.status === 408) {
    return "The server is thinking very, very hard. Give it another go.";
  }
  if (error.status === 429) {
    return "Easy, card shark. Too many moves at once—wait a beat and try again.";
  }
  if (error.status >= 500) {
    return "The server dropped its cards. Nothing is lost; try again in a moment.";
  }
  if (error.status === 409) {
    return "The room moved first. Refresh your hand and try that move again.";
  }
  return error.message || fallback;
}
