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

// High-quality interior design images for random assignment
export const DEFAULT_PROJECT_COVERS = [
  'https://images.unsplash.com/photo-1600607686527-6fb886090705?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80', // Modern Living Room
  'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80', // Minimalist
  'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80', // Kitchen / Dining
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80', // Bright Window
  'https://images.unsplash.com/photo-1600573472591-ee6b68d14c68?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80', // Dark/Elegant
  'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80', // Bedroom
  'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80'  // Nordic
];

// Helper to validate image size and aspect ratio
export const validateImageFile = (file: File): Promise<boolean> => {
  return new Promise((resolve) => {
    // 1. File Size Check (1MB = 1,048,576 bytes)
    const MAX_SIZE = 1 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      alert(`檔案過大！\n\n您的圖片大小為 ${(file.size / 1024 / 1024).toFixed(2)}MB。\n為了確保系統效能，請上傳 1MB 以下的圖片。`);
      resolve(false);
      return;
    }

    // 2. Aspect Ratio Check (Target 16:9 approx 1.77)
    // We allow a loose tolerance (e.g., 1.4 to 2.2) to not be annoying,
    // but warn on vertical or very square images.
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    
    img.onload = () => {
      const ratio = img.width / img.height;
      URL.revokeObjectURL(objectUrl);

      // 16:9 = 1.77
      // 4:3 = 1.33
      // 3:2 = 1.5
      // Allow range roughly 1.4 to 2.2
      if (ratio < 1.4 || ratio > 2.4) {
        const proceed = window.confirm(
          "比例提醒：\n\n這張圖片的比例似乎不是橫式 (16:9)，在列表中可能會被裁切。\n\n是否確定要使用此圖片？"
        );
        resolve(proceed);
      } else {
        resolve(true);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      alert("無法讀取圖片檔案，請重試。");
      resolve(false);
    };

    img.src = objectUrl;
  });
};

export const MOCK_PROJECTS: DesignProject[] = [
  // ... (Existing MOCK_PROJECTS content is unused in main app flow but kept for reference if needed)
];
