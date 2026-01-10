import { 
  User, Transaction, UserRole, ServiceResponse, Session, 
  MoneyRequest, RequestStatus, TransactionType, TransactionCategory, 
  FamilyMessage
} from '../types';

const USERS_KEY = 'zenledger_v21_users';
const TRANSACTIONS_KEY = 'zenledger_v21_transactions';
const REQUESTS_KEY = 'zenledger_v21_requests';
const MESSAGES_KEY = 'zenledger_v21_messages';
const SESSION_KEY = 'zenledger_v21_session';

const SESSION_DURATION = 86400000;

export const storageService = {
  signupCluster: async (familyId: string, handle: string, pass: string): Promise<ServiceResponse<User>> => {
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    const fid = familyId.trim().toLowerCase();
    const username = handle.trim().toLowerCase();

    if (users.find((u: any) => u.familyId === fid && u.username === username)) {
      return { success: false, error: 'Identity handle already provisioned in this cluster.' };
    }

    const newUser: User = { 
      id: `u_${Date.now()}`, 
      familyId: fid, 
      name: handle, 
      username, 
      password: pass, 
      role: UserRole.HOST, 
      isActive: true 
    };
    
    localStorage.setItem(USERS_KEY, JSON.stringify([...users, newUser]));
    return { success: true, data: newUser };
  },

  provisionMember: async (session: Session, username: string, pass: string): Promise<ServiceResponse<User>> => {
    if (session.role !== UserRole.HOST) return { success: false, error: 'Authorization restricted to Host Nodes.' };
    
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    const handle = username.trim().toLowerCase();

    if (users.find((u: any) => u.familyId === session.familyId && u.username === handle)) {
      return { success: false, error: 'Member handle already provisioned.' };
    }

    const newMember: User = {
      id: `u_${Math.random().toString(36).substr(2, 9)}`,
      familyId: session.familyId,
      name: username, 
      username: handle,
      password: pass,
      role: UserRole.MEMBER,
      parentId: session.userId,
      isActive: true
    };

    localStorage.setItem(USERS_KEY, JSON.stringify([...users, newMember]));
    return { success: true, data: newMember };
  },

  login: async (familyId: string, handle: string, pass: string): Promise<ServiceResponse<Session>> => {
    const fid = familyId.trim().toLowerCase();
    const username = handle.trim().toLowerCase();
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    
    const user = users.find((u: any) => 
      u.familyId === fid && 
      u.username === username && 
      u.password === pass
    );

    if (!user) return { success: false, error: 'Access Denied. Invalid credentials or Cluster ID.' };

    const session: Session = { 
      token: btoa(`${user.id}:${Date.now()}`), 
      userId: user.id, 
      familyId: user.familyId, 
      role: user.role, 
      exp: Date.now() + SESSION_DURATION 
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return { success: true, data: session };
  },

  getUsers: async (): Promise<User[]> => JSON.parse(localStorage.getItem(USERS_KEY) || '[]'),
  getTransactions: async (): Promise<Transaction[]> => JSON.parse(localStorage.getItem(TRANSACTIONS_KEY) || '[]'),
  getRequests: async (): Promise<MoneyRequest[]> => JSON.parse(localStorage.getItem(REQUESTS_KEY) || '[]'),
  getMessages: async (): Promise<FamilyMessage[]> => JSON.parse(localStorage.getItem(MESSAGES_KEY) || '[]'),

  sendMessage: async (session: Session, text: string, toId: string = 'cluster'): Promise<ServiceResponse<FamilyMessage>> => {
    const messages = JSON.parse(localStorage.getItem(MESSAGES_KEY) || '[]');
    const newMessage: FamilyMessage = {
      id: `msg_${Date.now()}`,
      familyId: session.familyId,
      fromId: session.userId,
      fromRole: session.role,
      toId,
      text,
      timestamp: Date.now(),
      isRead: false
    };
    localStorage.setItem(MESSAGES_KEY, JSON.stringify([newMessage, ...messages]));
    return { success: true, data: newMessage };
  },

  saveTransaction: async (session: Session, tx: Transaction): Promise<ServiceResponse<Transaction>> => {
    const txs = JSON.parse(localStorage.getItem(TRANSACTIONS_KEY) || '[]');
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify([tx, ...txs]));
    return { success: true, data: tx };
  },

  createRequest: async (session: Session, amount: number, reason: string): Promise<ServiceResponse<MoneyRequest>> => {
    const requests = JSON.parse(localStorage.getItem(REQUESTS_KEY) || '[]');
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
    if (session.role !== UserRole.HOST) return { success: false, error: 'Unauthorized.' };
    const requests = JSON.parse(localStorage.getItem(REQUESTS_KEY) || '[]');
    const idx = requests.findIndex((r: any) => r.id === requestId);
    if (idx === -1) return { success: false, error: 'Not found.' };
    
    requests[idx].status = status;
    localStorage.setItem(REQUESTS_KEY, JSON.stringify(requests));
    return { success: true, data: true };
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
    } catch {
      return null;
    }
  },

  logout: () => {
    localStorage.removeItem(SESSION_KEY);
  },

  getOnboardingStatus: (userId: string): boolean => localStorage.getItem(`onboarded_${userId}`) === 'true',
  setOnboardingStatus: (userId: string) => localStorage.setItem(`onboarded_${userId}`, 'true')
};