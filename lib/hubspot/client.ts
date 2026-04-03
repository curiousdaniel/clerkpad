const HUBSPOT_API_BASE = "https://api.hubapi.com";

export class HubSpotRequestError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown, message?: string) {
    super(message ?? `HubSpot API error ${status}`);
    this.name = "HubSpotRequestError";
    this.status = status;
    this.body = body;
  }
}

export async function hubspotRequest<T>(
  token: string,
  path: string,
  init?: { method?: string; body?: unknown }
): Promise<T> {
  const res = await fetch(`${HUBSPOT_API_BASE}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = { raw: text };
    }
  }

  if (!res.ok) {
    throw new HubSpotRequestError(res.status, parsed);
  }

  return parsed as T;
}
