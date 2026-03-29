"use client";

/**
 * Obtain a short-lived WebSocket ticket from the API.
 * Called from browser before establishing WebSocket connections.
 */

export async function getWsTicket(clerkToken: string): Promise<string> {
  const apiUrl = process.env.NEXT_PUBLIC_RADON_API_URL || "/api/ib";

  const res = await fetch(`${apiUrl}/ws-ticket`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${clerkToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to obtain WS ticket: ${res.status}`);
  }

  const data = await res.json();
  return data.ticket;
}
