
export async function ask(question, plantCandidates = []) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question,
      plant_candidates: plantCandidates
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Request failed (${res.status})`);
  }

  return res.json();
}

export async function classifyPlant(imageBlob) {
  const formData = new FormData();
  formData.append('file', imageBlob, 'plant.jpg');

  const res = await fetch('/api/classify', {
    method: 'POST',
    body: formData
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Classification failed (${res.status})`);
  }

  return res.json();
}
