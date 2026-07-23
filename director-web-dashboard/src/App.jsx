import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import './App.css';

// Change this to your computer's IPv4 address so it also works from a phone
// on the same Wi-Fi (e.g. 'http://192.168.163.5:4000').
const API_URL = 'http://localhost:4000';

function App() {
  const [token, setToken] = useState(null);
  const [directorName, setDirectorName] = useState('');
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState('');

  const fetchDashboard = useCallback(async (authToken) => {
    try {
      const res = await fetch(`${API_URL}/api/director/dashboard`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to load dashboard.');
        return;
      }
      setDashboard(data);
      setError('');
    } catch (err) {
      setError('Could not reach the server. Is the backend running?');
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    fetchDashboard(token);

    const socket = io(API_URL);
    socket.on('new_submission', () => fetchDashboard(token));

    const interval = setInterval(() => fetchDashboard(token), 30000);

    return () => {
      socket.disconnect();
      clearInterval(interval);
    };
  }, [token, fetchDashboard]);

  function handleLogout() {
    setToken(null);
    setDashboard(null);
  }

  if (!token) {
    return (
      <LoginScreen
        onLogin={(t, name) => {
          setToken(t);
          setDirectorName(name);
        }}
      />
    );
  }

  return (
    <Dashboard
      directorName={directorName}
      dashboard={dashboard}
      error={error}
      token={token}
      onRefresh={() => fetchDashboard(token)}
      onLogout={handleLogout}
    />
  );
}

function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('director@testschool.com');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed.');
        return;
      }
      if (data.user.role !== 'director') {
        setError('This portal is for the Director account only.');
        return;
      }
      onLogin(data.token, data.user.name);
    } catch (err) {
      setError('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-eyebrow">School Management</div>
        <h1>Director Portal</h1>
        <p className="login-sub">Sign in to view today's school-wide activity.</p>

        <label>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />

        <label>Password</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" />

        {error && <div className="error-banner">{error}</div>}

        <button type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}

function Dashboard({ directorName, dashboard, error, token, onRefresh, onLogout }) {
  if (error) {
    return (
      <div className="state-screen">
        <p>{error}</p>
        <button onClick={onRefresh}>Retry</button>
      </div>
    );
  }

  if (!dashboard) {
    return <div className="state-screen">Loading today's data…</div>;
  }

  const { attendance, revenue, live_feed, trend_last_14_days, current_rates } = dashboard;

  const chartData = trend_last_14_days.map((d) => ({
    date: new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    total: Number(d.total),
  }));

  async function handleReset(classId) {
    if (!window.confirm('Reset today\'s report for this class? The teacher will be able to submit again.')) {
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/director/reports/${classId}/today`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Reset failed.');
        return;
      }
      onRefresh();
    } catch (err) {
      alert('Could not reach the server.');
    }
  }

  return (
    <div className="dashboard">
      <header className="topbar">
        <div>
          <div className="eyebrow">School Management</div>
          <h1>Director Overview</h1>
        </div>
        <div className="topbar-right">
          <span>{directorName}</span>
          <button className="ghost-btn" onClick={onLogout}>Log Out</button>
        </div>
      </header>

      <section className="cards">
        <Card label="Attendance Today" value={`${attendance.attendance_percent}%`}
              sub={`${attendance.total_present} present · ${attendance.total_absent} absent`} />
        <Card label="Revenue Collected Today" value={`GHS ${Number(revenue.total_revenue).toFixed(2)}`}
              sub="Tuition + Canteen + Bus" accent />
        <Card label="Canteen Fees" value={`GHS ${Number(revenue.canteen_fees).toFixed(2)}`} />
        <Card label="Bus Fares" value={`GHS ${Number(revenue.bus_fares).toFixed(2)}`} />
      </section>

      <section className="grid-2">
        <div className="panel">
          <h2>Trends — Last 14 Days</h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e3e0d8" />
              <XAxis dataKey="date" stroke="#8a8578" fontSize={12} />
              <YAxis stroke="#8a8578" fontSize={12} />
              <Tooltip formatter={(v) => `GHS ${v.toFixed(2)}`} />
              <Line type="monotone" dataKey="total" stroke="#C9971F" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <RateEditor token={token} currentRates={current_rates} onSaved={onRefresh} />
      </section>

      <section className="panel">
        <h2>Live Submission Feed — Today</h2>
        {live_feed.length === 0 ? (
          <p className="empty-note">No submissions yet today.</p>
        ) : (
          <table className="feed-table">
            <thead>
              <tr>
                <th>Class</th>
                <th>Teacher</th>
                <th>Present</th>
                <th>Absent</th>
                <th>Total (GHS)</th>
                <th>Submitted</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {live_feed.map((row) => (
                <tr key={row.log_id} className={row.is_anomaly ? 'anomaly-row' : ''}>
                  <td>{row.class_name}</td>
                  <td>{row.teacher_name || '—'}</td>
                  <td>{row.present_count}</td>
                  <td>{row.absent_count}</td>
                  <td>{Number(row.total_calculated).toFixed(2)}</td>
                  <td>{new Date(row.submitted_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td>
                    <button className="reset-btn" onClick={() => handleReset(row.class_id)}>Reset</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {live_feed.some((r) => r.is_anomaly) && (
          <div className="anomaly-legend">
            <span className="dot" /> Flagged rows show fees below the expected rate for students present.
          </div>
        )}
        {live_feed.filter((r) => r.is_anomaly).map((r) => (
          <div key={r.log_id} className="anomaly-detail">
            <strong>{r.class_name}:</strong> {r.anomaly_reasons.join(' ')}
          </div>
        ))}
      </section>
    </div>
  );
}

function Card({ label, value, sub, accent }) {
  return (
    <div className={`card ${accent ? 'card-accent' : ''}`}>
      <div className="card-label">{label}</div>
      <div className="card-value">{value}</div>
      {sub && <div className="card-sub">{sub}</div>}
    </div>
  );
}

function RateEditor({ token, currentRates, onSaved }) {
  const [canteen, setCanteen] = useState(currentRates.canteen_rate_per_student);
  const [bus, setBus] = useState(currentRates.bus_rate_per_student);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    setCanteen(currentRates.canteen_rate_per_student);
    setBus(currentRates.bus_rate_per_student);
  }, [currentRates]);

  async function handleSave() {
    setSaving(true);
    setSavedMsg('');
    try {
      const res = await fetch(`${API_URL}/api/director/rates`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          canteen_rate_per_student: parseFloat(canteen),
          bus_rate_per_student: parseFloat(bus),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSavedMsg(data.error || 'Failed to save.');
        return;
      }
      setSavedMsg('Rates updated.');
      onSaved();
    } catch (err) {
      setSavedMsg('Could not reach the server.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel">
      <h2>Expected Fee Rates</h2>
      <p className="rate-note">These stay in effect until you change them again.</p>

      <label>Canteen rate per student (GHS)</label>
      <input type="number" step="0.01" value={canteen} onChange={(e) => setCanteen(e.target.value)} />

      <label>Bus rate per student (GHS)</label>
      <input type="number" step="0.01" value={bus} onChange={(e) => setBus(e.target.value)} />

      <button onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : 'Save Rates'}
      </button>
      {savedMsg && <div className="rate-saved">{savedMsg}</div>}
    </div>
  );
}

export default App;