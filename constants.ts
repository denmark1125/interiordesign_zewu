import { DesignProject, ProjectStage, User } from './types';

// These are now INITIAL states, used to populate the App state on first load.
// Real data will be managed in App.tsx state.

export const INITIAL_USERS: User[] = [
  { id: 'admin', name: '老闆/管理員', username: 'admin', password: '1234', role: 'manager', avatarInitials: 'Boss', canViewDashboard: true },
  { id: 'eng1', name: '系統工程師', username: 'engineer', password: '1234', role: 'engineer', avatarInitials: 'Eng', canViewDashboard: true },
  { id: 'u1', name: '王小明', username: 'wang', password: '1234', role: 'employee', avatarInitials: '王', canViewDashboard: true }, // 授權查看儀表板的員工
  { id: 'u2', name: '李雅婷', username: 'lee', password: '1234', role: 'employee', avatarInitials: '李', canViewDashboard: false },
  { id: 'u3', name: '陳志豪', username: 'chen', password: '1234', role: 'employee', avatarInitials: '陳', canViewDashboard: false },
];

export const CONSTRUCTION_PHASES = [
  '保護工程',
  '拆除工程',
  '泥作工程',
  '水電工程',
  '空調/管線',
  '木作工程',
  '油漆工程',
  '系統櫃安裝',
  '石材/磁磚',
  '燈具/玻璃',
  '地板工程',
  '細部清潔',
  '家具軟裝',
  '驗收缺失改善',
  '完工交付',
  '其他事項'
];

export const MOCK_PROJECTS: DesignProject[] = [
  // ... (Existing MOCK_PROJECTS content is unused in main app flow but kept for reference if needed)
];