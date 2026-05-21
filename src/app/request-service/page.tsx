'use client';
// src/app/request-service/page.tsx
import { useState, useEffect } from 'react';
import Nav from '@/components/Nav';

interface Service {
  id: number;
  name: string;
}

export default function RequestServicePage() {
  const [services, setServices] = useState<Service[]>([]);
  const [form, setForm] = useState({ name: '', phone: '', city: '', serviceId: '', description: '' });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<{ leadId: number; assignedProviders: number[] } | null>(null);

  useEffect(() => {
    fetch('/api/services')
      .then(r => r.json())
      .then(setServices);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setMessage('');
    setResult(null);

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, serviceId: Number(form.serviceId) }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus('error');
        setMessage(data.error || 'Something went wrong.');
      } else {
        setStatus('success');
        setMessage('Your enquiry has been submitted and assigned to providers.');
        setResult(data);
        setForm({ name: '', phone: '', city: '', serviceId: '', description: '' });
      }
    } catch {
      setStatus('error');
      setMessage('Network error. Please try again.');
    }
  };

  return (
    <>
      <Nav />
      <div className="page-sm">
        <h1 className="page-title">Request a Service</h1>
        <p className="page-subtitle">
          Submit your enquiry and we'll match you with the right providers automatically.
        </p>

        {status === 'success' && result && (
          <div className="alert alert-success fade-in">
            <strong>✓ Lead submitted!</strong> {message}<br />
            <span style={{ fontSize: '0.8125rem', opacity: 0.8 }}>
              Lead #{result.leadId} — Assigned to {result.assignedProviders.length} provider(s).
            </span>
          </div>
        )}

        {status === 'error' && (
          <div className="alert alert-error fade-in">
            <strong>✗ Error:</strong> {message}
          </div>
        )}

        <div className="card">
          <form onSubmit={handleSubmit} autoComplete="off">
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label" htmlFor="name">Full Name</label>
                <input
                  id="name"
                  name="name"
                  className="form-input"
                  placeholder="e.g. Arjun Sharma"
                  value={form.name}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="phone">Phone Number</label>
                <input
                  id="phone"
                  name="phone"
                  className="form-input"
                  placeholder="e.g. 9999999999"
                  value={form.phone}
                  onChange={handleChange}
                  required
                  pattern="[0-9]{10}"
                  title="10-digit phone number"
                />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label" htmlFor="city">City</label>
                <input
                  id="city"
                  name="city"
                  className="form-input"
                  placeholder="e.g. Mumbai"
                  value={form.city}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="serviceId">Service Type</label>
                <select
                  id="serviceId"
                  name="serviceId"
                  className="form-select"
                  value={form.serviceId}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select a service…</option>
                  {services.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                className="form-textarea"
                placeholder="Describe what you need…"
                value={form.description}
                onChange={handleChange}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={status === 'loading'}
            >
              {status === 'loading' ? (
                <><span className="spinner" /> Submitting…</>
              ) : 'Submit Enquiry →'}
            </button>
          </form>
        </div>

        <div className="card" style={{ marginTop: '1.5rem', padding: '1rem 1.25rem' }}>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--text-dim)', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.08em' }}>Note</strong><br />
            The same phone number cannot submit two leads for the same service type.
            You may submit for different services.
          </p>
        </div>
      </div>
    </>
  );
}
