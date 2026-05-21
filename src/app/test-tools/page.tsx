'use client';
// src/app/test-tools/page.tsx
import { useState } from 'react';
import Nav from '@/components/Nav';

type LogEntry = { time: string; type: 'info' | 'success' | 'error' | 'warn'; message: string };

let webhookCallCount = 0;

export default function TestToolsPage() {
  const [log, setLog] = useState<LogEntry[]>([]);
  const [loadingWebhook, setLoadingWebhook] = useState(false);
  const [loadingBulk, setLoadingBulk] = useState(false);

  const addLog = (type: LogEntry['type'], message: string) => {
    const entry = { time: new Date().toLocaleTimeString(), type, message };
    setLog(prev => [entry, ...prev].slice(0, 100));
  };

  // ── Webhook: reset quota ──
  const triggerWebhook = async () => {
    setLoadingWebhook(true);
    webhookCallCount++;
    const callNum = webhookCallCount;
    // First call uses a fresh key; subsequent calls reuse the SAME key
    // to demonstrate idempotency. Reset by navigating away and back.
    const idempotencyKey = sessionStorage.getItem('webhook_key') || (() => {
      const key = `quota-reset-${Date.now()}`;
      sessionStorage.setItem('webhook_key', key);
      return key;
    })();

    addLog('info', `→ POST /api/webhook  [call #${callNum}]  Idempotency-Key: ${idempotencyKey}`);

    try {
      const res = await fetch('/api/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
      });
      const data = await res.json();

      if (data.alreadyProcessed) {
        addLog('warn', `✓ Idempotent — already processed at ${new Date(data.processedAt).toLocaleTimeString()}. Quota NOT reset again.`);
      } else {
        addLog('success', `✓ Webhook processed — all provider quotas reset to 10.`);
      }
    } catch (e) {
      addLog('error', `✗ Webhook error: ${e}`);
    } finally {
      setLoadingWebhook(false);
    }
  };

  // ── Reset the idempotency key so next webhook call is a fresh one ──
  const resetWebhookKey = () => {
    sessionStorage.removeItem('webhook_key');
    webhookCallCount = 0;
    addLog('info', '⟳ Webhook idempotency key cleared — next call will be treated as new.');
  };

  // ── Generate 10 leads concurrently ──
  const generateBulkLeads = async () => {
    setLoadingBulk(true);
    addLog('info', '→ Generating 10 leads simultaneously (concurrency test)…');

    try {
      const res = await fetch('/api/test-tools/bulk-leads', { method: 'POST' });
      const data = await res.json();

      addLog(
        data.summary.failed > 0 ? 'warn' : 'success',
        `Bulk result: ${data.summary.succeeded} succeeded, ${data.summary.failed} failed out of ${data.summary.total}.`
      );

      for (const r of data.results) {
        if (r.status === 200 || r.status === 201) {
          addLog('success', `  ✓ ${r.name} (${r.phone}) → Service ${r.serviceId} — Lead #${r.data?.leadId}`);
        } else {
          addLog('error', `  ✗ ${r.name} (${r.phone}) → ${r.data?.error || r.error || 'failed'}`);
        }
      }
    } catch (e) {
      addLog('error', `✗ Bulk error: ${e}`);
    } finally {
      setLoadingBulk(false);
    }
  };

  // ── Test duplicate detection ──
  const testDuplicate = async () => {
    const phone = `88888${Date.now().toString().slice(-5)}`;
    addLog('info', `→ Testing duplicate detection with phone ${phone}…`);

    const base = { name: 'Test User', phone, city: 'TestCity', serviceId: 1, description: 'Duplicate test' };

    const r1 = await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(base) });
    const d1 = await r1.json();
    addLog(r1.ok ? 'success' : 'error', `  First submission → ${r1.status}: ${r1.ok ? `Lead #${d1.leadId}` : d1.error}`);

    const r2 = await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(base) });
    const d2 = await r2.json();
    addLog(r2.status === 409 ? 'success' : 'error', `  Duplicate submission → ${r2.status}: ${d2.error || 'unexpectedly accepted!'} ${r2.status === 409 ? '(correctly rejected)' : ''}`);
  };

  const clearLog = () => setLog([]);

  return (
    <>
      <Nav />
      <div className="page">
        <h1 className="page-title">Test Tools</h1>
        <p className="page-subtitle">
          Simulate webhook events, test idempotency, and stress-test concurrency.
          These tools are isolated from the customer-facing UI.
        </p>

        <div className="alert alert-warning" style={{ marginBottom: '2rem' }}>
          <strong>⚠ Engineering panel only.</strong> Quota resets must ONLY happen via webhook — not via the customer form.
        </div>

        <div className="grid-2" style={{ marginBottom: '2rem' }}>
          {/* Webhook panel */}
          <div className="card">
            <div className="card-header">
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem' }}>Webhook — Quota Reset</h2>
              <span className="badge badge-yellow">Idempotent</span>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
              Simulates a payment gateway confirming provider subscription renewal.
              Click multiple times with the same key to verify idempotency — only the first call resets quotas.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                className="btn btn-success"
                onClick={triggerWebhook}
                disabled={loadingWebhook}
              >
                {loadingWebhook ? <><span className="spinner" style={{ borderColor: 'rgba(74,222,128,0.3)', borderTopColor: 'var(--success)' }} /> Calling…</> : '↻ Call Webhook'}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={resetWebhookKey}>
                New Idempotency Key
              </button>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.75rem' }}>
              Same idempotency key = safe to retry. Key resets on "New Key" button.
            </p>
          </div>

          {/* Bulk leads panel */}
          <div className="card">
            <div className="card-header">
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem' }}>Bulk Lead Generator</h2>
              <span className="badge badge-blue">Concurrency</span>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
              Fires 10 lead submissions simultaneously across all 3 services.
              Tests the advisory lock and serializable transaction logic under load.
            </p>
            <button
              className="btn btn-primary"
              onClick={generateBulkLeads}
              disabled={loadingBulk}
            >
              {loadingBulk ? <><span className="spinner" /> Generating…</> : '⚡ Generate 10 Leads'}
            </button>
          </div>
        </div>

        {/* Duplicate test */}
        <div className="card" style={{ marginBottom: '2rem' }}>
          <div className="card-header">
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem' }}>Duplicate Detection Test</h2>
            <span className="badge badge-red">Constraint</span>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
            Submits the same phone + service twice. First should succeed; second should be rejected with 409.
          </p>
          <button className="btn btn-danger" onClick={testDuplicate}>
            Test Duplicate Submission
          </button>
        </div>

        {/* Log panel */}
        <div className="card">
          <div className="card-header">
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem' }}>Activity Log</h2>
            <button className="btn btn-secondary btn-sm" onClick={clearLog}>Clear</button>
          </div>

          {log.length === 0 ? (
            <p style={{ fontSize: '0.875rem', color: 'var(--text-dim)', textAlign: 'center', padding: '2rem 0' }}>
              Run a test above to see logs here.
            </p>
          ) : (
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {log.map((entry, i) => (
                <div
                  key={i}
                  style={{
                    padding: '0.5rem 0',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    gap: '0.75rem',
                    alignItems: 'flex-start',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.8125rem',
                  }}
                >
                  <span style={{ color: 'var(--text-dim)', flexShrink: 0 }}>{entry.time}</span>
                  <span style={{
                    color: entry.type === 'success' ? 'var(--success)'
                      : entry.type === 'error' ? 'var(--error)'
                        : entry.type === 'warn' ? 'var(--accent)'
                          : 'var(--text-muted)',
                    lineHeight: 1.5,
                  }}>
                    {entry.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
