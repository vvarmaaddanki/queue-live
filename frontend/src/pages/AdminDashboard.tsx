import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiRequest } from "../api/client";
import "./AdminDashboard.css";

const API_BASE_URL = `${(import.meta.env.VITE_API_BASE_URL || "https://queue-live-backend.onrender.com").replace(/\/$/, "")}/api`;

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

type QueueToken = {
  token_id: number;
  name: string;
  number: number;
  status: "waiting" | "serving" | "done" | "skipped" | "cancelled";
  started_at: string | null;
  finished_at: string | null;
};

type QueueTokensResponse = {
  queue_id: string;
  queue_name: string;
  tokens: QueueToken[];
};

type LoginResponse = {
  access: string;
  refresh: string;
};

type AdminDashboardProps = {
  onBack: () => void;
};

function AdminDashboard({ onBack }: AdminDashboardProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => Boolean(localStorage.getItem("access"))
  );

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [queues, setQueues] = useState<Queue[]>([]);
  const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null);
  const [tokens, setTokens] = useState<QueueToken[]>([]);
  const [queueName, setQueueName] = useState("");

  const [loadingQueues, setLoadingQueues] = useState(false);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Staff login: obtain and save JWT access and refresh tokens.
  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!username.trim() || !password) {
      setError("Enter your username and password.");
      return;
    }

    try {
      setLoginLoading(true);
      setError("");
      setNotice("");

      const response = await fetch(`${API_BASE_URL}/auth/login/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const data = (await response.json()) as
        | LoginResponse
        | { detail?: string; error?: string };

      if (!response.ok) {
        const message =
          "detail" in data
            ? data.detail
            : "error" in data
              ? data.error
              : undefined;

        throw new Error(message || "Login failed. Check your credentials.");
      }

      if (!("access" in data) || !data.access) {
        throw new Error("Login response did not include an access token.");
      }

      localStorage.setItem("access", data.access);

      if ("refresh" in data && data.refresh) {
        localStorage.setItem("refresh", data.refresh);
      }

      setPassword("");
      setIsAuthenticated(true);
      setNotice("Login successful.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to log in.");
    } finally {
      setLoginLoading(false);
    }
  };

  // Logout and remove saved tokens.
  const handleLogout = () => {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");

    setIsAuthenticated(false);
    setQueues([]);
    setTokens([]);
    setSelectedQueueId(null);
    setQueueName("");
    setUsername("");
    setPassword("");
    setError("");
    setNotice("");
  };

  // Load available queues after login.
  const loadQueues = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      setLoadingQueues(true);
      setError("");

      const response = await apiRequest<QueueResponse>("/queues/");
      const availableQueues = response.queues ?? [];

      setQueues(availableQueues);

      if (availableQueues.length > 0) {
        setSelectedQueueId((currentId) => {
          const currentExists = availableQueues.some(
            (queue) => queue.id === currentId
          );

          return currentExists ? currentId : availableQueues[0].id;
        });
      } else {
        setSelectedQueueId(null);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to load queues.";

      setError(message);

      if (
        message.includes("401") ||
        message.toLowerCase().includes("authentication credentials")
      ) {
        localStorage.removeItem("access");
        localStorage.removeItem("refresh");
        setIsAuthenticated(false);
      }
    } finally {
      setLoadingQueues(false);
    }
  }, [isAuthenticated]);

  // Load tokens for the selected queue.
  const loadTokens = useCallback(async (queueId: string) => {
    if (!localStorage.getItem("access")) {
      setIsAuthenticated(false);
      return;
    }

    try {
      setLoadingTokens(true);

      const response = await apiRequest<QueueTokensResponse>(
        `/tokens/queues/${queueId}/`
      );

      setTokens(response.tokens ?? []);
      setQueueName(response.queue_name ?? "Selected queue");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to load queue tokens.";

      setError(message);

      if (
        message.includes("401") ||
        message.toLowerCase().includes("authentication credentials")
      ) {
        localStorage.removeItem("access");
        localStorage.removeItem("refresh");
        setIsAuthenticated(false);
      }
    } finally {
      setLoadingTokens(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadQueues();
    }
  }, [isAuthenticated, loadQueues]);

  // Poll the selected queue every 5 seconds.
  useEffect(() => {
    if (!isAuthenticated || selectedQueueId === null) {
      setTokens([]);
      setQueueName("");
      return;
    }

    loadTokens(selectedQueueId);

    const intervalId = window.setInterval(() => {
      loadTokens(selectedQueueId);
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [isAuthenticated, selectedQueueId, loadTokens]);

  // Perform staff queue actions.
  const runAction = async (
    endpoint: string,
    successMessage: string
  ) => {
    if (selectedQueueId === null) return;

    if (!localStorage.getItem("access")) {
      setError("Your session has expired. Please log in again.");
      setIsAuthenticated(false);
      return;
    }

    try {
      setActionLoading(true);
      setError("");
      setNotice("");

      await apiRequest(endpoint, {
        method: "POST",
      });

      setNotice(successMessage);
      await loadTokens(selectedQueueId);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "The action could not be completed.";

      setError(message);

      if (
        message.includes("401") ||
        message.toLowerCase().includes("authentication credentials")
      ) {
        localStorage.removeItem("access");
        localStorage.removeItem("refresh");
        setIsAuthenticated(false);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const callNext = () => {
    if (selectedQueueId === null) return;

    runAction(
      `/tokens/queues/${selectedQueueId}/call-next/`,
      "Next customer has been called."
    );
  };

  const completeToken = (tokenId: number) => {
    runAction(
      `/tokens/${tokenId}/complete/`,
      "Token marked as completed."
    );
  };

  const skipToken = (tokenId: number) => {
    runAction(
      `/tokens/${tokenId}/skip/`,
      "Token has been skipped."
    );
  };

  const exportQueueCsv = async () => {
    if (!selectedQueueId) return;
    const accessToken = localStorage.getItem("access");
    if (!accessToken) {
      setError("Your session has expired. Please log in again.");
      setIsAuthenticated(false);
      return;
    }

    try {
      setExportLoading(true);
      setError("");
      const response = await fetch(
        `${API_BASE_URL}/tokens/queues/${selectedQueueId}/export/`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || data.detail || "Unable to export queue data.");
      }
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `queue-${selectedQueueId}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      setNotice("Queue CSV exported.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to export queue data.");
    } finally {
      setExportLoading(false);
    }
  };

  const selectedQueue = queues.find((queue) => queue.id === selectedQueueId);

  const toggleQueueStatus = async () => {
    if (!selectedQueue) return;
    try {
      setActionLoading(true);
      setError("");
      setNotice("");
      const nextStatus = !selectedQueue.is_open;
      await apiRequest(`/queues/${selectedQueue.id}/status/`, {
        method: "POST",
        body: JSON.stringify({ is_open: nextStatus }),
      });
      setNotice(nextStatus ? "Queue opened successfully." : "Queue closed successfully.");
      await loadQueues();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update queue status.");
    } finally {
      setActionLoading(false);
    }
  };

  const servingToken = tokens.find((token) => token.status === "serving");
  const waitingTokens = tokens.filter((token) => token.status === "waiting");
  const completedTokens = tokens.filter((token) => token.status === "done");
  const skippedTokens = tokens.filter((token) => token.status === "skipped");

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div className="admin-brand">
          <div className="admin-brand-icon">Q</div>
          <div>
            <h1>QueueLive</h1>
            <p>Staff Dashboard</p>
          </div>
        </div>

        {isAuthenticated ? (
          <button className="admin-back-button" onClick={handleLogout}>
            Log out
          </button>
        ) : (
          <button className="admin-back-button" onClick={onBack}>
            ← Back to Home
          </button>
        )}
      </header>

      {!isAuthenticated ? (
        <main className="admin-main">
          <section className="admin-login-card">
            <p className="admin-eyebrow">STAFF ACCESS</p>
            <h2>Staff Login</h2>
            <p>Log in with your Django staff account to manage the queue.</p>

            <form className="admin-login-form" onSubmit={handleLogin}>
              <div className="admin-form-field">
                <label htmlFor="staff-username">Username</label>
                <input
                  id="staff-username"
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="username"
                  required
                  disabled={loginLoading}
                  style={{
                    display: "block",
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "12px",
                    marginTop: "8px",
                  }}
                />
              </div>

              <div className="admin-form-field">
                <label htmlFor="staff-password">Password</label>
                <input
                  id="staff-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                  disabled={loginLoading}
                  style={{
                    display: "block",
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "12px",
                    marginTop: "8px",
                  }}
                />
              </div>

              {error && (
                <div
                  className="admin-alert admin-alert-error"
                  style={{ marginTop: "16px" }}
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="admin-primary-button"
                disabled={loginLoading}
                style={{ width: "100%", marginTop: "20px" }}
              >
                {loginLoading ? "Logging in..." : "Log in"}
              </button>
            </form>
          </section>
        </main>
      ) : (
        <main className="admin-main">
          <div className="admin-page-heading">
            <div>
              <p className="admin-eyebrow">QUEUE MANAGEMENT</p>
              <h2>Dashboard</h2>
              <p>Manage customers and control the queue.</p>
            </div>

            <button
              className="admin-refresh-button"
              onClick={() =>
                selectedQueueId !== null && loadTokens(selectedQueueId)
              }
              disabled={loadingTokens || selectedQueueId === null}
            >
              ↻ Refresh
            </button>

            {selectedQueue && (
              <button
                className="admin-refresh-button"
                onClick={toggleQueueStatus}
                disabled={actionLoading}
              >
                {selectedQueue.is_open ? "Close Queue" : "Open Queue"}
              </button>
            )}

            <button
              className="admin-refresh-button"
              onClick={exportQueueCsv}
              disabled={exportLoading || selectedQueueId === null}
            >
              {exportLoading ? "Exporting..." : "Export CSV"}
            </button>
          </div>

          <section className="admin-queue-selector">
            <label htmlFor="admin-queue-select">Select queue</label>

            <select
              id="admin-queue-select"
              value={selectedQueueId ?? ""}
              onChange={(event) =>
                setSelectedQueueId(event.target.value || null)
              }
              disabled={loadingQueues || queues.length === 0}
            >
              {queues.length === 0 && (
                <option value="">No queues available</option>
              )}

              {queues.map((queue) => (
                <option key={queue.id} value={queue.id}>
                  {queue.name} — {queue.place}
                </option>
              ))}
            </select>
          </section>

          {loadingQueues && (
            <div className="admin-message">Loading queues...</div>
          )}

          {error && (
            <div className="admin-alert admin-alert-error">{error}</div>
          )}

          {notice && (
            <div className="admin-alert admin-alert-success">{notice}</div>
          )}

          {!loadingQueues && queues.length === 0 && !error && (
            <div className="admin-message">
              No queues were found. Create a queue before using the dashboard.
            </div>
          )}

          {selectedQueueId !== null && (
            <>
              <section className="admin-stats-grid">
                <div className="admin-stat-card">
                  <span className="admin-stat-label">Waiting</span>
                  <strong>{waitingTokens.length}</strong>
                  <span className="admin-stat-note">Customers in line</span>
                </div>

                <div className="admin-stat-card admin-stat-serving">
                  <span className="admin-stat-label">Now Serving</span>
                  <strong>
                    {servingToken ? `#${servingToken.number}` : "—"}
                  </strong>
                  <span className="admin-stat-note">
                    {servingToken?.name ?? "No active customer"}
                  </span>
                </div>

                <div className="admin-stat-card">
                  <span className="admin-stat-label">Completed</span>
                  <strong>{completedTokens.length}</strong>
                  <span className="admin-stat-note">Finished tokens</span>
                </div>

                <div className="admin-stat-card">
                  <span className="admin-stat-label">Skipped</span>
                  <strong>{skippedTokens.length}</strong>
                  <span className="admin-stat-note">Skipped tokens</span>
                </div>
              </section>

              <section className="admin-current-card">
                <div>
                  <p className="admin-eyebrow">CURRENT QUEUE</p>
                  <h3>{queueName || "Selected queue"}</h3>

                  {servingToken ? (
                    <p>
                      Serving token <strong>#{servingToken.number}</strong> —{" "}
                      {servingToken.name}
                    </p>
                  ) : (
                    <p>No customer is being served right now.</p>
                  )}
                </div>

                <div className="admin-current-actions">
                  <button
                    className="admin-primary-button"
                    onClick={callNext}
                    disabled={actionLoading || waitingTokens.length === 0}
                  >
                    {actionLoading ? "Processing..." : "Call Next Customer"}
                  </button>

                  {servingToken && (
                    <button
                      className="admin-complete-button"
                      onClick={() => completeToken(servingToken.token_id)}
                      disabled={actionLoading}
                    >
                      Complete Current
                    </button>
                  )}
                </div>
              </section>

              <section className="admin-table-section">
                <div className="admin-table-heading">
                  <div>
                    <h3>Waiting Customers</h3>
                    <p>Customers waiting for their turn.</p>
                  </div>

                  <span className="admin-count-badge">
                    {waitingTokens.length} waiting
                  </span>
                </div>

                {loadingTokens ? (
                  <div className="admin-message">Loading tokens...</div>
                ) : waitingTokens.length === 0 ? (
                  <div className="admin-message">
                    No customers are currently waiting.
                  </div>
                ) : (
                  <div className="admin-table-wrapper">
                    <table className="admin-token-table">
                      <thead>
                        <tr>
                          <th>Token</th>
                          <th>Customer</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>

                      <tbody>
                        {waitingTokens.map((token) => (
                          <tr key={token.token_id}>
                            <td className="admin-token-number">
                              #{token.number}
                            </td>
                            <td>{token.name}</td>
                            <td>
                              <span className="admin-status waiting">
                                Waiting
                              </span>
                            </td>
                            <td>
                              <button
                                className="admin-skip-button"
                                onClick={() => skipToken(token.token_id)}
                                disabled={actionLoading}
                              >
                                Skip
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </main>
      )}
    </div>
  );
}

export default AdminDashboard;