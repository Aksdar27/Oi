export async function apiFetch(endpoint: string, options?: RequestInit) {
  try {
    const res = await fetch(`/api${endpoint}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("API Fetch Error", err);
    return { success: false, message: "Network Error", data: null };
  }
}
