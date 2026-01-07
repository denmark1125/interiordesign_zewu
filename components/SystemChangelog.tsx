
import React, { useState, useEffect } from 'react';
import { SystemLog, User, Reservation } from '../types';
import { GitBranch, Plus, Save, Trash2, Calendar, Tag, X, Shield, Activity, Clock, Zap, Bug, Send, CheckCircle2, Loader2 } from 'lucide-react';
import { db, systemLogsCollection, onSnapshot, query, orderBy, setDoc, doc, deleteDoc } from '../services/firebase';

const MAKE_IMMEDIATE_WEBHOOK_URL = "https://hook.us2.make.com/fn9j1q2wlqndrxf17jb5eylithejbnyv"; 

interface SystemChangelogProps {
  currentUser: User;
  users: User[];
}

const SystemChangelog: React.FC<SystemChangelogProps> = ({ currentUser, users }) => {
  const [activeTab, setActiveTab] = useState<'logs' | 'access' | 'debug'>('logs');
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  
  const [testUserId, setTestUserId] = useState('U1234567890abcdef');
  const [testClientName, setTestClientName] = useState('測試人員');
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  
  const [version, setVersion] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    const q = query(systemLogsCollection, orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedLogs = snapshot.docs.map(doc => doc.data() as SystemLog);
      setLogs(fetchedLogs);
    });
    return () => unsubscribe();
  }, []);

  const handleTestWebhook = async () => {
    setTestStatus('loading');
    
    // 💡 終極方案：使用 URLSearchParams 並掛載在網址上
    const params = new URLSearchParams();
    params.append('UserId', testUserId);
    params.append('clientName', testClientName);
    params.append('appointmentTime', new Date().toISOString());
    params.append('serviceName', '診斷測試');

    const finalUrl = `${MAKE_IMMEDIATE_WEBHOOK_URL}?${params.toString()}`;

    try {
      await fetch(finalUrl, {
        method: 'POST',
        mode: 'no-cors'
      });
      setTestStatus('success');
      alert("測試資料已送出 (使用 URL Query String 模式)");
    } catch (e) {
      setTestStatus('error');
      alert("傳送失敗");
    }
  };

  const handleAddLog = async () => {
    if (!version.trim() || !title.trim()) { alert("請填寫必填欄位"); return; }
    const newLog: SystemLog = {
      id: `log-${Date.now()}`,
      timestamp: Date.now(),
      version: version.trim(),
      title: title.trim(),
      content: content.trim(),
      author: currentUser.name
    };
    await setDoc(doc(db, "system_logs", newLog.id), newLog);
    setIsAdding(false);
    setVersion(''); setTitle(''); setContent('');
  };

  const handleDeleteLog = async (id: string) => {
    if (!window.confirm("確定刪除？")) return;
    try {
      await deleteDoc(doc(db, "system_logs", id));
    } catch (error) {
      alert("刪除失敗");
    }
  };

  const sortedUsers = [...users].sort((a, b) => (b.lastLoginAt || 0) - (a.lastLoginAt || 0));

  return (
    <div className="space-y-6 animate-fade-in pb-20 max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2"><Shield className="w-6 h-6 text-slate-600" /> 工程師控制台</h2>
        </div>
        <div className="flex bg-slate-200/50 p-1.5 rounded-2xl border border-slate-200">
            <button onClick={() => setActiveTab('logs')} className={`px-5 py-2.5 text-xs font-black rounded-xl transition-all ${activeTab === 'logs' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>日誌</button>
            <button onClick={() => setActiveTab('access')} className={`px-5 py-2.5 text-xs font-black rounded-xl transition-all ${activeTab === 'access' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>活動</button>
            <button onClick={() => setActiveTab('debug')} className={`px-5 py-2.5 text-xs font-black rounded-xl transition-all ${activeTab === 'debug' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>測試</button>
        </div>
      </div>

      {activeTab === 'debug' && (
        <div className="bg-white p-10 rounded-[40px] border border-slate-200 shadow-xl animate-slide-up">
           <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-black flex items-center gap-2 text-slate-800"><Zap className="w-6 h-6 text-amber-500" /> Webhook 連線診斷</h3>
           </div>
           <p className="text-xs font-bold text-slate-400 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100 italic">
             注意：此模式會將資料掛在網址後方發送，能 100% 避開 CORS 錯誤並確保 Make.com 將 UserId 識別為獨立變數。
           </p>
           <div className="space-y-4 mb-6">
              <div>
                 <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">測試 UserId</label>
                 <input type="text" value={testUserId} onChange={e => setTestUserId(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-mono text-xs outline-none" />
              </div>
              <div>
                 <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">測試客戶名</label>
                 <input type="text" value={testClientName} onChange={e => setTestClientName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-xs outline-none" />
              </div>
           </div>
           <button onClick={handleTestWebhook} disabled={testStatus === 'loading'} className={`w-full py-5 rounded-3xl font-black transition-all flex items-center justify-center gap-3 ${testStatus === 'success' ? 'bg-green-600 text-white' : 'bg-slate-800 text-white'}`}>
              {testStatus === 'loading' ? <Loader2 className="w-5 h-5 animate-spin"/> : testStatus === 'success' ? <CheckCircle2 className="w-5 h-5"/> : <Send className="w-5 h-5" />}
              {testStatus === 'loading' ? '正在發送...' : testStatus === 'success' ? '發送成功！' : '發送 URL 參數測試'}
           </button>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="space-y-6">
           <div className="flex justify-end">
                <button onClick={() => setIsAdding(true)} className="bg-slate-800 text-white px-8 py-3.5 rounded-2xl flex items-center gap-2 shadow-xl font-black active:scale-95 transition-all"><Plus className="w-5 h-5" /> 新增更新紀錄</button>
           </div>
           {isAdding && (
                <div className="bg-white p-10 rounded-[40px] shadow-2xl border border-slate-200 animate-slide-up relative">
                    <button onClick={() => setIsAdding(false)} className="absolute top-8 right-8 text-slate-400 hover:text-slate-800"><X className="w-6 h-6"/></button>
                    <input type="text" value={version} onChange={e => setVersion(e.target.value)} placeholder="v1.x.x" className="w-full bg-slate-50 border border-slate-300 rounded-2xl p-4 text-slate-900 font-bold mb-4" />
                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="標題" className="w-full bg-slate-50 border border-slate-300 rounded-2xl p-4 text-slate-900 font-bold mb-4" />
                    <textarea rows={5} value={content} onChange={e => setContent(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-2xl p-4 text-slate-900 font-bold mb-6" placeholder="詳細內容..." />
                    <button onClick={handleAddLog} className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black shadow-xl">儲存</button>
                </div>
            )}
            <div className="space-y-8 relative pl-6 border-l-2 border-slate-100">
                {logs.map((log) => (
                    <div key={log.id} className="relative pl-8 group">
                        <div className="absolute -left-[35px] top-1 bg-white border-4 border-slate-800 w-5 h-5 rounded-full z-10 shadow-lg"></div>
                        <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl transition-all relative">
                            <h3 className="text-xl font-black text-slate-800 flex items-center gap-3 mb-2">
                               <span className="bg-slate-800 text-white px-2 py-0.5 rounded text-[10px] font-mono">{log.version}</span>
                               {log.title}
                            </h3>
                            <div className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap font-bold">{log.content}</div>
                            <div className="mt-6 pt-6 border-t border-slate-100 flex justify-between items-center text-[11px] text-slate-400 font-black">
                                <span>{new Date(log.timestamp).toLocaleString()} • {log.author}</span>
                                <button onClick={() => handleDeleteLog(log.id)} className="text-slate-200 hover:text-red-500 transition-all"><Trash2 className="w-4 h-4"/></button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      )}

      {activeTab === 'access' && (
        <div className="bg-white rounded-[40px] shadow-sm border border-slate-200 overflow-hidden animate-slide-up">
              <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-400 text-[11px] uppercase font-black tracking-widest">
                      <tr>
                          <th className="px-8 py-6">成員</th>
                          <th className="px-8 py-6">最後活動</th>
                          <th className="px-8 py-6 text-right">次數</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {sortedUsers.map(user => (
                          <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-8 py-6 font-black text-slate-900">{user.name}</td>
                              <td className="px-8 py-6 text-xs text-slate-500 font-bold">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : '未登入'}</td>
                              <td className="px-8 py-6 text-right font-mono font-black text-slate-900">{user.loginCount || 0}</td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      )}
    </div>
  );
};

export default SystemChangelog;
