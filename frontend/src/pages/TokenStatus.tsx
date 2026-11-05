
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import "./TokenStatus.css";

type TokenStatusData = {
  token_id: number;
  name: string;
  queue_id: number;
  token_number: number;
  status: string;
  customers_ahead: number;
  estimated_wait_minutes: number;
};

export default function TokenStatus() {
  const { tokenId } = useParams<{ tokenId: string }>();

  const [token, setToken] = useState<TokenStatusData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [liveConnected, setLiveConnected] = useState(false);

  useEffect(() => {
    if (!tokenId) {
      setError("Token ID is missing.");
      setLoading(false);
      return;
    }

    let isActive = true;
    let socket: WebSocket | null = null;

    const fetchStatus = async () => {
      try {
        const response = await fetch(
          `http://127.0.0.1:8000/api/tokens/${tokenId}/status/`
        );

        if (!response.ok) {
          throw new Error("Unable to load token status.");
        }

        const data: TokenStatusData = await response.json();

        if (isActive) {
          setToken(data);
          setError("");
        }
      } catch {
        if (isActive) {
          setError(
            "Could not connect to the server. Check that Django is running."
          );
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    // Load the latest status when the page opens.
    fetchStatus();

    // Connect to live updates for this token's queue.
    const connectWebSocket = () => {
      if (!isActive) return;

      socket = new WebSocket(
        `ws://127.0.0.1:8000/ws/queues/${token?.queue_id ?? ""}/`
      );

      socket.onopen = () => {
        if (isActive) setLiveConnected(true);
      };

      socket.onmessage = (event) => {
        if (!isActive) return;

        try {
          const update = JSON.parse(event.data);

          // Refresh status after a queue event.
          if (
            update.event === "token_called" ||
            update.event === "token_completed" ||
            update.event === "token_skipped"
          ) {
            fetchStatus();
          }
        } catch {
          // Ignore invalid WebSocket messages.
        }
      };

      socket.onclose = () => {
        if (isActive) setLiveConnected(false);
      };

      socket.onerror = () => {
        if (isActive) setLiveConnected(false);
      };
    };

    // Polling is retained as a fallback.
    const interval = setInterval(fetchStatus, 5000);

    // Wait until the initial API response gives us the queue ID.
    fetch(
      `http://127.0.0.1:8000/api/tokens/${tokenId}/status/`
    )
      .then((response) => {
        if (!response.ok) {
          throw new Error("Unable to load token status.");
        }
        return response.json();
      })
      .then((data: TokenStatusData) => {
        if (isActive) {
          setToken(data);

          if (socket) {
            socket.close();
          }

          connectWebSocket();
        }
      })
      .catch(() => {
        // The first fetch already handles the visible error.
      });

    return () => {
      isActive = false;
      clearInterval(interval);

      if (socket) {
        socket.close();
      }
    };
  }, [tokenId]);

  if (loading) {
    return <main className="token-status-page">Loading token status...</main>;
  }

  if (error || !token) {
    return (
      <main className="token-status-page">
        <h2>Token status unavailable</h2>
        <p>{error || "Token not found."}</p>
        <Link to="/">Return to home</Link>
      </main>
    );
  }

  const status = token.status.toLowerCase();

  return (
    <main className="token-status-page">
      <section className="token-status-card">
        <p className="status-label">QUEUE LIVE</p>
        <h1>Your Queue Status</h1>

        <div className="token-number">
          <span>Your Token Number</span>
          <strong>{token.token_number}</strong>
        </div>

        <h2>Hello, {token.name}</h2>

        <div className={`status-badge ${status}`}>
          {token.status.replaceAll("_", " ")}
        </div>

        {status === "waiting" && (
          <div className="wait-info">
            <p>
              <strong>{token.customers_ahead}</strong> customers ahead of you
            </p>
            <p>
              Estimated wait:{" "}
              <strong>{token.estimated_wait_minutes} minutes</strong>
            </p>
          </div>
        )}

        {status === "serving" && (
          <p className="status-message">
            It is your turn. Please go to the counter.
          </p>
        )}

        {status === "done" && (
          <p className="status-message">Your service is complete.</p>
        )}

        {status === "skipped" && (
          <p className="status-message">
            Your token was skipped. Contact the staff.
          </p>
        )}

        <p className="refresh-message">
          {liveConnected
            ? "Live updates connected."
            : "Checking for updates automatically."}
        </p>

        <Link to="/" className="home-link">
          Return to home
        </Link>
      </section>
    </main>
  );
}
