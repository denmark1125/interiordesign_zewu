
// Shared UserRole type
export type UserRole = 'manager' | 'employee' | 'engineer';

export enum ProjectStage {
  CONTACT = '接洽中',
  DESIGN = '設計中',
  CONSTRUCTION = '施工中',
  ACCEPTANCE = '待驗收',
  COMPLETED = '已完工',
  CLOSED_DESIGN = '已結案(純設計)',
  CLOSED_REJECTED = '已結案(未成案)'
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address?: string; // 新增：案場地址/說明
  lineConnectionId?: string;
  lineDisplayName?: string;
  linePictureUrl?: string;
  tags: string[];
  createdAt: number;
}

export interface LineConnection {
  id: string;
  lineUserId: string;
  lineDisplayName: string;
  linePictureUrl?: string;
  lastMessage?: string;
  timestamp: number;
  isBound: boolean;
}

export interface Reservation {
  id: string;
  customerId: string;
  customerName: string;
  lineUserId?: string;
  dateTime: string;
  type: '諮詢' | '丈量' | '看圖' | '簽約' | '其他'; // 預約類別
  customTypeLabel?: string; // 當類別為「其他」時的自定義文字
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  immediateNotified: boolean;
  reminded: boolean;
  note?: string;
  createdAt: number;
}

export interface User {
  id: string;
  name: string;
  username: string;
  password?: string;
  role: UserRole;
  avatarInitials: string;
  canViewDashboard?: boolean;
  loginCount?: number;
  lastLoginAt?: number;
}

export interface HistoryLog {
  id: string;
  timestamp: number;
  userId: string;
  userName: string;
  action: string;
  details: string;
  field?: string;
  oldValue?: any;
  newValue?: any;
}

export interface ScheduleItem {
  phase: string;
  startDate: string;
  endDate: string;
}

export interface DesignProject {
  id: string;
  projectName: string;
  clientName: string;
  assignedEmployee: string;
  address: string;
  contactPhone: string;
  currentStage: ProjectStage;
  estimatedCompletionDate: string;
  latestProgressNotes: string;
  clientRequests: string;
  internalNotes: string;
  lastUpdatedTimestamp: number;
  createdAt: number;
  imageUrl: string;
  history: HistoryLog[];
  schedule: ScheduleItem[];
}

export interface AIAnalysisResult {
  analysis: string;
  suggestions: string[];
}

export interface LineMetric {
  id: string;
  timestamp: number;
  date: string;
  followerCount: number;
  recordedBy: string;
}

export interface SystemLog {
  id: string;
  timestamp: number;
  version: string;
  title: string;
  content: string;
  author: string;
}
