
import { User, Transaction, UserRole, ServiceResponse, AuditEntry, Session, TransactionType, MoneyRequest, RequestStatus, FamilyMessage } from '../database/types';

const USERS_KEY = 'zenledger_v14_users';
const TRANSACTIONS_KEY = 'zenledger_v14_transactions';
const REQUESTS_KEY = 'zenledger_v14_requests';
const MESSAGES_KEY = 'zenledger_v14_messages';
const AUDIT_LOG_KEY = 'zenledger_v14_audit';
const SESSION_KEY = 'zenledger_v14_session';

const SESSION_DURATION = 86400000; // 24 hours

export const storageService = {
  signupFamily: async (familyId: string, handle: string, pass: string): Promise<ServiceResponse<User>> => {
    const users = storageService.getUsers();
    const fid = familyId.trim().toLowerCase().replace(/\s+/g, '_');
    const username = handle.trim().toLowerCase();
    
    if (users.find(u => u.familyId === fid && u.username === username)) {
      return { success: false, error: 'Identity already exists in this family cloud.' };
    }

    const newUser: User = {
      id: `u_${Math.random().toString(36).substr(2, 9)}`,
      familyId: fid,
      name: handle, 
      username,
      password: pass,
      role: UserRole.PARENT,
      isActive: true,
      savingsGoals: []
    };
    
    localStorage.setItem(USERS_KEY, JSON.stringify([...users, newUser]));
    return { success: true, data: newUser };
  },

  createChild: async (session: Session, username: string, pass: string): Promise<ServiceResponse<User>> => {
    if (session.role !== UserRole.PARENT) return { success: false, error: 'Unauthorized.' };
    
    const users = storageService.getUsers();
    const handle = username.trim().toLowerCase();

    if (users.find(u => u.familyId === session.familyId && u.username === handle)) {
      return { success: false, error: 'Handle already provisioned.' };
    }

    const newChild: User = {
      id: `u_${Math.random().toString(36).substr(2, 9)}`,
      familyId: session.familyId,
      name: handle, 
      username: handle,
      password: pass,
      role: UserRole.CHILD,
      parentId: session.userId,
      isActive: true,
      savingsGoals: []
    };

    localStorage.setItem(USERS_KEY, JSON.stringify([...users, newChild]));
    storageService.logAction(session.userId, UserRole.PARENT, 'NODE_CREATED', { handle });
    return { success: true, data: newChild };
  },

  login: async (familyId: string, handle: string, pass: string): Promise<ServiceResponse<Session>> => {
    const fid = familyId.trim().toLowerCase().replace(/\s+/g, '_');
    const username = handle.trim().toLowerCase();
    
    const users = storageService.getUsers();
    const user = users.find(u => 
      u.familyId === fid && 
      u.username === username && 
      u.password === pass
    );

    if (!user) return { success: false, error: 'Invalid credentials.' };
    if (!user.isActive) return { success: false, error: 'Account disabled.' };

    const exp = Date.now() + SESSION_DURATION;
    const session: Session = {
      token: btoa(`${user.id}:${exp}:${Math.random()}`),
      userId: user.id,
      familyId: user.familyId,
      role: user.role,
      exp
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return { success: true, data: session };
  },

  logout: () => localStorage.removeItem(SESSION_KEY),

  getUsers: (): User[] => {
    try {
      const data = localStorage.getItem(USERS_KEY);
      return data ? JSON.parse(data) : [];
    } catch { return []; }
  },

  getTransactions: (): Transaction[] => {
    try {
      const data = localStorage.getItem(TRANSACTIONS_KEY);
      return data ? JSON.parse(data) : [];
    } catch { return []; }
  },

  getRequests: (): MoneyRequest[] => {
    try {
      const data = localStorage.getItem(REQUESTS_KEY);
      return data ? JSON.parse(data) : [];
    } catch { return []; }
  },

  getMessages: (): FamilyMessage[] => {
    try {
      const data = localStorage.getItem(MESSAGES_KEY);
      return data ? JSON.parse(data) : [];
    } catch { return []; }
  },

  sendMessage: async (session: Session, toId: string, text: string, replyToId?: string): Promise<ServiceResponse<FamilyMessage>> => {
    const messages = storageService.getMessages();
    const newMessage: FamilyMessage = {
      id: `msg_${Date.now()}`,
      fromId: session.userId,
      toId,
      text,
      timestamp: Date.now(),
      isRead: false,
      replyToId
    };
    localStorage.setItem(MESSAGES_KEY, JSON.stringify([newMessage, ...messages]));
    return { success: true, data: newMessage };
  },

  markMessageRead: async (messageId: string): Promise<ServiceResponse<boolean>> => {
    const messages = storageService.getMessages();
    const idx = messages.findIndex(m => m.id === messageId);
    if (idx !== -1) {
      messages[idx].isRead = true;
      localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
    }
    return { success: true, data: true };
  },

  createRequest: async (session: Session, amount: number, reason: string): Promise<ServiceResponse<MoneyRequest>> => {
    if (session.role !== UserRole.CHILD) return { success: false, error: 'Access denied.' };
    const requests = storageService.getRequests();
    const newRequest: MoneyRequest = {
      id: `req_${Date.now()}`,
      childId: session.userId,
      amount,
      reason,
      status: RequestStatus.PENDING,
      timestamp: Date.now()
    };
    localStorage.setItem(REQUESTS_KEY, JSON.stringify([newRequest, ...requests]));
    return { success: true, data: newRequest };
  },

  updateRequestStatus: async (session: Session, requestId: string, status: RequestStatus): Promise<ServiceResponse<boolean>> => {
    if (session.role !== UserRole.PARENT) return { success: false, error: 'Unauthorized.' };
    const requests = storageService.getRequests();
    const idx = requests.findIndex(r => r.id === requestId);
    if (idx === -1) return { success: false, error: 'Not found.' };
    
    requests[idx].status = status;
    localStorage.setItem(REQUESTS_KEY, JSON.stringify(requests));
    return { success: true, data: true };
  },

  saveTransaction: async (session: Session, tx: Transaction): Promise<ServiceResponse<Transaction>> => {
    const txs = storageService.getTransactions();
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify([tx, ...txs]));
    storageService.logAction(session.userId, session.role, 'LEDGER_UPDATE', { type: tx.type, amount: tx.amount });
    return { success: true, data: tx };
  },

  getAuditLogs: (): AuditEntry[] => {
    try {
      const data = localStorage.getItem(AUDIT_LOG_KEY);
      return data ? JSON.parse(data) : [];
    } catch { return []; }
  },

  logAction: (userId: string, role: UserRole, action: string, metadata?: any) => {
    const logs = storageService.getAuditLogs();
    const entry: AuditEntry = { timestamp: Date.now(), userId, role, action, metadata };
    localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify([entry, ...logs].slice(0, 50)));
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

  clearAll: (session: Session) => {
    // Robust double-check of parent role
    if (session.role !== UserRole.PARENT) {
      console.warn("Unauthorized wipe attempt blocked.");
      return;
    }
    // Deep wipe of app-specific keys to ensure fresh reload
    localStorage.removeItem(USERS_KEY);
    localStorage.removeItem(TRANSACTIONS_KEY);
    localStorage.removeItem(REQUESTS_KEY);
    localStorage.removeItem(MESSAGES_KEY);
    localStorage.removeItem(AUDIT_LOG_KEY);
    localStorage.removeItem(SESSION_KEY);
    // Finally clear everything else just to be safe as per "clear data" requirement
    localStorage.clear();
  },

  getOnboardingStatus: (userId: string): boolean => localStorage.getItem(`onboarded_${userId}`) === 'true',
  setOnboardingStatus: (userId: string) => localStorage.setItem(`onboarded_${userId}`, 'true')
};
