import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Customer, Reservation, User, LineConnection } from '../types';
import { Search, Clock, Link as LinkIcon, X, Loader2, Plus, ChevronRight, Bot, ChevronLeft, Trash2, Save, AlertTriangle, Zap, History, ClipboardCheck, CheckCircle2, ShieldCheck, ExternalLink, Info, Database } from 'lucide-react';
import { db, lineConnectionsCollection, customersCollection, reservationsCollection, onSnapshot, query, orderBy, setDoc, doc, updateDoc, deleteDoc } from '../services/firebase';

// Make.com Webhook URL
const MAKE_IMMEDIATE_WEBHOOK_URL = "https://hook.us2.make.com/fn9j1q2wlqndrxf17jb5eylithejbnyv"; 

interface WebhookLog {
  id: string;
  timestamp: number;
  UserId: string;
  clientName: string;
  type: string;
  status: 'sent' | 'skipped' | 'error';
  url: string;
}

interface CRMManagerProps {
  currentUser: User;
  onConvertToProject?: (customer: Customer) => void;
}

const CRMManager: React.FC<CRMManagerProps> = ({ currentUser, onConvertToProject }) => {
  const [activeTab, setActiveTab] = useState<'reservations' | 'customers' | 'inbox' | 'automation'>('reservations');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [lineInbox, setLineInbox] = useState<LineConnection[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());

  const [isProcessing, setIsProcessing] = useState(false);
  const [resDate, setResDate] = useState('');
  const [resType, setResType] = useState<string>('諮詢');

  const [showResModal, setShowResModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    const unsubCustomers = onSnapshot(query(customersCollection, orderBy("createdAt", "desc")), 
      (snap) => setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)))
    );
    const unsubInbox = onSnapshot(query(lineConnectionsCollection, orderBy("timestamp", "desc")), 
      (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as LineConnection))
          .filter(i => !i.isBound && i.UserId); 
        setLineInbox(data);
      }
    );
    const unsubRes = onSnapshot(query(reservationsCollection, orderBy("dateTime", "asc")), 
      (snap) => setReservations(snap.docs.map(d => ({ id: d.id, ...d.data() } as Reservation)))
    );
    return () => { unsubCustomers(); unsubInbox(); unsubRes(); };
  }, []);

  // Fix: Added missing filteredCustomers calculation to resolve compilation error on line 244
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.phone && c.phone.includes(searchTerm)) ||
      (c.tags && c.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())))
    );
  }, [customers, searchTerm]);

  const formatForWebhook = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const triggerMakeWebhook = async (userId: string, clientName: string, dateTime: string, serviceName: string) => {
    const params = new URLSearchParams();
    params.append('UserId', userId);
    params.append('clientName', clientName);
    params.append('serviceName', serviceName);
    params.append('appointmentTime', formatForWebhook(dateTime));

    const finalUrl = `${MAKE_IMMEDIATE_WEBHOOK_URL}?${params.toString()}`;
    const isValid = userId && userId.startsWith('U');

    const newLog: WebhookLog = {
      id: `log-${Date.now()}`,
      timestamp: Date.now(),
      UserId: userId || "未綁定",
      clientName: clientName,
      type: serviceName,
      status: isValid ? 'sent' : 'skipped',
      url: finalUrl
    };

    setWebhookLogs(prev => [newLog, ...prev].slice(0, 50));

    if (!isValid) return false;

    try {
      await fetch(finalUrl, { method: 'GET', mode: 'no-cors' });
      return true; 
    } catch (e) { 
      return false; 
    }
  };

  const isSameDay = (d1: Date, d2: Date) => 
    d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();

  const getReservationsForDay = useCallback((day: Date) => 
    reservations.filter(res => isSameDay(new Date(res.dateTime), day)), [reservations]);

  const inputClass = "w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 outline-none focus:border-slate-400 transition-all text-sm font-bold";

  return (
    <div className="space-y-6 pb-20 max-w-5xl mx-auto animate-fade-in text-slate-800">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-900">案場客戶管理</h2>
          <p className="text-[10px] text-slate-400 font-black tracking-widest uppercase mt-1">CRM & Automatic Reservation</p>
        </div>
        <div className="flex gap-1">
          {[
            { id: 'reservations', label: '預約日曆' },
            { id: 'customers', label: '客戶列表' },
            { id: 'automation', label: '自動化發送日誌' }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-4 py-2 text-xs font-black transition-all ${activeTab === tab.id ? 'text-slate-900 border-b-2 border-slate-900' : 'text-slate-400 hover:text-slate-600'}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'automation' && (
        <div className="space-y-6 animate-fade-in">
           {/* Webhook Logs */}
           <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-8">
              <div className="flex items-center gap-3 mb-8">
                 <div className="p-2.5 bg-slate-900 rounded-xl"><Zap className="w-5 h-5 text-white" /></div>
                 <div>
                    <h3 className="font-black text-slate-900">發送紀錄 (Webhook Logs)</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase mt-0.5">用於診斷 Make.com 即時接收狀況</p>
                 </div>
              </div>
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                 {webhookLogs.map(log => (
                    <div key={log.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                       <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] font-black text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${log.status === 'sent' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-400'}`}>{log.status === 'sent' ? '已送出' : '跳過'}</span>
                       </div>
                       <p className="text-xs font-black text-slate-700">{log.clientName} - {log.type}</p>
                       <p className="text-[10px] font-mono text-blue-500 mt-1 truncate">ID: {log.UserId}</p>
                    </div>
                 ))}
                 {webhookLogs.length === 0 && <div className="py-10 text-center text-slate-300 text-xs italic">尚無即時發送紀錄</div>}
              </div>
           </div>

           {/* Make.com 診斷建議 */}
           <div className="bg-slate-900 rounded-[32px] p-8 text-white">
              <div className="flex items-center gap-3 mb-6">
                 <Database className="w-6 h-6 text-blue-400" />
                 <h3 className="font-black">Make.com 變數引導 (Firestore 模式)</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-4">
                    <p className="text-xs font-bold text-slate-400">如果您在 Make 裡使用「List Documents」模組，對應關係如下：</p>
                    <div className="bg-white/10 p-4 rounded-2xl font-mono text-[11px] space-y-2">
                       <p className="flex justify-between border-b border-white/5 pb-1"><span className="text-blue-300">Firestore 欄位</span> <span className="text-emerald-400">Make 藍色變數</span></p>
                       <p className="flex justify-between"><span>UserId</span> <span className="text-amber-400">record.UserId</span></p>
                       <p className="flex justify-between"><span>customerName</span> <span className="text-amber-400">record.customerName</span></p>
                       <p className="flex justify-between"><span>dateTime</span> <span className="text-amber-400">record.dateTime</span></p>
                       <p className="flex justify-between"><span>reminded</span> <span className="text-amber-400">record.reminded</span></p>
                    </div>
                    <p className="text-[10px] text-red-400 font-black flex items-start gap-2">
                       <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                       警告：千萬不要手寫 2.fields.name，必須從 Make 的彈出選單中用滑鼠點選變數！
                    </p>
                 </div>

                 <div className="bg-white/5 p-6 rounded-2xl border border-white/10 space-y-4">
                    <h4 className="text-sm font-black text-blue-400">為什麼 Run Once 才有用？</h4>
                    <p className="text-xs text-slate-300 leading-relaxed font-bold">
                       這代表您的 Webhook **並未開啟排程 (Scheduling)**。<br/><br/>
                       請在 Make 編輯器左下角找到 <span className="text-emerald-400">Scheduling OFF/ON</span> 開關，將其切換為 <span className="text-emerald-400 font-black underline">ON</span>。<br/><br/>
                       此外，LINE Flex 訊息發送失敗通常是因為「to」欄位帶入了空值。請在 Make 中加入篩選器，確保 <span className="text-blue-400">UserId 存在</span> 才發送。
                    </p>
                 </div>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'reservations' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
           <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="font-black text-sm text-slate-800">{currentDate.getFullYear()} 年 {currentDate.getMonth()+1} 月</h3>
                 <div className="flex items-center gap-4">
                    <div className="flex border border-slate-100 rounded-xl overflow-hidden">
                       <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth()-1, 1))} className="p-2 hover:bg-slate-50 border-r border-slate-100"><ChevronLeft className="w-4 h-4 text-slate-400"/></button>
                       <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth()+1, 1))} className="p-2 hover:bg-slate-50"><ChevronRight className="w-4 h-4 text-slate-400"/></button>
                    </div>
                    <button onClick={() => setShowResModal(true)} className="bg-slate-900 text-white px-6 py-2.5 rounded-2xl text-[11px] font-black flex items-center gap-2 hover:bg-slate-800 active:scale-95 transition-all"><Plus className="w-4 h-4"/> 新增行程</button>
                 </div>
              </div>
              <div className="grid grid-cols-7 gap-px bg-slate-100 border border-slate-100 rounded-[24px] overflow-hidden">
                 {['日','一','二','三','四','五','六'].map(d => <div key={d} className="bg-slate-50/50 text-center text-[10px] font-black text-slate-300 py-3 uppercase tracking-widest">{d}</div>)}
                 {Array.from({length: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay()}).map((_, i) => <div key={i} className="bg-white"/>)}
                 {Array.from({length: new Date(currentDate.getFullYear(), currentDate.getMonth()+1, 0).getDate()}).map((_, i) => {
                    const day = new Date(currentDate.getFullYear(), currentDate.getMonth(), i+1);
                    const isSelected = selectedDay && isSameDay(day, selectedDay);
                    const resCount = getReservationsForDay(day).length;
                    return (
                       <button key={i} onClick={() => setSelectedDay(day)} className={`h-20 bg-white transition-all flex flex-col items-center justify-center gap-2 relative border-2 ${isSelected ? 'border-slate-900 z-10' : 'border-transparent hover:bg-slate-50/50'}`}>
                          <span className={`text-xs font-black ${isSelected ? 'text-slate-900' : 'text-slate-400'}`}>{i+1}</span>
                          {resCount > 0 && <div className="w-1.5 h-1.5 rounded-full bg-slate-900 shadow-lg shadow-slate-300"/>}
                       </button>
                    );
                 })}
              </div>
           </div>
           
           <div className="bg-white rounded-3xl border border-slate-100 h-fit shadow-sm overflow-hidden flex flex-col">
              <div className="p-5 bg-slate-50 border-b border-slate-100 font-black text-slate-400 text-[10px] uppercase tracking-widest">本日預約行程</div>
              <div className="p-5 space-y-4 min-h-[300px] overflow-y-auto custom-scrollbar">
                 {selectedDay && getReservationsForDay(selectedDay).length > 0 ? getReservationsForDay(selectedDay).map(res => (
                   <div key={res.id} className="p-5 border border-slate-50 rounded-[24px] bg-white shadow-sm hover:shadow-md transition-all group">
                      <div className="flex justify-between items-start mb-3">
                         <span className="text-[9px] font-black text-slate-400 bg-slate-50 border border-slate-100 px-3 py-1 rounded-full uppercase tracking-widest">{res.type}</span>
                         <button onClick={() => { if(confirm("確定刪除此預約？")) deleteDoc(doc(db,"reservations",res.id))}} className="text-slate-200 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4"/></button>
                      </div>
                      <h4 className="font-bold text-sm text-slate-900">{res.customerName}</h4>
                      <p className="text-[10px] font-black text-slate-400 flex items-center gap-1.5 mt-2"><Clock className="w-3.5 h-3.5"/> {new Date(res.dateTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                   </div>
                 )) : <div className="py-20 text-center text-slate-200 text-[10px] italic font-bold">目前無任何行程</div>}
              </div>
           </div>
        </div>
      )}

      {activeTab === 'customers' && (
        <div className="space-y-4 animate-fade-in">
           <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5" />
              <input type="text" placeholder="輸入客戶姓名搜尋..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={`${inputClass} pl-12 h-14 rounded-2xl shadow-sm`} />
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredCustomers.map(c => (
                <div key={c.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative group hover:shadow-xl transition-all">
                   <div className="flex items-start justify-between mb-6">
                      <div className="flex items-center gap-4">
                         <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center font-black text-slate-300 border border-slate-100 text-lg overflow-hidden flex-shrink-0">
                            {c.linePictureUrl ? <img src={c.linePictureUrl} className="w-full h-full object-cover"/> : c.name.charAt(0)}
                         </div>
                         <div className="min-w-0">
                            <h4 className="font-black text-slate-900 truncate">{c.name}</h4>
                            <p className="text-[11px] text-slate-400 font-bold">{c.phone || '未留電話'}</p>
                         </div>
                      </div>
                      <button onClick={() => { if(confirm(`確定刪除客戶「${c.name}」？`)) deleteDoc(doc(db,"customers",c.id))}} className="p-2 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 className="w-5 h-5" /></button>
                   </div>
                   <div className="flex gap-2 pt-5 border-t border-slate-50">
                      <button onClick={() => onConvertToProject?.(c)} className="flex-1 bg-white text-slate-600 h-11 rounded-xl text-[10px] font-black border border-slate-100 hover:bg-slate-50 transition-all active:scale-95">轉案場</button>
                      <div className={`px-4 h-11 rounded-xl text-[10px] font-black border flex items-center gap-2 shadow-sm ${c.UserId ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-300 border-slate-100'}`}>
                         {c.UserId && <Zap className="w-4 h-4 fill-current animate-pulse"/>}
                         {c.UserId ? '已連線' : '未連線'}
                      </div>
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}

      {showResModal && (
        <div className="fixed inset-0 z-[300] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4">
           <div className="bg-white rounded-[40px] border border-slate-200 w-full max-w-sm p-10 shadow-2xl animate-slide-up relative">
              <button onClick={() => { setShowResModal(false); setSelectedCustomer(null); }} className="absolute top-8 right-8 text-slate-300 hover:text-slate-900 p-2"><X className="w-6 h-6"/></button>
              <h3 className="text-xl font-black text-slate-900 mb-8 tracking-tight">建立預約行程</h3>
              
              {!selectedCustomer ? (
                <div className="space-y-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                   <p className="text-[10px] font-black text-slate-400 uppercase mb-6 tracking-widest text-center">請點選一位客戶</p>
                   {customers.map(c => (
                     <button key={c.id} onClick={() => setSelectedCustomer(c)} className="w-full p-5 text-left bg-slate-50 rounded-2xl font-black text-sm text-slate-800 hover:bg-slate-900 hover:text-white transition-all flex justify-between items-center group">
                        {c.name} <ChevronRight className="w-5 h-5 opacity-20 group-hover:opacity-100"/>
                     </button>
                   ))}
                </div>
              ) : (
                <div className="space-y-6">
                   <div className="p-5 bg-slate-50 rounded-[24px] text-xs font-black text-slate-700 flex justify-between items-center border border-slate-100">
                      <span>已選客戶：{selectedCustomer.name}</span>
                      <button onClick={() => setSelectedCustomer(null)} className="text-blue-500 font-black underline">重選</button>
                   </div>
                   
                   <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase mb-3 block tracking-widest">預約時間</label>
                      <input type="datetime-local" value={resDate} onChange={e => setResDate(e.target.value)} className={`${inputClass} h-14 rounded-2xl`} />
                   </div>
                   <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase mb-3 block tracking-widest">行程項目</label>
                      <select value={resType} onChange={e => setResType(e.target.value)} className={`${inputClass} h-14 rounded-2xl`}>
                         <option value="諮詢">諮詢</option>
                         <option value="丈量">丈量</option>
                         <option value="看圖">看圖</option>
                         <option value="簽約">簽約</option>
                      </select>
                   </div>
                   
                   <button onClick={async () => {
                     if(!resDate) return alert("請輸入預約日期與時間");
                     setIsProcessing(true);
                     const latest = customers.find(c => c.id === selectedCustomer.id);
                     const currentUserId = latest?.UserId || '';
                     const rid = `res-${Date.now()}`;
                     
                     const newRes: Reservation = {
                       id: rid, 
                       customerId: selectedCustomer.id, 
                       customerName: selectedCustomer.name,
                       UserId: currentUserId, 
                       dateTime: resDate, 
                       type: resType as any, 
                       status: 'pending', 
                       createdAt: Date.now(), 
                       immediateNotified: false, 
                       reminded: false
                     };
                     
                     try {
                       await setDoc(doc(db, "reservations", rid), newRes);
                       // 強制發送 Webhook
                       await triggerMakeWebhook(currentUserId, newRes.customerName, newRes.dateTime, newRes.type);
                       
                       alert("預約成功建立！");
                       setShowResModal(false); setSelectedCustomer(null); setResDate('');
                     } catch(e) { alert("儲存失敗"); } finally { setIsProcessing(false); }
                   }} className="w-full h-16 bg-slate-900 text-white rounded-3xl font-black text-sm hover:bg-slate-800 flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl shadow-slate-200">
                      {isProcessing ? <Loader2 className="w-6 h-6 animate-spin"/> : <ClipboardCheck className="w-6 h-6" />}
                      確認並送出通知
                   </button>
                </div>
              )}
           </div>
        </div>
      )}
    </div>
  );
};

export default CRMManager;