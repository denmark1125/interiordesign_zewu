
import React, { useState, useEffect } from 'react';
import { SystemLog, User } from '../types';
import { GitBranch, Plus, Save, Trash2, Calendar, Tag, X, Shield, Activity, Clock, Zap, Bug, Send, CheckCircle2, Loader2 } from 'lucide-react';
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
  
  const [testUserId, setTestUserId] = useState('U743710776b66e57973f757271874312a');
  const [testClientName, setTestClientName] = useState('工程測試人員');
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
    const params = new URLSearchParams({
      UserId: testUserId,
      clientName: testClientName,
      appointmentTime: new Date().toISOString().replace('T', ' ').substring(0, 16),
      serviceName: '核心診斷測試'
    });

    try {
      await fetch(`${FINAL_WEBHOOK_URL}?${params.toString()}`, { method: 'POST', mode: 'no-cors' });
      setTestStatus('success');
      alert("✅ 診斷封包已發送");
    } catch (e) {
      setTestStatus('error');
      alert("❌ 傳送失敗");
    } finally {
      setTimeout(() => setTestStatus('idle'), 3000);
    }
  };

  const handleAddLog = async () => {
    if (!version.trim() || !title.trim()) { alert("欄位不完整"); return; }
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

  const sortedUsers = [...users].sort((a, b) => (b.lastLoginAt || 0) - (a.lastLoginAt || 0));

  return (
    <div className="space-y-6 animate-fade-in pb-20 max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3"><Shield className="w-7 h-7 text-slate-600" /> 工程師控制台</h2>
          <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-widest">System Architecture & Automation Debug</p>
        </div>
        <div className="flex bg-slate-200/50 p-1.5 rounded-2xl border border-slate-200">
            <button onClick={() => setActiveTab('logs')} className={`px-6 py-2.5 text-xs font-black rounded-xl transition-all ${activeTab === 'logs' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>系統更新日誌</button>
            <button onClick={() => setActiveTab('access')} className={`px-6 py-2.5 text-xs font-black rounded-xl transition-all ${activeTab === 'access' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>成員活動</button>
            <button onClick={() => setActiveTab('debug')} className={`px-6 py-2.5 text-xs font-black rounded-xl transition-all ${activeTab === 'debug' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Webhook 診斷</button>
        </div>
      </div>

      {activeTab === 'debug' && (
        <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-xl animate-slide-up space-y-8">
           <div className="flex items-center gap-4">
              <div className="p-4 bg-amber-50 rounded-[20px]"><Zap className="w-8 h-8 text-amber-500" /></div>
              <div>
                <h3 className="text-xl font-black text-slate-800">Webhook 連線診斷器</h3>
                <p className="text-sm text-slate-400 font-bold">手動觸發測試封包以驗證 Make.com 接收端。</p>
              </div>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-8 bg-slate-50 rounded-[32px] border border-slate-100">
              <div>
                 <label className="text-[10px] font-black text-slate-400 uppercase mb-3 block tracking-widest">測試對象 UserId (LINE U-ID)</label>
                 <input type="text" value={testUserId} onChange={e => setTestUserId(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl p-3.5 font-mono text-xs outline-none focus:ring-2 focus:ring-slate-100" />
              </div>
              <div>
                 <label className="text-[10px] font-black text-slate-400 uppercase mb-3 block tracking-widest">測試顯示名稱</label>
                 <input type="text" value={testClientName} onChange={e => setTestClientName(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl p-3.5 font-bold text-sm outline-none focus:ring-2 focus:ring-slate-100" />
              </div>
              <div className="md:col-span-2 pt-4">
                <button onClick={handleTestWebhook} disabled={testStatus === 'loading'} className={`w-full py-5 rounded-[24px] font-black transition-all flex items-center justify-center gap-3 shadow-2xl active:scale-95 ${testStatus === 'success' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-white'}`}>
                    {testStatus === 'loading' ? <Loader2 className="w-6 h-6 animate-spin"/> : testStatus === 'success' ? <CheckCircle2 className="w-6 h-6"/> : <Send className="w-5 h-5" />}
                    {testStatus === 'loading' ? '封包傳送中...' : testStatus === 'success' ? '診斷完畢：連線正常' : '發送測試診斷封包'}
                </button>
              </div>
           </div>
           <div className="bg-slate-900 rounded-[32px] p-8 text-emerald-400 font-mono text-[11px] overflow-x-auto shadow-2xl">
              <p className="mb-2 text-slate-500">// 目前使用的整合終端 URL</p>
              <p className="break-all">{FINAL_WEBHOOK_URL}</p>
           </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="space-y-6">
           <div className="flex justify-end">
                <button onClick={() => setIsAdding(true)} className="bg-slate-800 text-white px-8 py-3.5 rounded-2xl flex items-center gap-2 shadow-xl font-black active:scale-95 transition-all"><Plus className="w-5 h-5" /> 錄入更新版本</button>
           </div>
           {isAdding && (
                <div className="bg-white p-10 rounded-[40px] shadow-2xl border border-slate-100 animate-slide-up relative space-y-6">
                    <button onClick={() => setIsAdding(false)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-800 transition-colors"><X className="w-6 h-6"/></button>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <input type="text" value={version} onChange={e => setVersion(e.target.value)} placeholder="版本號 (v1.x.x)" className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-900 font-bold outline-none" />
                       <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="更動標題" className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-900 font-bold outline-none" />
                    </div>
                    <textarea rows={5} value={content} onChange={e => setContent(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-900 font-bold outline-none" placeholder="詳細更動說明與技術細節..." />
                    <button onClick={handleAddLog} className="w-full bg-emerald-600 text-white py-5 rounded-[24px] font-black shadow-xl active:scale-95 transition-all">確認發布更新紀錄</button>
                </div>
            )}
            <div className="space-y-10 relative pl-8 border-l-4 border-slate-50">
                {logs.map((log) => (
                    <div key={log.id} className="relative pl-10 group">
                        <div className="absolute -left-[42px] top-1 bg-white border-4 border-slate-800 w-6 h-6 rounded-full z-10 shadow-lg"></div>
                        <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm hover:shadow-2xl transition-all relative">
                            <div className="flex justify-between items-start mb-6">
                                <h3 className="text-2xl font-black text-slate-800 flex items-center gap-4">
                                   <span className="bg-slate-800 text-white px-3 py-1 rounded-xl text-xs font-mono">{log.version}</span>
                                   {log.title}
                                </h3>
                            </div>
                            <div className="text-slate-600 text-base leading-relaxed whitespace-pre-wrap font-bold">{log.content}</div>
                            <div className="mt-8 pt-8 border-t border-slate-50 flex justify-between items-center text-[12px] text-slate-300 font-black">
                                <span className="flex items-center gap-2"><Clock className="w-4 h-4" /> {new Date(log.timestamp).toLocaleString()} • {log.author}</span>
                                <button onClick={() => deleteDoc(doc(db, "system_logs", log.id))} className="text-slate-100 hover:text-red-500 transition-all"><Trash2 className="w-5 h-5"/></button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      )}
    </div>
  );
};

export default SystemChangelog;
