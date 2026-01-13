
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import JoinPage from './JoinPage';

/**
 * 系統流量分選器 (Traffic Gatekeeper)
 * 根據 URL 參數決定載入哪一套系統，避免不必要的代碼膨脹與 Hydration 錯誤
 */
const getRootComponent = () => {
  if (typeof window === 'undefined') return <App />;

  const searchParams = new URLSearchParams(window.location.search);
  const hash = window.location.hash;
  const hashParams = new URLSearchParams(hash.includes('?') ? hash.split('?')[1] : '');
  
  // 檢查是否具備廣告來源特徵
  const isMarketingEntry = 
    searchParams.has('src') || searchParams.has('source') || 
    hashParams.has('src') || hashParams.has('source') ||
    sessionStorage.getItem('zewu_mode') === 'client';

  if (isMarketingEntry) {
    // 鎖定為客戶端模式
    sessionStorage.setItem('zewu_mode', 'client');
    return <JoinPage />;
  }

  // 預設為後台管理系統
  return <App />;
};

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      {getRootComponent()}
    </React.StrictMode>
  );
}
