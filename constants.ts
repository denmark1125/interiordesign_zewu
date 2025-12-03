
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
  {
    id: 'P001',
    projectName: '信義區林公館 - 現代極簡風',
    clientName: '林先生',
    assignedEmployee: '王小明',
    address: '台北市信義區松智路',
    contactPhone: '0912-345-678',
    currentStage: ProjectStage.DESIGN,
    estimatedCompletionDate: '2024-08-15',
    latestProgressNotes: '【木作工程】平面配置圖 V2 已確認，目前正在挑選客廳主牆材質。',
    clientRequests: '希望客廳能夠有大理石紋路的電視牆，並且需要預留掃地機器人的家。',
    internalNotes: '客戶對預算較為敏感，材質挑選需控制成本。',
    lastUpdatedTimestamp: Date.now() - 86400000 * 2,
    createdAt: Date.now() - 86400000 * 60, // 2 months ago
    imageUrl: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    history: [
      {
        id: 'h1',
        timestamp: Date.now() - 86400000 * 5,
        userId: 'u1',
        userName: '王小明',
        action: '專案立案',
        details: '建立新專案資料'
      },
      {
        id: 'h2',
        timestamp: Date.now() - 86400000 * 2,
        userId: 'u1',
        userName: '王小明',
        action: '木作工程',
        details: '平面配置圖 V2 已確認，目前正在挑選客廳主牆材質。',
        field: 'latestProgressNotes',
        oldValue: '平面配置圖 V1 討論中',
        newValue: '平面配置圖 V2 已確認，目前正在挑選客廳主牆材質。'
      }
    ],
    schedule: [
        { phase: '保護工程', startDate: '2024-06-01', endDate: '2024-06-03' },
        { phase: '拆除工程', startDate: '2024-06-04', endDate: '2024-06-10' }
    ]
  },
  {
    id: 'P002',
    projectName: '內湖科技園區 - 辦公室改裝',
    clientName: '迅捷科技 HR',
    assignedEmployee: '李雅婷',
    address: '台北市內湖區瑞光路',
    contactPhone: '02-8765-4321',
    currentStage: ProjectStage.CONSTRUCTION,
    estimatedCompletionDate: '2024-06-20',
    latestProgressNotes: '【水電工程】泥作工程結束，水電進場拉線中。下週一預計木工進場。',
    clientRequests: '會議室隔音要求加強，需確認隔音棉規格。',
    internalNotes: '大樓施工規範嚴格，僅能週末進行有噪音工程。',
    lastUpdatedTimestamp: Date.now() - 3600000 * 5,
    createdAt: Date.now() - 86400000 * 5, // 5 days ago
    imageUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    history: [],
    schedule: [
        { phase: '泥作工程', startDate: '2024-05-10', endDate: '2024-05-20' },
        { phase: '水電工程', startDate: '2024-05-21', endDate: '2024-05-25' }
    ]
  },
  {
    id: 'P003',
    projectName: '大安區陳醫師診所',
    clientName: '陳醫師',
    assignedEmployee: '王小明',
    address: '台北市大安區忠孝東路',
    contactPhone: '0988-111-222',
    currentStage: ProjectStage.CONTACT,
    estimatedCompletionDate: '2024-12-01',
    latestProgressNotes: '【其他事項】已完成現場丈量，初步報價單擬定中。',
    clientRequests: '診間需要溫馨的色調，避免過於冷冰冰的感覺。',
    internalNotes: '競爭對手亦在報價，需強調我們的售後服務優勢。',
    lastUpdatedTimestamp: Date.now() - 86400000 * 5,
    createdAt: Date.now() - 86400000 * 150, // 5 months ago
    imageUrl: 'https://images.unsplash.com/photo-1504198458649-3128b932f49e?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    history: [],
    schedule: []
  },
  {
    id: 'P004',
    projectName: '板橋張宅 - 北歐親子宅',
    clientName: '張太太',
    assignedEmployee: '陳志豪',
    address: '新北市板橋區縣民大道',
    contactPhone: '0955-666-777',
    currentStage: ProjectStage.ACCEPTANCE,
    estimatedCompletionDate: '2024-05-30',
    latestProgressNotes: '【驗收缺失改善】細清完成，屋主今日初驗，指出主臥油漆有一處不平整。',
    clientRequests: '小孩房的窗簾希望能換成更遮光的款式。',
    internalNotes: '尾款尚未收到，需追蹤。',
    lastUpdatedTimestamp: Date.now() - 3600000,
    createdAt: Date.now() - 86400000 * 300, // 10 months ago
    imageUrl: 'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    history: [],
    schedule: [
        { phase: '油漆工程', startDate: '2024-05-10', endDate: '2024-05-15' },
        { phase: '細部清潔', startDate: '2024-05-28', endDate: '2024-05-29' }
    ]
  },
  {
    id: 'P005',
    projectName: '松山咖啡廳 - 商業空間',
    clientName: '劉店長',
    assignedEmployee: '王小明', // Reassigned to match existing user
    address: '台北市松山區民生東路',
    contactPhone: '0922-333-444',
    currentStage: ProjectStage.COMPLETED,
    estimatedCompletionDate: '2024-04-15',
    latestProgressNotes: '【完工交付】已完工交屋，保固期開始。',
    clientRequests: '無。',
    internalNotes: '此案為範例作品，已安排攝影師下週拍攝。',
    lastUpdatedTimestamp: Date.now() - 86400000 * 30,
    createdAt: Date.now() - 86400000 * 400, // 13 months ago
    imageUrl: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    history: [],
    schedule: []
  }
];
