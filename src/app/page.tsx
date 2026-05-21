// src/app/page.tsx
import Link from 'next/link';
import Nav from '@/components/Nav';

export default function Home() {
  return (
    <>
      <Nav />
      <div className="page">
        <div className="hero">
          <h1 className="hero-title">
            Leads distributed<br />
            <span>fairly. automatically.</span>
          </h1>
          <p className="hero-desc">
            A mini lead distribution engine that assigns service enquiries to providers
            using round-robin allocation, mandatory rules, and real-time updates.
          </p>
          <div className="hero-cta">
            <Link href="/request-service" className="btn btn-primary">Submit a Lead →</Link>
            <Link href="/dashboard" className="btn btn-secondary">View Dashboard</Link>
          </div>
        </div>

        <hr className="divider" />

        <div className="grid-3" style={{ marginTop: '2rem' }}>
          <div className="card">
            <p className="section-title">Allocation Rules</p>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Every lead gets exactly 3 providers. Mandatory providers are always assigned first,
              then fair round-robin fills remaining slots.
            </p>
          </div>
          <div className="card">
            <p className="section-title">Real-Time Updates</p>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              The provider dashboard updates instantly via Server-Sent Events when a new lead is assigned —
              no page refresh needed.
            </p>
          </div>
          <div className="card">
            <p className="section-title">Concurrency Safe</p>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Serializable transactions + PostgreSQL advisory locks ensure correct allocation
              even under simultaneous lead submissions.
            </p>
          </div>
        </div>

        <div className="card" style={{ marginTop: '1.5rem' }}>
          <p className="section-title">Assignment Matrix</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Mandatory</th>
                  <th>Fair Pool</th>
                  <th>Total Assigned</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><span className="badge badge-yellow">Service 1</span></td>
                  <td>Provider 1</td>
                  <td><span className="mono">P2 → P3 → P4 (rotate)</span></td>
                  <td>3 providers</td>
                </tr>
                <tr>
                  <td><span className="badge badge-blue">Service 2</span></td>
                  <td>Provider 5</td>
                  <td><span className="mono">P6 → P7 → P8 (rotate)</span></td>
                  <td>3 providers</td>
                </tr>
                <tr>
                  <td><span className="badge badge-green">Service 3</span></td>
                  <td>Provider 1 + Provider 4</td>
                  <td><span className="mono">P2,P3,P5,P6,P7,P8 (rotate)</span></td>
                  <td>3 providers</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
