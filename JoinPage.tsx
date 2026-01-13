
'use client';

import React, { useEffect, useState } from 'react';
import { db, doc, setDoc } from './services/firebase';
import { serverTimestamp } from 'firebase/firestore';
import { Loader2, MessageCircle, ExternalLink } from 'lucide-react';

declare const liff: any;

const MY_LIFF_ID = "2008826901-DGGr1P8u";
const LINE_OA_URL = "https://lin.ee/GRgdkQe";

const ZewuIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 100 150" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="5" y="5" width="90" height="140" stroke="currentColor" strokeWidth="4" rx="2" />
    <path d="M 5 95 C 35 85, 65 105, 95 95" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M 5 115 C 35 105, 65 125, 95 115" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M 5 135 C 35 125, 65 145, 95 135" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const JoinPage: React.FC = () => {
  const [status, setStatus] = useState('正在初始化...');
  const [error, setError] = useState<string | null>(null);
  const [showManualBtn, setShowManualBtn] = useState(false);

  useEffect(() => {
    const initLiff = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        // 先看網址有沒有，沒有的話看 session 有沒有備份
        const source = params.get('src') || params.get('source') || sessionStorage.getItem('zewu_marketing_src') || 'direct';

        setStatus('正在連接 LINE...');
        await liff.init({ liffId: MY_LIFF_ID });

        if (!liff.isLoggedIn()) {
          setStatus('正在導向登入...');
          // 登入時務必傳入當前 URL，確保回來時還在同一個地方
          liff.login({ redirectUri: window.location.href }); 
          return;
        }

        setStatus('正在同步追蹤數據...');
        const profile = await liff.getProfile();

        // 寫入 Firestore 用於 CRM 追蹤
        const userSourceRef = doc(db, "user_sources", profile.userId);
        await setDoc(userSourceRef, {
          userId: profile.userId,
          displayName: profile.displayName,
          lineUserId: profile.displayName,
          source: source,
          pictureUrl: profile.pictureUrl || '',
          platform: 'LIFF',
          createdAt: serverTimestamp(),
          lastSeen: Date.now()
        }, { merge: true });

        // 清除備份
        sessionStorage.removeItem('zewu_marketing_src');

        setStatus('即將進入官方帳號...');
        // 強制替換網址
        window.location.replace(LINE_OA_URL);

        // 如果 3 秒後還沒跳轉，顯示手動按鈕
        setTimeout(() => setShowManualBtn(true), 3000);

      } catch (err: any) {
        console.error('LIFF Error:', err);
        setError('系統處理中，請點擊下方按鈕加入好友');
        setShowManualBtn(true);
      }
    };

    initLiff();
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-white p-10 text-center font-sans fixed inset-0 z-[9999]">
      <div className="w-24 h-24 bg-slate-50 rounded-[40px] flex items-center justify-center mb-8 relative">
        <ZewuIcon className="w-12 h-12 text-[#54534d]" />
        <div className="absolute inset-0 border-4 border-[#54534d] border-t-transparent rounded-[40px] animate-spin opacity-20"></div>
      </div>
      
      <div className="space-y-4 max-w-xs">
        <h2 className="text-xl font-black text-slate-800 tracking-tight">澤物設計</h2>
        
        <div className="flex items-center justify-center gap-2">
          {error ? (
            <p className="text-red-400 font-bold text-sm tracking-widest">{error}</p>
          ) : (
            <>
              <Loader2 className="w-4 h-4 text-slate-300 animate-spin" />
              <p className="text-slate-400 font-bold text-xs tracking-widest uppercase">{status}</p>
            </>
          )}
        </div>

        {showManualBtn && (
          <button 
            onClick={() => window.location.href = LINE_OA_URL}
            className="w-full mt-8 bg-[#06C755] text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 animate-bounce"
          >
            <MessageCircle className="w-5 h-5 fill-current" />
            點此加入 LINE 好友
            <ExternalLink className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="absolute bottom-12 flex items-center gap-2 opacity-10">
        <MessageCircle className="w-4 h-4" />
        <span className="text-[10px] font-black uppercase tracking-[0.3em]">Official Service Bridge</span>
      </div>
    </div>
  );
};

export default JoinPage;
