const API_BASE_URL = "http://127.0.0.1:8000/api";

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const cleanEndpoint = endpoint.startsWith("/")
    ? endpoint
    : `/${endpoint}`;

  const accessToken = localStorage.getItem("access");

  const headers = new Headers(options.headers);

  const isFormData =
    typeof FormData !== "undefined" &&
    options.body instanceof FormData;

  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  } else {
    headers.delete("Authorization");
  }

  console.log(
    `[apiRequest] ${cleanEndpoint} | Token exists:`,
    Boolean(accessToken)
  );

  const response = await fetch(`${API_BASE_URL}${cleanEndpoint}`, {
    ...options,
    headers,
  });

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