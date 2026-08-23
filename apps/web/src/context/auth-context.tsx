import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiFetch } from '../api/client.js';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  organization?: { id: string; name: string; slug: string };
  memberships?: Array<{
    role: 'OWNER' | 'ADMIN' | 'ENGINEER' | 'REVIEWER' | 'VIEWER';
    workspace: { id: string; name: string; slug: string };
  }>;
}

interface AuthContextType {
  user: UserProfile | null;
  role: string;
  activeWorkspaceId: string;
  isLoading: boolean;
  loginMock: (email: string, role: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<string>('ENGINEER');
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchCurrentUser = async () => {
    try {
      const data = await apiFetch<{
        user: UserProfile;
        activeSession: { role: string; activeWorkspaceId: string };
      }>('/auth/me');
      setUser(data.user);
      setRole(data.activeSession.role);
      setActiveWorkspaceId(data.activeSession.activeWorkspaceId);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const loginMock = async (email: string, targetRole: string) => {
    setIsLoading(true);
    await apiFetch('/auth/mock-login', {
      method: 'POST',
      body: JSON.stringify({ email, role: targetRole }),
    });
    await fetchCurrentUser();
  };

  const logout = async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
      setActiveWorkspaceId('');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        activeWorkspaceId,
        isLoading,
        loginMock,
        logout,
        refresh: fetchCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
