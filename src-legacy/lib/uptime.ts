// Prosty licznik uptime od startu procesu Node. Dla App Hosting będzie resetowany przy każdym redeploy.
const serverStart = Date.now();

export function getUptimeMs() {
  return Date.now() - serverStart;
}

export function getUptimeHuman() {
  const ms = getUptimeMs();
  const hours = Math.floor(ms / 3_600_000);
  const days = Math.floor(hours / 24);
  return days > 0 ? `${days}d ${hours % 24}h` : `${hours}h`;
}