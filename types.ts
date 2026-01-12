
export enum UserRole {
  HOST = 'HOST',
  MEMBER = 'MEMBER'
}

export enum TransactionType {
  CREDIT = 'CREDIT', 
  DEBIT = 'DEBIT'   
}

export enum TransactionCategory {
  ALLOWANCE = 'Allocation',
  FOOD = 'Operations',
  GAMES = 'Recreation',
  EDUCATION = 'Development',
  ENTERTAINMENT = 'Social',
  SAVINGS = 'Reserve',
  GIFT = 'Grant',
  OTHER = 'Miscellaneous'
}

export enum RequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

export interface User {
  id: string;
  familyId: string;
  name: string;
  username: string;
  password?: string;
  role: UserRole;
  parentId?: string;
  isActive: boolean;
}

export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  type: TransactionType;
  category: TransactionCategory;
  description: string;
  timestamp: number;
}

export interface MoneyRequest {
  id: string;
  childId: string; // Internal ID for requester
  amount: number;
  reason: string;
  status: RequestStatus;
  timestamp: number;
}

export interface FamilyMessage {
  id: string;
  familyId: string;
  fromId: string;
  fromRole: UserRole;
  toId: string; // 'cluster' for broadcast or specific userId
  text: string;
  timestamp: number;
  isRead: boolean;
  replyToId?: string;
}

export interface Session {
  token: string;
  userId: string;
  familyId: string;
  role: UserRole;
  exp: number;
  cloudSync?: boolean;
}

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
