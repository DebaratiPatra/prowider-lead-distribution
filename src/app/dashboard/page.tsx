'use client';
// src/app/dashboard/page.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import Nav from '@/components/Nav';

interface Lead {
  id: number;
  name: string;
  phone: string;
  city: string;
  service: string;
  description: string;
  assignedAt: string;
}

interface Provider {
  id: number;
  name: string;
  monthlyQuota: number;
  usedQuota: number;
  remainingQuota: number;
  leadsReceived: number;
  leads: Lead[];
}

function QuotaBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.round((used / total) * 100) : 0;
  const cls = pct >= 100 ? 'full' : pct >= 70 ? 'warn' : '';
  return (
    <div className="quota-bar-track">
      <div className={`quota-bar-fill ${cls}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

export default function DashboardPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [sseStatus, setSseStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState<Set<number>>(new Set());
  const [expandedProvider, setExpandedProvider] = useState<number | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch('/api/providers');
      const data = await res.json();
      setProviders(data);
    } catch {
      console.error('Failed to fetch providers');
    } finally {
      setLoading(false);
    }
  }, []);

  // SSE connection for real-time updates
  useEffect(() => {
    const connect = () => {
      const es = new EventSource('/api/sse');
      eventSourceRef.current = es;

      es.addEventListener('connected', () => {
        setSseStatus('connected');
      });

      es.addEventListener('lead_assigned', (e) => {
        const data = JSON.parse(e.data);
        setLastUpdate(`New lead #${data.lead.id} (${data.lead.service}) assigned at ${new Date().toLocaleTimeString()}`);

        // Highlight affected provider cards
        const affectedIds = new Set(data.assignments.map((a: { providerId: number }) => a.providerId));
        setHighlighted(affectedIds as Set<number>);
        setTimeout(() => setHighlighted(new Set()), 3000);

        // Refresh provider data
        fetchProviders();
      });

      es.addEventListener('quota_reset', () => {
        setLastUpdate(`All quotas reset at ${new Date().toLocaleTimeString()}`);
        fetchProviders();
      });

      es.onerror = () => {
        setSseStatus('disconnected');
        es.close();
        // Reconnect after 3s
        setTimeout(connect, 3000);
      };
    };

    fetchProviders();
    connect();

    return () => {
      eventSourceRef.current?.close();
    };
  }, [fetchProviders]);

  const totalLeads = providers.reduce((s, p) => s + p.leadsReceived, 0);
  const totalUsed = providers.reduce((s, p) => s + p.usedQuota, 0);
  const totalCapacity = providers.reduce((s, p) => s + p.monthlyQuota, 0);

  return (
    <>
      <Nav />
      <div className="page">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="page-title">Provider Dashboard</h1>
            <p className="page-subtitle" style={{ marginBottom: 0 }}>
              Real-time lead assignments and quota tracking
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
            <div className={`live-indicator`}>
              <span className={`live-dot`} style={{ background: sseStatus === 'connected' ? 'var(--success)' : sseStatus === 'connecting' ? 'var(--accent)' : 'var(--error)' }} />
              {sseStatus === 'connected' ? 'Live' : sseStatus === 'connecting' ? 'Connecting…' : 'Reconnecting…'}
            </div>
            {lastUpdate && (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{lastUpdate}</p>
            )}
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid-4" style={{ marginBottom: '2rem' }}>
          {[
            { label: 'Total Providers', value: providers.length },
            { label: 'Total Leads', value: totalLeads },
            { label: 'Quota Used', value: `${totalUsed} / ${totalCapacity}` },
            { label: 'Avg per Provider', value: providers.length ? (totalLeads / providers.length).toFixed(1) : '0' },
          ].map(stat => (
            <div key={stat.label} className="card" style={{ padding: '1rem 1.25rem' }}>
              <p className="section-title" style={{ marginBottom: '0.4rem' }}>{stat.label}</p>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '1.375rem', fontWeight: 600 }}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Provider grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
            Loading providers…
          </div>
        ) : (
          <div className="grid-2">
            {providers.map(p => {
              const isHighlighted = highlighted.has(p.id);
              const isExpanded = expandedProvider === p.id;
              const pct = Math.round((p.usedQuota / p.monthlyQuota) * 100);

              return (
                <div
                  key={p.id}
                  className={`provider-card${isHighlighted ? ' highlighted' : ''}`}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2 className="provider-name" style={{ marginBottom: 0 }}>{p.name}</h2>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {p.remainingQuota === 0 && <span className="badge badge-red">Quota Full</span>}
                      {pct >= 70 && pct < 100 && <span className="badge badge-yellow">70%+</span>}
                      <span className="badge badge-blue">{p.leadsReceived} leads</span>
                    </div>
                  </div>

                  <div className="stat-row">
                    <span className="stat-label">Quota Used</span>
                    <span className="stat-value">{p.usedQuota} / {p.monthlyQuota}</span>
                  </div>
                  <QuotaBar used={p.usedQuota} total={p.monthlyQuota} />

                  <div className="stat-row" style={{ marginTop: '0.75rem' }}>
                    <span className="stat-label">Remaining</span>
                    <span className="stat-value" style={{ color: p.remainingQuota === 0 ? 'var(--error)' : 'var(--success)' }}>
                      {p.remainingQuota}
                    </span>
                  </div>

                  {p.leads.length > 0 && (
                    <div style={{ marginTop: '1rem' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setExpandedProvider(isExpanded ? null : p.id)}
                        style={{ width: '100%', justifyContent: 'space-between' }}
                      >
                        <span>View assigned leads</span>
                        <span>{isExpanded ? '↑' : '↓'} {p.leads.length}</span>
                      </button>

                      {isExpanded && (
                        <div style={{ marginTop: '0.75rem' }} className="fade-in">
                          {p.leads.slice(0, 10).map(lead => (
                            <div key={lead.id} className="lead-item">
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <span style={{ fontWeight: 500 }}>{lead.name}</span>
                                <span className={`badge ${lead.service === 'Service 1' ? 'badge-yellow' : lead.service === 'Service 2' ? 'badge-blue' : 'badge-green'}`} style={{ fontSize: '0.625rem' }}>
                                  {lead.service}
                                </span>
                              </div>
                              <div className="lead-meta">{lead.city} · {lead.phone}</div>
                              <div className="lead-meta" style={{ fontSize: '0.75rem', marginTop: '0.2rem', color: 'var(--text-dim)' }}>
                                {new Date(lead.assignedAt).toLocaleString()}
                              </div>
                            </div>
                          ))}
                          {p.leads.length > 10 && (
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textAlign: 'center', paddingTop: '0.5rem' }}>
                              + {p.leads.length - 10} more
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {p.leads.length === 0 && (
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', marginTop: '1rem' }}>No leads assigned yet.</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
