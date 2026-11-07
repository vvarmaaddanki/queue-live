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

const API_BASE_URL = "https://queue-live-backend.onrender.com"

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
    let interval: ReturnType<typeof setInterval> | null = null;

    const fetchStatus = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/tokens/${tokenId}/status/`
        );

        if (!response.ok) {
          throw new Error("Unable to load token status.");
        }

        const data: TokenStatusData = await response.json();

        if (isActive) {
          setToken(data);
          setError("");
        }

        return data;
      } catch {
        if (isActive) {
          setError(
            "Could not connect to the server. Check that Django is running."
          );
        }

        return null;
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    const connectWebSocket = (queueId: number) => {
      if (!isActive) return;

      socket = new WebSocket(
        `ws://queue-live-backend.onrender.com/ws/queues/${queueId}/`
      );

      socket.onopen = () => {
        if (isActive) {
          setLiveConnected(true);
        }
      };

      socket.onmessage = (event) => {
        if (!isActive) return;

        try {
          const update = JSON.parse(event.data);

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
        if (isActive) {
          setLiveConnected(false);
        }
      };

      socket.onerror = () => {
        if (isActive) {
          setLiveConnected(false);
        }
      };
    };

    const initialize = async () => {
      const data = await fetchStatus();

      if (!isActive || !data) return;

      connectWebSocket(data.queue_id);

      // Polling remains as a fallback if WebSocket is unavailable.
      interval = setInterval(fetchStatus, 5000);
    };

    initialize();

    return () => {
      isActive = false;

      if (interval) {
        clearInterval(interval);
      }

      if (socket) {
        socket.close();
      }
    };
  }, [tokenId]);

  if (loading) {
    return (
      <main className="token-status-page">
        <section className="token-status-card loading-card">
          <div className="loading-spinner" />
          <h2>Loading your token</h2>
          <p>Please wait while we get your queue status.</p>
        </section>
      </main>
    );
  }

  if (error || !token) {
    return (
      <main className="token-status-page">
        <section className="token-status-card error-card">
          <div className="status-icon error-icon">!</div>
          <p className="status-label">QUEUE LIVE</p>
          <h1>Token status unavailable</h1>
          <p className="error-message">{error || "Token not found."}</p>
          <Link to="/" className="home-link">
            Return to home
          </Link>
        </section>
      </main>
    );
  }

  const status = token.status.toLowerCase();
  const statusLabel = token.status.replaceAll("_", " ");

  return (
    <main className="token-status-page">
      <section className="token-status-card">
        <div className="status-card-top">
          <div className="brand-mark">Q</div>

          <div className="brand-copy">
            <span className="status-label">QUEUE LIVE</span>
            <p>Live queue tracking</p>
          </div>

          <div
            className={`connection-indicator ${
              liveConnected ? "connected" : "polling"
            }`}
          >
            <span className="connection-dot" />
            {liveConnected ? "Live" : "Auto"}
          </div>
        </div>

        <div className="token-intro">
          <div className="success-icon">
            <span>✓</span>
          </div>

          <h1>Your queue status</h1>
          <p>Stay updated while you wait for your turn.</p>
        </div>

        <div className="token-number">
          <span className="token-number-label">YOUR TOKEN NUMBER</span>
          <strong>#{String(token.token_number).padStart(3, "0")}</strong>

          <div className={`status-badge ${status}`}>
            <span className="status-dot" />
            {statusLabel}
          </div>
        </div>

        <div className="customer-greeting">
          <span className="greeting-label">Welcome</span>
          <h2>{token.name}</h2>
        </div>

        {status === "waiting" && (
          <div className="wait-metrics">
            <div className="wait-metric">
              <span className="metric-icon">👥</span>
              <strong>{token.customers_ahead}</strong>
              <span>People ahead</span>
            </div>

            <div className="metric-divider" />

            <div className="wait-metric">
              <span className="metric-icon">◷</span>
              <strong>{token.estimated_wait_minutes}</strong>
              <span>Estimated minutes</span>
            </div>
          </div>
        )}

        {status === "serving" && (
          <div className="status-message serving-message">
            <strong>It’s your turn!</strong>
            <p>Please proceed to the service counter.</p>
          </div>
        )}

        {status === "done" && (
          <div className="status-message done-message">
            <strong>Service completed</strong>
            <p>Your queue service is complete. Thank you.</p>
          </div>
        )}

        {status === "skipped" && (
          <div className="status-message skipped-message">
            <strong>Your token was skipped</strong>
            <p>Please contact the staff for assistance.</p>
          </div>
        )}

        {status === "cancelled" && (
          <div className="status-message skipped-message">
            <strong>Token cancelled</strong>
            <p>This queue token is no longer active.</p>
          </div>
        )}

        <div className="live-update-note">
          <span className="live-note-dot" />
          {liveConnected
            ? "Connected to live queue updates"
            : "Status refreshes automatically"}
        </div>

        <Link to="/" className="home-link">
          <span>←</span> Return to home
        </Link>
      </section>

      <p className="page-footer">
        QueueLive · Smart queue management
      </p>
    </main>
  );
}