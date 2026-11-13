import { useEffect, useState } from "react";
import "./join.css";

type Queue = {
  id: string;
  public_id: string;
  name: string;
  place_name?: string;
  is_open?: boolean;
};

type JoinProps = {
  queues: Queue[];
  onBack: () => void;
};

type JoinedToken = {
  token_id: number;
  public_id: string;
  name: string;
  queue_id: string;
  service_date: string;
  number: number;
  status: string;
  queue_name: string;
  customers_ahead?: number;
  estimated_wait_minutes?: number;
};

type TokenStatusResponse = {
  token_id: number;
  name: string;
  queue_id: string;
  token_number: number;
  service_date: string;
  status: string;
  customers_ahead: number;
  estimated_wait_minutes: number;
  started_at?: string | null;
  finished_at?: string | null;
};

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "https://queue-live-backend.onrender.com"
).replace(/\/$/, "");

export default function Join({ queues, onBack }: JoinProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedQueue, setSelectedQueue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [token, setToken] = useState<JoinedToken | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!token) {
      return;
    }

    let isActive = true;
    let intervalId: number | undefined;
    let socket: WebSocket | undefined;

    const refreshTokenStatus = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/tokens/public/${token.public_id}/status/`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Status API error: ${response.status}`);
        }

        const data: TokenStatusResponse = await response.json();

        if (!isActive) {
          return;
        }

        setToken((currentToken) => {
          if (!currentToken) {
            return currentToken;
          }

          return {
            ...currentToken,
            status: data.status,
            customers_ahead: data.customers_ahead,
            estimated_wait_minutes: data.estimated_wait_minutes,
          };
        });
      } catch (err) {
        console.error("Unable to refresh token status:", err);
      }
    };

    const websocketUrl = API_BASE_URL.replace(/^http/, "ws");

    socket = new WebSocket(
      `${websocketUrl}/ws/queues/${token.queue_id}/`
    );

    socket.onmessage = () => {
      if (isActive) {
        refreshTokenStatus();
      }
    };

    socket.onerror = (event) => {
      console.error("Queue WebSocket error:", event);
    };

    refreshTokenStatus();

    intervalId = window.setInterval(refreshTokenStatus, 5000);

    return () => {
      isActive = false;

      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
      }

      socket?.close();
    };
  }, [token?.public_id, token?.queue_id]);

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setError("");
    setToken(null);

    const customerName = name.trim();

    if (!customerName) {
      setError("Please enter your name.");
      return;
    }

    if (!selectedQueue) {
      setError("Please select a queue.");
      return;
    }

    const queue = queues.find(
      (item) => item.public_id === selectedQueue
    );

    if (!queue) {
      setError("Selected queue was not found.");
      return;
    }

    if (queue.is_open === false) {
      setError("This queue is currently closed.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/tokens/generate/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            name: customerName,
            phone: phone.trim(),
            queue_id: queue.id,
          }),
        }
      );

      const responseText = await response.text();

      let responseData: any;

      try {
        responseData = JSON.parse(responseText);
      } catch {
        throw new Error(
          `Server returned HTML instead of JSON. Status: ${response.status}`
        );
      }

      if (!response.ok) {
        throw new Error(
          responseData.error ||
            responseData.detail ||
            `API error: ${response.status}`
        );
      }

      setToken({
        ...responseData,
        queue_name: queue.name,
      });
    } catch (err) {
      if (err instanceof TypeError) {
        setError(
          "Unable to connect to backend. Check whether Django is running."
        );
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "Something went wrong."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const cancelToken = async () => {
    if (!token || !window.confirm("Cancel your waiting token?")) return;
    setCancelling(true);
    setError("");
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/tokens/public/${token.public_id}/cancel/`,
        { method: "POST", headers: { Accept: "application/json" } }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to cancel token.");
      setToken((current) => current ? { ...current, status: data.status } : current);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to cancel token.");
    } finally {
      setCancelling(false);
    }
  };

  const resetForm = () => {
    setToken(null);
    setName("");
    setPhone("");
    setSelectedQueue("");
    setError("");
  };

  const getStatusLabel = (status: string) => {
    switch (status.toLowerCase()) {
      case "waiting":
        return "Waiting";
      case "serving":
        return "Now Serving";
      case "done":
        return "Completed";
      case "skipped":
        return "Skipped";
      case "cancelled":
        return "Cancelled";
      default:
        return status;
    }
  };

  return (
    <div className="join-container">
      <button
        type="button"
        onClick={onBack}
        className="back-button"
      >
        ← Back to Dashboard
      </button>

      <div className="join-card">
        <h1>Join Queue</h1>

        <p className="form-description">
          Enter your details to receive your queue number.
        </p>

        {token ? (
          <div className="success-container">
            <h2>Successfully Joined!</h2>

            <p>Hello, {token.name}</p>

            <h1>Your Queue Number: {token.number}</h1>

            <p>Queue: {token.queue_name}</p>
            <p>Queue ID: {token.queue_id}</p>
            <p>Service Date: {token.service_date}</p>

            <p>
              Status:{" "}
              <strong>{getStatusLabel(token.status)}</strong>
            </p>

            {token.status.toLowerCase() === "waiting" && (
              <>
                <p>
                  People Ahead:{" "}
                  <strong>
                    {token.customers_ahead ?? "Updating..."}
                  </strong>
                </p>

                <p>
                  Estimated Wait:{" "}
                  <strong>
                    {token.estimated_wait_minutes !== undefined
                      ? `${token.estimated_wait_minutes} minutes`
                      : "Updating..."}
                  </strong>
                </p>
              </>
            )}

            {token.status.toLowerCase() === "serving" && (
              <p>
                It is your turn. Please proceed to the service desk.
              </p>
            )}

            {token.status.toLowerCase() === "done" && (
              <p>Your service is completed. Thank you!</p>
            )}

            {token.status.toLowerCase() === "skipped" && (
              <p>Your token has been skipped. Please contact staff.</p>
            )}

            {token.status.toLowerCase() === "cancelled" && (
              <p>Your token has been cancelled.</p>
            )}

            <p className="form-description">
              Your status updates automatically every 5 seconds.
            </p>

            {token.status.toLowerCase() === "waiting" && (\n              <button type="button" onClick={cancelToken} disabled={cancelling}>\n                {cancelling ? "Cancelling..." : "Cancel Token"}\n              </button>\n            )}\n            {error && <p className="error-message">{error}</p>}\n\n            <button type="button" onClick={resetForm}>
              Join Another Queue
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="customer-name">Customer Name</label>

              <input
                id="customer-name"
                type="text"
                placeholder="Enter your full name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="customer-phone">Mobile Number</label>

              <input
                id="customer-phone"
                type="tel"
                placeholder="Enter your mobile number"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="queue-select">Select Queue</label>

              <select
                id="queue-select"
                value={selectedQueue}
                onChange={(event) =>
                  setSelectedQueue(event.target.value)
                }
                required
              >
                <option value="">Select a Queue</option>

                {queues.map((queue) => (
                  <option
                    key={queue.id}
                    value={queue.public_id}
                    disabled={queue.is_open === false}
                  >
                    {queue.name}
                    {queue.place_name
                      ? ` - ${queue.place_name}`
                      : ""}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <p className="error-message">{error}</p>
            )}

            <button type="submit" disabled={loading}>
              {loading ? "Joining Queue..." : "Join Queue"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}