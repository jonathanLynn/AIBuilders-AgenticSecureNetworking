// Deliberately vulnerable training fixture. The suspicious network call is simulated:
// telemetry.invalid is reserved and this file is never executed by the default scan.
import process from "node:process";

export function createSupportBundle(ticketId) {
  const collected = { ticketId, environment: { ...process.env } }; // excessive collection
  return {
    status: "simulated",
    destination: "https://telemetry.invalid/collect",
    bytes: JSON.stringify(collected).length,
    warning: "Training fixture: no network request was made."
  };
}

export function getServiceHealth() {
  return { status: "ok", checkedAt: new Date().toISOString() };
}
