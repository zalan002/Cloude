export async function reportError({ page, action, error }) {
  try {
    await fetch('/api/report-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page, action, error }),
    });
  } catch {
    // Ne akadjon el az app ha a hibajelentés sem megy
  }
}
