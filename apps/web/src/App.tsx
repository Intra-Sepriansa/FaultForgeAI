import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/auth-context.js';
import { Dashboard } from './pages/Dashboard.js';
import { Incidents } from './pages/Incidents.js';
import { WarRoom } from './pages/WarRoom.js';
import { Arena } from './pages/Arena.js';
import { ReferenceLibrary } from './pages/ReferenceLibrary.js';
import { Login } from './pages/Login.js';
import { Zap, ShieldAlert, BookOpen, LogIn } from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const NavigationBar: React.FC = () => {
  const location = useLocation();
  const { user, role } = useAuth();

  const navItems = [
    { label: 'Dashboard', path: '/', icon: Zap },
    { label: 'Incidents', path: '/incidents', icon: ShieldAlert },
    { label: 'Reference Library', path: '/reference-library', icon: BookOpen },
  ];

  if (location.pathname === '/login') {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Zap className="w-5 h-5" />
            </span>
            <span className="font-bold text-white tracking-tight">FaultForge AI</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-slate-900 text-emerald-400 border border-slate-800'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <Link
            to="/login"
            className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-300 font-mono">
              {user?.email || 'admin@faultforge.local'}
            </span>
            <span className="text-emerald-400 font-semibold uppercase">[{role}]</span>
            <LogIn className="w-3 h-3 text-slate-500 hover:text-slate-300 ml-1" />
          </Link>
        </div>
      </div>
    </header>
  );
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <div className="min-h-screen bg-background text-slate-100 flex flex-col">
            <NavigationBar />
            <main className="flex-1">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/login" element={<Login />} />
                <Route path="/incidents" element={<Incidents />} />
                <Route path="/incidents/:incidentId" element={<WarRoom />} />
                <Route path="/arena/:incidentId" element={<Arena />} />
                <Route path="/reference-library" element={<ReferenceLibrary />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
};
