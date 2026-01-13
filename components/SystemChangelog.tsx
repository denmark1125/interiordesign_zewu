
import React, { useState, useEffect, useMemo } from 'react';
import { SystemLog, User } from '../types';
import { Shield, Zap, Plus, X, Clock, Trash2, Send, CheckCircle2, Loader2, Activity, UserCheck } from 'lucide-react';
import { db, systemLogsCollection, onSnapshot, query, orderBy, setDoc, doc, deleteDoc } from '../services/firebase';

const FINAL_WEBHOOK_URL = "https://hook.us2.make.com/qrp5dyybwi922p68c1rrfpr6ud8yuv9r"; 

interface SystemChangelogProps {
  currentUser: User;
  users: User[];
}

const SystemChangelog: React.FC<SystemChangelogProps> = ({ currentUser, users }) => {
  const [activeTab, setActiveTab] = useState<'logs' | 'access' | 'debug'>('logs');
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  
  // 成員活動排序 (依最後登入時間排序)
  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => (b.lastLoginAt || 0) - (a.lastLoginAt || 0));
  }, [users]);

  // 診斷工具狀態
  const [testUserId, setTestUserId] = useState('U743710776b66e57973f757271874312a');
  const [testClientName, setTestClientName] = useState('核心連線測試');
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  
  const [version, setVersion] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    const q = query(systemLogsCollection, orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(doc => doc.data() as SystemLog));
    });
    return () => unsubscribe();
  }, []);

  const handleTestWebhook = async () => {
    setTestStatus('loading');
    const params = new URLSearchParams({
      UserId: testUserId,
      clientName: testClientName,
      appointmentTime: new Date().toISOString().replace('T', ' ').substring(0, 16),
      serviceName: '連線診斷作業'
    });
    try {
      await fetch(`${FINAL_WEBHOOK_URL}?${params.toString()}`, { method: 'POST', mode: 'no-cors' });
      setTestStatus('success');
    } catch (e) {
      setTestStatus('error');
    } finally {
      setTimeout(() => setTestStatus('idle'), 3000);
    }
  };

  const handleAddLog = async () => {
    if (!version.trim() || !title.trim()) return;
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

  const translateRole = (role: string) => {
    switch(role) {
      case 'manager': return '管理員';
      case 'engineer': return '系統工程師';
      case 'employee': return '一般成員';
      default: return role;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20 max-w-5xl mx-auto font-sans">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
            <Shield className="w-8 h-8 text-slate-800" /> 工程師控制台
          </h2>
          <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-[0.2em]">系統維護與成員監控</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-sm">
            <button onClick={() => setActiveTab('logs')} className={`px-6 py-2.5 text-xs font-black rounded-xl transition-all ${activeTab === 'logs' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>系統日誌</button>
            <button onClick={() => setActiveTab('access')} className={`px-6 py-2.5 text-xs font-black rounded-xl transition-all ${activeTab === 'access' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>成員監測</button>
            <button onClick={() => setActiveTab('debug')} className={`px-6 py-2.5 text-xs font-black rounded-xl transition-all ${activeTab === 'debug' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>連線診斷</button>
        </div>
      </div>

      {activeTab === 'access' && (
        <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden animate-slide-up">
           <div className="p-8 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-black text-slate-800 text-sm flex items-center gap-3 uppercase tracking-widest">
                <Activity className="w-5 h-5 text-emerald-500" /> 成員即時登入狀態
              </h3>
              <span className="text-[10px] font-black text-slate-400 bg-white px-3 py-1 rounded-full shadow-sm border border-slate-100">
                目前活動成員：{users.length} 位
              </span>
           </div>
           <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                 <thead>
                    <tr className="text-[10px] text-slate-400 font-black uppercase tracking-widest bg-white">
                       <th className="px-8 py-5">成員名稱</th>
                       <th className="px-8 py-5">角色權限</th>
                       <th className="px-8 py-5">最後上線時間</th>
                       <th className="px-8 py-5 text-right">累計登入</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50 font-sans">
                    {sortedUsers.length > 0 ? sortedUsers.map(user => (
                       <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-8 py-5">
                             <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-black text-slate-500 text-xs shadow-inner">
                                   {user.avatarInitials}
                                </div>
                                <div>
                                   <p className="font-black text-slate-800 text-sm">{user.name}</p>
                                   <p className="text-[10px] text-slate-400 font-mono">@{user.username}</p>
                                </div>
                             </div>
                          </td>
                          <td className="px-8 py-5">
                             <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter ${user.role === 'manager' ? 'bg-slate-800 text-white' : user.role === 'engineer' ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                {translateRole(user.role)}
                             </span>
                          </td>
                          <td className="px-8 py-5">
                             {user.lastLoginAt ? (
                                <div className="flex flex-col">
                                   <span className="text-xs font-bold text-slate-600">{new Date(user.lastLoginAt).toLocaleString('zh-TW')}</span>
                                   <span className="text-[9px] text-emerald-400 font-black uppercase mt-0.5 tracking-tighter flex items-center gap-1">
                                      <UserCheck className="w-2.5 h-2.5"/> 上線紀錄正常
                                   </span>
                                </div>
                             ) : (
                                <span className="text-xs text-slate-300 italic font-bold">尚未有登入紀錄</span>
                             )}
                          </td>
                          <td className="px-8 py-5 text-right font-black text-lg tabular-nums text-slate-700">
                             {user.loginCount || 0} <span className="text-[10px] text-slate-300 ml-1">次</span>
                          </td>
                       </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="px-8 py-20 text-center">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-200 mb-2" />
                          <p className="text-slate-300 font-bold text-sm">數據同步中...</p>
                        </td>
                      </tr>
                    )}
                 </tbody>
              </table>
           </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="space-y-6 animate-slide-up">
           <div className="flex justify-end">
                <button onClick={() => setIsAdding(true)} className="bg-slate-800 text-white px-8 py-3.5 rounded-2xl flex items-center gap-2 shadow-xl font-black active:scale-95 transition-all text-xs uppercase tracking-widest"><Plus className="w-5 h-5" /> 錄入系統版本</button>
           </div>
           {isAdding && (
                <div className="bg-white p-10 rounded-[40px] shadow-2xl border border-slate-100 animate-slide-up relative space-y-6">
                    <button onClick={() => setIsAdding(false)} className="absolute top-8 right-8 text-slate-200 hover:text-slate-800 transition-colors"><X className="w-6 h-6"/></button>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <input type="text" value={version} onChange={e => setVersion(e.target.value)} placeholder="版本號 (v1.x.x)" className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-900 font-bold outline-none" />
                       <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="更動標題" className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-900 font-bold outline-none" />
                    </div>
                    <textarea rows={5} value={content} onChange={e => setContent(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-900 font-bold outline-none" placeholder="詳細內容..." />
                    <button onClick={handleAddLog} className="w-full bg-emerald-600 text-white py-5 rounded-[24px] font-black shadow-xl active:scale-95 transition-all">發布更新版本記錄</button>
                </div>
            )}
            <div className="space-y-10 relative pl-8 border-l-4 border-slate-100">
                {logs.map((log) => (
                    <div key={log.id} className="relative pl-10">
                        <div className="absolute -left-[42px] top-1 bg-white border-4 border-slate-800 w-6 h-6 rounded-full z-10 shadow-sm"></div>
                        <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-lg transition-all">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-xl font-black text-slate-800 flex items-center gap-4">
                                   <span className="bg-slate-800 text-white px-3 py-1 rounded-xl text-[10px] font-mono">{log.version}</span>
                                   {log.title}
                                </h3>
                                <button onClick={() => deleteDoc(doc(db, "system_logs", log.id))} className="text-slate-100 hover:text-red-500 transition-all"><Trash2 className="w-5 h-5"/></button>
                            </div>
                            <div className="text-slate-500 text-sm leading-relaxed whitespace-pre-wrap font-bold">{log.content}</div>
                            <div className="mt-6 pt-6 border-t border-slate-50 text-[10px] text-slate-300 font-black flex items-center gap-2 uppercase tracking-widest">
                               <Clock className="w-3.5 h-3.5" /> {new Date(log.timestamp).toLocaleString()} • 錄入人員：{log.author}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      )}

      {activeTab === 'debug' && (
        <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm animate-slide-up space-y-8">
           <div className="flex items-center gap-4">
              <div className="p-4 bg-amber-50 rounded-2xl"><Zap className="w-8 h-8 text-amber-500" /></div>
              <div>
                <h3 className="text-xl font-black text-slate-800">自動化連線診斷器</h3>
                <p className="text-sm text-slate-400 font-bold">驗證後台與 Make.com 伺服器的通訊狀態。</p>
              </div>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-8 bg-slate-50 rounded-[32px] border border-slate-100">
              <input type="text" value={testUserId} onChange={e => setTestUserId(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl p-3.5 font-mono text-xs outline-none" />
              <input type="text" value={testClientName} onChange={e => setTestClientName(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl p-3.5 font-bold text-sm outline-none" />
              <button onClick={handleTestWebhook} disabled={testStatus === 'loading'} className={`md:col-span-2 w-full py-5 rounded-[24px] font-black transition-all flex items-center justify-center gap-3 shadow-md active:scale-95 ${testStatus === 'success' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-white'}`}>
                {testStatus === 'loading' ? <Loader2 className="w-6 h-6 animate-spin"/> : testStatus === 'success' ? <CheckCircle2 className="w-6 h-6"/> : <Send className="w-5 h-5" />}
                {testStatus === 'loading' ? '正在發送測試封包...' : testStatus === 'success' ? '診斷結果：連線正常' : '執行連線診斷'}
              </button>
           </div>
        </div>
      )}
    </div>
  );
};

export default SystemChangelog;
