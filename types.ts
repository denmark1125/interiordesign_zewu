
export enum ProjectStage {
  CONTACT = '接洽中',
  DESIGN = '設計中',
  CONSTRUCTION = '施工中',
  ACCEPTANCE = '待驗收',
  COMPLETED = '已完工',
  CLOSED_DESIGN = '已結案(純設計)',
  CLOSED_REJECTED = '已結案(未成案)'
}

export interface HistoryLog {
  id: string;
  timestamp: number;
  userId: string;
  userName: string;
  action: string;     // e.g., "更新進度", "修改客戶需求"
  details: string;    // e.g., "從 A 改為 B" (可選)
  field?: string;     // 改變的欄位名稱
  oldValue?: string;
  newValue?: string;
}

export interface ScheduleItem {
  phase: string;      // 階段名稱 (e.g. 油漆工程)
  startDate: string;  // YYYY-MM-DD
  endDate: string;    // YYYY-MM-DD
}

export interface DesignProject {
  id: string;
  projectName: string;           // 案名
  clientName: string;            // 客戶姓名
  assignedEmployee: string;      // 負責員工
  estimatedCompletionDate: string; // 預計完工日 (YYYY-MM-DD)
  currentStage: ProjectStage;    // 目前階段
  
  latestProgressNotes: string;   // 最新進度描述
  clientRequests: string;        // 客戶事項/需求
  internalNotes: string;         // 備註
  
  lastUpdatedTimestamp: number;  // 最新更新時間
  createdAt: number;             // 建立時間 (新增，用於數據分析)
  
  address: string;
  contactPhone: string;
  imageUrl: string;

  history: HistoryLog[];         // 修改歷史紀錄
  schedule: ScheduleItem[];      // 工程甘特圖/時程表
}

export interface ProjectUpdateLog {
  id: string;
  projectId: string;
  date: string;
  content: string; 
}

export interface AIAnalysisResult {
  analysis: string;
  suggestions: string[];
}

export interface SystemLog {
  id: string;
  timestamp: number;
  version: string;    // e.g. v1.0.2
  title: string;      // e.g. 修復照片上傳問題
  content: string;    // e.g. 調整 Firebase 權限...
  author: string;
}

// Auth Types
export type UserRole = 'manager' | 'employee' | 'engineer';

export interface User {
  id: string;
  name: string;
  username: string; // Login ID
  password?: string; // Password (optional in type for safety when passing around, but used in logic)
  role: UserRole;
  avatarInitials: string;
  canViewDashboard?: boolean; // 是否允許查看儀表板 (針對 employee)
}
