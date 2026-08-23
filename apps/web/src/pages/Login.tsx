import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/auth-context.js';
import { Zap, ShieldCheck, UserCheck, ArrowRight } from 'lucide-react';
import { Button } from '@faultforge/ui';

export const Login: React.FC = () => {
  const { loginMock } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@faultforge.local');
  const [role, setRole] = useState<'ADMIN' | 'REVIEWER' | 'ENGINEER'>('ADMIN');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await loginMock(email, role);
      navigate('/');
    } catch (err) {
      console.error('Login failed', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = async (quickEmail: string, quickRole: 'ADMIN' | 'REVIEWER') => {
    setIsLoading(true);
    try {
      await loginMock(quickEmail, quickRole);
      navigate('/');
    } catch (err) {
      console.error('Quick login failed', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-lg shadow-emerald-500/10">
            <Zap className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">FaultForge AI</h1>
          <p className="text-xs text-slate-400">
            Controlled Chaos Engineering & Incident Adjudication Platform
          </p>
        </div>

        {/* Login Card */}
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 backdrop-blur-md shadow-2xl space-y-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-white">Sign In to Workspace</h2>
            <p className="text-xs text-slate-400">
              Select a persona or sign in with your workspace credentials.
            </p>
          </div>

          {/* Quick Persona Selectors */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Quick Switch Personas
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleQuickLogin('admin@faultforge.local', 'ADMIN')}
                className="flex flex-col items-start p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all text-left group"
              >
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs mb-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Lead SRE Admin
                </div>
                <span className="text-[10px] text-slate-400 group-hover:text-slate-300">
                  Full access & chaos injection
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('reviewer@faultforge.local', 'REVIEWER')}
                className="flex flex-col items-start p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-all text-left group"
              >
                <div className="flex items-center gap-1.5 text-cyan-400 font-semibold text-xs mb-1">
                  <UserCheck className="w-3.5 h-3.5" />
                  AI Reviewer
                </div>
                <span className="text-[10px] text-slate-400 group-hover:text-slate-300">
                  Patch approvals & canary
                </span>
              </button>
            </div>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-800 w-full" />
            <span className="bg-slate-900 px-3 text-[11px] text-slate-500 uppercase tracking-widest font-mono">
              or enter credentials
            </span>
          </div>

          {/* Manual Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50"
                placeholder="user@faultforge.local"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'ADMIN' | 'REVIEWER' | 'ENGINEER')}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-500/50"
              >
                <option value="ADMIN">ADMIN (Lead SRE)</option>
                <option value="REVIEWER">REVIEWER (AI Adjudicator)</option>
                <option value="ENGINEER">ENGINEER (Operator)</option>
              </select>
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full justify-center py-2.5 rounded-xl font-medium text-xs gap-2"
              disabled={isLoading}
            >
              {isLoading ? 'Signing In...' : 'Enter Platform'}
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};
