const API_BASE_URL = `${(import.meta.env.VITE_API_BASE_URL || "https://queue-live-backend.onrender.com").replace(/\/$/, "")}/api`;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem("refresh");
  if (!refreshToken) return null;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as { access?: string };
    if (!data.access) return null;

    localStorage.setItem("access", data.access);
    return data.access;
  } catch {
    return null;
  }
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const cleanEndpoint = endpoint.startsWith("/")
    ? endpoint
    : `/${endpoint}`;

  const headers = new Headers(options.headers);
  const isFormData =
    typeof FormData !== "undefined" &&
    options.body instanceof FormData;

  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const sendRequest = (accessToken: string | null) => {
    const requestHeaders = new Headers(headers);
    if (accessToken) {
      requestHeaders.set("Authorization", `Bearer ${accessToken}`);
    } else {
      requestHeaders.delete("Authorization");
    }

    return fetch(`${API_BASE_URL}${cleanEndpoint}`, {
      ...options,
      headers: requestHeaders,
    });
  };

  let accessToken = localStorage.getItem("access");
  let response = await sendRequest(accessToken);

  // Retry once with a fresh access token when the current JWT has expired.
  if (response.status === 401 && localStorage.getItem("refresh")) {
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken) {
      accessToken = refreshedToken;
      response = await sendRequest(accessToken);
    }
  }

  const contentType = response.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    const responseText = await response.text();
    throw new Error(
      `Non-JSON response. Status: ${response.status}. URL: ${response.url}. ${responseText}`
    );
  }

  const data = await response.json();

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem("access");
      localStorage.removeItem("refresh");
    }

    throw new Error(
      data.error ||
        data.detail ||
        `API error: ${response.status}`
    );
  }

  return data as T;
}
