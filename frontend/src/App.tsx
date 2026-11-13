import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiRequest } from "./api/client";
import Join from "./pages/join";
import AdminDashboard from "./pages/AdminDashboard";
import TokenStatus from "./pages/TokenStatus";
import "./App.css";

type Queue = {
  id: string;
  public_id: string;
  name: string;
  place: string;
  is_open: boolean;
  default_minutes: number;
};

type QueueResponse = {
  queues: Queue[];
};

function App() {
  const [queues, setQueues] = useState<Queue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const selectedQueueId = location.pathname.startsWith("/join/")
    ? decodeURIComponent(location.pathname.slice("/join/".length))
    : "";

  const loadQueues = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await apiRequest<QueueResponse>("/queues/");
      setQueues(response.queues ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load queues. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueues();
  }, []);

  const openJoinPage = (queue: Queue) => {
    navigate(`/join/${encodeURIComponent(queue.public_id)}`);
  };

  const openHomePage = () => navigate("/");

  if (location.pathname.startsWith("/token/")) {
    return <TokenStatus />;
  }

  if (location.pathname === "/staff") {
    return <AdminDashboard onBack={openHomePage} />;
  }

  if (selectedQueueId) {
    if (loading) return <div className="loading-message">Loading queue...</div>;
    const selectedQueue = queues.find((queue) => queue.public_id === selectedQueueId);
    if (!selectedQueue) {
      return (
        <div className="empty-message">
          Queue not found or no longer available.
          <button type="button" onClick={openHomePage}>Return to home</button>
        </div>
      );
    }
    return <Join queues={[selectedQueue]} onBack={openHomePage} />;
  }

  return (
    <div className="app">
      <nav className="navbar">
        <div
          className="nav-logo"
          onClick={openHomePage}
          role="button"
          tabIndex={0}
        >
          <span className="logo-icon">Q</span>
          <span>QueueLive</span>
        </div>

        <div className="nav-links">
          <a href="#home">Home</a>
          <a href="#queues">Queues</a>
          <a href="#how-it-works">How It Works</a>

          <button
            type="button"
            className="nav-admin-button"
            onClick={() => navigate("/staff")}
          >
            Staff Dashboard
          </button>
        </div>
      </nav>

      <main>
        <section className="hero" id="home">
          <div className="hero-content">
            <p className="hero-label">SMART QUEUE MANAGEMENT</p>

            <h1>
              Skip the line.
              <br />
              <span>Save your time.</span>
            </h1>

            <p className="hero-description">
              Join a queue online, track your token in real time, and spend
              less time waiting.
            </p>

            <a href="#queues" className="hero-button">
              Explore Queues
            </a>
          </div>

          <div className="hero-visual">
            <div className="hero-card">
              <div className="hero-card-header">
                <span className="status-dot"></span>
                <span>Live Queue Status</span>
              </div>

              <div className="hero-token">
                <p>Your Token</p>
                <h2>#024</h2>
                <span className="token-status">Waiting</span>
              </div>

              <div className="hero-card-footer">
                <div>
                  <strong>3</strong>
                  <span>People ahead</span>
                </div>

                <div>
                  <strong>12 min</strong>
                  <span>Estimated wait</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="queue-section" id="queues">
          <div className="section-heading">
            <div>
              <p className="section-label">AVAILABLE NOW</p>
              <h2>Choose a queue</h2>
              <p>Join a queue and track your waiting time.</p>
            </div>
          </div>

          {loading && (
            <div className="loading-message">
              Loading available queues...
            </div>
          )}

          {error && (
            <div className="error-message">
              <p>{error}</p>

              <button type="button" onClick={loadQueues}>
                Try Again
              </button>
            </div>
          )}

          {!loading && !error && queues.length === 0 && (
            <div className="empty-message">
              No queues are currently available.
            </div>
          )}

          {!loading && !error && queues.length > 0 && (
            <div className="queue-grid">
              {queues.map((queue) => (
                <article className="queue-card" key={queue.id}>
                  <div className="queue-card-top">
                    <div className="queue-icon">⌛</div>

                    <span
                      className={
                        queue.is_open
                          ? "queue-status open"
                          : "queue-status closed"
                      }
                    >
                      {queue.is_open ? "Open" : "Closed"}
                    </span>
                  </div>

                  <h3>{queue.name}</h3>
                  <p className="queue-place">{queue.place}</p>

                  <div className="queue-details">
                    <div>
                      <span>Service time</span>
                      <strong>{queue.default_minutes} min/person</strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="join-queue-button"
                    disabled={!queue.is_open}
                    onClick={() => openJoinPage(queue)}
                  >
                    {queue.is_open ? "Join Queue" : "Queue Closed"}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="how-section" id="how-it-works">
          <div className="section-heading">
            <p className="section-label">SIMPLE AND FAST</p>
            <h2>How QueueLive works</h2>
          </div>

          <div className="steps-grid">
            <div className="step-card">
              <span className="step-number">01</span>
              <h3>Choose a service</h3>
              <p>Select the queue you need from the available services.</p>
            </div>

            <div className="step-card">
              <span className="step-number">02</span>
              <h3>Get your token</h3>
              <p>Join online and receive your unique queue token.</p>
            </div>

            <div className="step-card">
              <span className="step-number">03</span>
              <h3>Track your turn</h3>
              <p>Check your token status and estimated waiting time.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-logo">QueueLive</div>

        <p>Smart queue management. Less waiting, more living.</p>

        <span>© {new Date().getFullYear()} QueueLive</span>
      </footer>
    </div>
  );
}

export default App;