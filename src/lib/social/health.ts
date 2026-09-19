export function connectionNotice(state: string) {
  const messages: Record<string, string> = {
    "link-added":
      "Campaign link added. Review and approve the updated text before publishing.",
    "link-failed":
      "The campaign link could not be added. Refresh the draft and try again.",
    "slack-connected":
      "Slack delivery connected. Select Slack in your daily draft preferences to use it.",
    "slack-disconnected": "Slack delivery disconnected.",
    "delivery-failed": "Delivery connection failed. Check setup and try again.",
    checked:
      "Profile access verified. This does not verify publishing or analytics permissions.",
    reconnect:
      "Reconnect your account in Team. The network authorization expired or was revoked.",
    busy: "Your connection is renewing. Wait a moment, then try again.",
    setup: "Complete provider setup and join the program before connecting.",
    permissions:
      "The network denied this action. Ask your company admin to check the app’s API access and permissions.",
    rate_limit:
      "The network or app request limit was reached. Wait before trying again.",
    unavailable:
      "The network could not be reached or verified. Try checking the connection again later.",
    "connection-unavailable":
      "Connection status could not be loaded. Try again later.",
  };
  return messages[state] || "Review the team update below.";
}
export function connectionLabel(state: string) {
  const labels: Record<string, string> = {
    connected: "Connected",
    reconnect: "Reconnect required",
    renewing: "Renewal pending",
    permissions: "Access needs attention",
    rate_limit: "Temporarily limited",
    unavailable: "Check failed",
  };
  return labels[state] || "Status unavailable";
}
