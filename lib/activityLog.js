// Client-side helper for logging user activities.
// Failures are silent — logging should never break the main flow.

export async function logActivity({ event_type, target_table, target_id, details }) {
  try {
    await fetch('/api/activity-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type, target_table, target_id, details }),
    });
  } catch {
    // Silent fail
  }
}
