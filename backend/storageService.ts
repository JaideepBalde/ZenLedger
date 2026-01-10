
import { User, Transaction, UserRole, ServiceResponse, AuditEntry, Session, TransactionType, MoneyRequest, RequestStatus, FamilyMessage } from '../database/types';

const USERS_KEY = 'zenledger_v14_users';
const TRANSACTIONS_KEY = 'zenledger_v14_transactions';
const REQUESTS_KEY = 'zenledger_v14_requests';
const MESSAGES_KEY = 'zenledger_v14_messages';
const AUDIT_LOG_KEY = 'zenledger_v14_audit';
const SESSION_KEY = 'zenledger_v14_session';

const SESSION_DURATION = 86400000; // 24 hours

const API_BASE = import.meta.env.VITE_API_BASE || '';

const getAuthHeaders = (session: Session) => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${session.token}`
});

export const storageService = {
  signupFamily: async (familyId: string, handle: string, pass: string): Promise<ServiceResponse<User>> => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyId, handle, password: pass })
      });
      const result = await res.json();
      if (result.success) {
        const exp = Date.now() + SESSION_DURATION;
        const session: Session = {
          token: result.token,
          userId: result.userId,
          familyId: result.familyId,
          role: result.role,
          exp
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        return { success: true, data: result.data };
      }
      return { success: false, error: result.error };
    } catch (err) {
      return { success: false, error: 'Network error' };
    }
  },

  createChild: async (session: Session, username: string, pass: string): Promise<ServiceResponse<User>> => {
    if (session.role !== UserRole.PARENT) return { success: false, error: 'Unauthorized.' };

    try {
      const res = await fetch(`${API_BASE}/api/users`, {
        method: 'POST',
        headers: getAuthHeaders(session),
        body: JSON.stringify({ username, password: pass, role: UserRole.CHILD })
      });
      const result = await res.json();
      if (result.success) {
        storageService.logAction(session, 'NODE_CREATED', { handle: username });
        return { success: true, data: result.data };
      }
      return { success: false, error: result.error };
    } catch (err) {
      return { success: false, error: 'Network error' };
    }
  },

  login: async (familyId: string, handle: string, pass: string): Promise<ServiceResponse<Session>> => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyId, handle, password: pass })
      });
      const result = await res.json();
      if (result.success) {
        const session: Session = {
          token: result.token,
          userId: result.userId,
          familyId: result.familyId,
          role: result.role,
          exp: result.exp
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        return { success: true, data: session };
      }
      return { success: false, error: result.error };
    } catch (err) {
      return { success: false, error: 'Network error' };
    }
  },

  logout: () => localStorage.removeItem(SESSION_KEY),

  getUsers: async (session: Session): Promise<User[]> => {
    try {
      const res = await fetch(`${API_BASE}/api/users`, {
        headers: getAuthHeaders(session)
      });
      const result = await res.json();
      return result.success ? result.data : [];
    } catch { return []; }
  },

  getTransactions: async (session: Session): Promise<Transaction[]> => {
    try {
      const res = await fetch(`${API_BASE}/api/transactions`, {
        method: 'GET',
        headers: getAuthHeaders(session),
        body: JSON.stringify({ userIds: [] })
      });
      const result = await res.json();
      return result.success ? result.data : [];
    } catch { return []; }
  },

  getRequests: async (session: Session): Promise<MoneyRequest[]> => {
    try {
      const res = await fetch(`${API_BASE}/api/requests`, {
        headers: getAuthHeaders(session)
      });
      const result = await res.json();
      return result.success ? result.data : [];
    } catch { return []; }
  },

  getMessages: async (session: Session): Promise<FamilyMessage[]> => {
    try {
      const res = await fetch(`${API_BASE}/api/messages`, {
        headers: getAuthHeaders(session)
      });
      const result = await res.json();
      return result.success ? result.data : [];
    } catch { return []; }
  },

  sendMessage: async (session: Session, toId: string, text: string, replyToId?: string): Promise<ServiceResponse<FamilyMessage>> => {
    try {
      const res = await fetch(`${API_BASE}/api/messages`, {
        method: 'POST',
        headers: getAuthHeaders(session),
        body: JSON.stringify({ toId, text, replyToId, timestamp: Date.now() })
      });
      const result = await res.json();
      return result.success ? { success: true, data: result.data } : { success: false, error: result.error };
    } catch (err) {
      return { success: false, error: 'Network error' };
    }
  },

  markMessageRead: async (session: Session, messageId: string): Promise<ServiceResponse<boolean>> => {
    try {
      const res = await fetch(`${API_BASE}/api/messages/${messageId}/read`, {
        method: 'PUT',
        headers: getAuthHeaders(session)
      });
      const result = await res.json();
      return result.success ? { success: true, data: true } : { success: false, error: result.error };
    } catch (err) {
      return { success: false, error: 'Network error' };
    }
  },

  createRequest: async (session: Session, amount: number, reason: string): Promise<ServiceResponse<MoneyRequest>> => {
    if (session.role !== UserRole.CHILD) return { success: false, error: 'Access denied.' };
    try {
      const res = await fetch(`${API_BASE}/api/requests`, {
        method: 'POST',
        headers: getAuthHeaders(session),
        body: JSON.stringify({ childId: session.userId, amount, reason, status: RequestStatus.PENDING, timestamp: Date.now() })
      });
      const result = await res.json();
      return result.success ? { success: true, data: result.data } : { success: false, error: result.error };
    } catch (err) {
      return { success: false, error: 'Network error' };
    }
  },

  updateRequestStatus: async (session: Session, requestId: string, status: RequestStatus): Promise<ServiceResponse<boolean>> => {
    if (session.role !== UserRole.PARENT) return { success: false, error: 'Unauthorized.' };
    try {
      const res = await fetch(`${API_BASE}/api/requests/${requestId}`, {
        method: 'PUT',
        headers: getAuthHeaders(session),
        body: JSON.stringify({ status })
      });
      const result = await res.json();
      return result.success ? { success: true, data: true } : { success: false, error: result.error };
    } catch (err) {
      return { success: false, error: 'Network error' };
    }
  },

  saveTransaction: async (session: Session, tx: Transaction): Promise<ServiceResponse<Transaction>> => {
    try {
      const res = await fetch(`${API_BASE}/api/transactions`, {
        method: 'POST',
        headers: getAuthHeaders(session),
        body: JSON.stringify(tx)
      });
      const result = await res.json();
      if (result.success) {
        storageService.logAction(session, 'LEDGER_UPDATE', { type: tx.type, amount: tx.amount });
        return { success: true, data: result.data };
      }
      return { success: false, error: result.error };
    } catch (err) {
      return { success: false, error: 'Network error' };
    }
  },

  getAuditLogs: async (session: Session): Promise<AuditEntry[]> => {
    try {
      const res = await fetch(`${API_BASE}/api/audit`, {
        headers: getAuthHeaders(session)
      });
      const result = await res.json();
      return result.success ? result.data : [];
    } catch { return []; }
  },

  logAction: async (session: Session, action: string, metadata?: any): Promise<void> => {
    try {
      await fetch(`${API_BASE}/api/audit`, {
        method: 'POST',
        headers: getAuthHeaders(session),
        body: JSON.stringify({ action, metadata })
      });
    } catch (err) {
      console.error('Failed to log action:', err);
    }
  },

  getStoredSession: (): Session | null => {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      const session: Session = JSON.parse(raw);
      if (Date.now() > session.exp) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return session;
    } catch { return null; }
  },

  clearAll: async (session: Session): Promise<void> => {
    // Robust double-check of parent role
    if (session.role !== UserRole.PARENT) {
      console.warn("Unauthorized wipe attempt blocked.");
      return;
    }
    try {
      // Note: This would need a backend endpoint to clear all data for the family
      // For now, just clear local session
      localStorage.removeItem(SESSION_KEY);
    } catch (err) {
      console.error('Failed to clear data:', err);
    }
  },

  getOnboardingStatus: (userId: string): boolean => localStorage.getItem(`onboarded_${userId}`) === 'true',
  setOnboardingStatus: (userId: string) => localStorage.setItem(`onboarded_${userId}`, 'true')
};
