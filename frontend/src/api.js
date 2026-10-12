// Keep whatever base URL your existing api.js uses; this is a placeholder.
const API_BASE =
  import.meta.env.VITE_API_BASE ?? `http://${window.location.hostname}:8000`;

// Every request takes an optional AbortSignal. Aborting closes the connection,
// which the backend detects and uses to stop generating.

export async function classifyPlant(file, signal) {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${API_BASE}/api/classify`, {
    method: "POST",
    body: form,
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Server error ${res.status}`);
  }
  return res.json(); // { predictions: [{ species, score }, ...], device, warning }
}

export async function ask(question, plantCandidates = [], signal) {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, plant_candidates: plantCandidates }),
    signal,
  });

  if (!res.ok) throw new Error(`Server error ${res.status}`);
  return res.json();
}
