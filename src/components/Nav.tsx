'use client';
// src/components/Nav.tsx
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="nav">
      <Link href="/" className="nav-logo">Prowider</Link>
      <Link href="/request-service" className={`nav-link${path === '/request-service' ? ' active' : ''}`}>Submit Lead</Link>
      <Link href="/dashboard" className={`nav-link${path === '/dashboard' ? ' active' : ''}`}>Dashboard</Link>
      <Link href="/test-tools" className={`nav-link${path === '/test-tools' ? ' active' : ''}`}>Test Tools</Link>
    </nav>
  );
}
