
export enum UserRole {
  PARENT = 'PARENT',
  CHILD = 'CHILD'
}

export enum TransactionType {
  CREDIT = 'CREDIT', 
  DEBIT = 'DEBIT'   
}

export enum TransactionCategory {
  ALLOWANCE = 'Allowance',
  FOOD = 'Food & Drinks',
  GAMES = 'Games',
  EDUCATION = 'Education',
  ENTERTAINMENT = 'Entertainment',
  SAVINGS = 'Savings',
  GIFT = 'Gift',
  OTHER = 'Other'
}

export enum RequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

export interface SavingsGoal {
  id: string;
  title: string;
  targetAmount: number;
  createdAt: number;
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
  allowanceAmount?: number;
  savingsGoals?: SavingsGoal[];
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
  childId: string;
  amount: number;
  reason: string;
  status: RequestStatus;
  timestamp: number;
}

export interface FamilyMessage {
  id: string;
  fromId: string;
  toId: string;
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
}

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: number;
}

export interface AuditEntry {
  timestamp: number;
  userId: string;
  role: UserRole;
  action: string;
  metadata?: any;
}
