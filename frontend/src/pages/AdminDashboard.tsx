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
  role?: string | null;
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
  const [showRegister, setShowRegister] = useState(false);
  const [registerUsername, setRegisterUsername] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [placeName, setPlaceName] = useState("");
  const [placeKind, setPlaceKind] = useState("clinic");
  const [registerLoading, setRegisterLoading] = useState(false);
  const [newQueueName, setNewQueueName] = useState("");
  const [newQueueMinutes, setNewQueueMinutes] = useState("10");
  const [createQueueLoading, setCreateQueueLoading] = useState(false);

  const [queues, setQueues] = useState<Queue[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
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

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    try {
      setRegisterLoading(true);
      const response = await fetch(`${API_BASE_URL}/auth/register/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          username: registerUsername.trim(),
          email: registerEmail.trim(),
          password: registerPassword,
          place_name: placeName.trim(),
          place_kind: placeKind,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.detail || "Registration failed.");
      setUsername(registerUsername.trim());
      setPassword("");
      setRegisterPassword("");
      setShowRegister(false);
      setNotice("Business owner account created. Log in with your new username and password.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create owner account.");
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleCreateQueue = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    try {
      setCreateQueueLoading(true);
      await apiRequest("/queues/create/", {
        method: "POST",
        body: JSON.stringify({
          name: newQueueName.trim(),
          default_minutes: Number(newQueueMinutes),
        }),
      });
      setNewQueueName("");
      setNewQueueMinutes("10");
      setNotice("Queue created successfully.");
      await loadQueues();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create queue.");
    } finally {
      setCreateQueueLoading(false);
    }
  };

  // Logout and remove saved tokens.
  const handleLogout = () => {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");

    setIsAuthenticated(false);
    setQueues([]);
    setUserRole(null);
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
      setUserRole(response.role ?? null);

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
            <p className="admin-eyebrow">BUSINESS ACCESS</p>
            <h2>{showRegister ? "Register Your Business" : "Staff Login"}</h2>
            <p>{showRegister
              ? "Create your owner account and business workspace."
              : "Log in with your business owner or staff account."}</p>

            {showRegister ? (
              <form className="admin-login-form" onSubmit={handleRegister}>
                <div className="admin-form-field">
                  <label htmlFor="owner-username">Username</label>
                  <input id="owner-username" value={registerUsername} onChange={(event) => setRegisterUsername(event.target.value)} autoComplete="username" required maxLength={150} />
                </div>
                <div className="admin-form-field">
                  <label htmlFor="owner-email">Email (optional)</label>
                  <input id="owner-email" type="email" value={registerEmail} onChange={(event) => setRegisterEmail(event.target.value)} autoComplete="email" />
                </div>
                <div className="admin-form-field">
                  <label htmlFor="business-name">Business name</label>
                  <input id="business-name" value={placeName} onChange={(event) => setPlaceName(event.target.value)} required maxLength={120} />
                </div>
                <div className="admin-form-field">
                  <label htmlFor="business-type">Business type</label>
                  <select id="business-type" value={placeKind} onChange={(event) => setPlaceKind(event.target.value)}>
                    <option value="clinic">Clinic</option>
                    <option value="salon">Salon</option>
                    <option value="tuition">Tuition centre</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="admin-form-field">
                  <label htmlFor="owner-password">Password</label>
                  <input id="owner-password" type="password" value={registerPassword} onChange={(event) => setRegisterPassword(event.target.value)} autoComplete="new-password" required minLength={8} />
                </div>
                {error && <div className="admin-alert admin-alert-error">{error}</div>}
                <button type="submit" className="admin-primary-button" disabled={registerLoading} style={{ width: "100%", marginTop: "16px" }}>
                  {registerLoading ? "Creating account..." : "Create Owner Account"}
                </button>
                <button type="button" className="admin-refresh-button" onClick={() => { setShowRegister(false); setError(""); }} style={{ width: "100%", marginTop: "10px" }}>
                  Back to login
                </button>
              </form>
            ) : (
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
              <button type="button" className="admin-refresh-button" onClick={() => { setShowRegister(true); setError(""); }} style={{ width: "100%", marginTop: "10px" }}>
                Register a Business
              </button>
            </form>
            )}
            {notice && <div className="admin-alert admin-alert-success">{notice}</div>}
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

          {(userRole === "owner" || userRole === "superuser") && (
          <section className="admin-queue-selector">
            <form onSubmit={handleCreateQueue} className="admin-login-form">
              <label htmlFor="new-queue-name">Create a queue</label>
              <input id="new-queue-name" value={newQueueName} onChange={(event) => setNewQueueName(event.target.value)} placeholder="e.g. General Consultation" required maxLength={80} />
              <label htmlFor="new-queue-minutes">Average service time (minutes)</label>
              <input id="new-queue-minutes" type="number" min="1" max="120" step="1" value={newQueueMinutes} onChange={(event) => setNewQueueMinutes(event.target.value)} required />
              <button type="submit" className="admin-primary-button" disabled={createQueueLoading}>
                {createQueueLoading ? "Creating..." : "Create Queue"}
              </button>
            </form>
          </section>
          )}

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

          {selectedQueue?.is_open && (
            <section className="admin-qr-card">
              <div>
                <p className="admin-eyebrow">CUSTOMER QUICK JOIN</p>
                <h3>Share this queue QR code</h3>
                <p>Customers can scan this code with their phone camera to open the queue join page.</p>
                <a
                  className="admin-qr-link"
                  href={`${(import.meta.env.VITE_APP_URL || "https://queue-live-frontend.onrender.com").replace(/\/$/, "")}/join/${selectedQueue.public_id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open customer join page
                </a>
              </div>
              <img
                className="admin-qr-image"
                src={`${API_BASE_URL}/queues/public/${selectedQueue.public_id}/qr/`}
                alt={`QR code to join ${selectedQueue.name}`}
                loading="lazy"
              />
            </section>
          )}

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