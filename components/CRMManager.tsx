
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Customer, Reservation, User, LineConnection } from '../types';
import { Search, Clock, Link as LinkIcon, X, Loader2, Plus, ChevronRight, Bot, ChevronLeft, Trash2, Save, AlertTriangle, Zap, ListFilter, History, ClipboardCheck } from 'lucide-react';
import { db, lineConnectionsCollection, customersCollection, reservationsCollection, onSnapshot, query, orderBy, setDoc, doc, updateDoc, deleteDoc } from '../services/firebase';

// Make.com Webhook URL
const MAKE_IMMEDIATE_WEBHOOK_URL = "https://hook.us2.make.com/fn9j1q2wlqndrxf17jb5eylithejbnyv"; 

interface WebhookLog {
  id: string;
  timestamp: number;
  UserId: string;
  clientName: string;
  type: string;
  url: string;
  status: 'sent' | 'skipped';
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
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]); // 新增：Webhook 發送日誌
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());

  const [isProcessing, setIsProcessing] = useState(false);
  const [resDate, setResDate] = useState('');
  const [resType, setResType] = useState<string>('諮詢');

  const [showResModal, setShowResModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // 1. 核心數據監聽
  useEffect(() => {
    const unsubCustomers = onSnapshot(query(customersCollection, orderBy("createdAt", "desc")), 
      (snap) => setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)))
    );
    
    const unsubInbox = onSnapshot(query(lineConnectionsCollection, orderBy("timestamp", "desc")), 
      (snap) => {
        const data = snap.docs.map(d => {
          const item = d.data();
          return { 
            id: d.id, 
            UserId: item.UserId || "", 
            lineDisplayName: item.lineDisplayName || "未命名用戶", 
            linePictureUrl: item.linePictureUrl || '',
            isBound: item.isBound || false
          } as LineConnection;
        }).filter(i => !i.isBound && i.UserId); 
        setLineInbox(data);
      }
    );
    
    const unsubRes = onSnapshot(query(reservationsCollection, orderBy("dateTime", "asc")), 
      (snap) => setReservations(snap.docs.map(d => ({ id: d.id, ...d.data() } as Reservation)))
    );
    
    return () => { unsubCustomers(); unsubInbox(); unsubRes(); };
  }, []);

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

    // 建立日誌紀錄
    const newLog: WebhookLog = {
      id: `log-${Date.now()}`,
      timestamp: Date.now(),
      UserId: userId,
      clientName: clientName,
      type: serviceName,
      url: finalUrl,
      status: userId.startsWith('U') ? 'sent' : 'skipped'
    };

    setWebhookLogs(prev => [newLog, ...prev].slice(0, 50)); // 保留最近 50 筆

    if (!userId || !userId.startsWith('U')) {
      console.warn("⚠️ [跳過] UserId 無效，不進行發送。");
      return false;
    }

    try {
      await fetch(finalUrl, { method: 'POST', mode: 'no-cors' });
      return true; 
    } catch (e) { 
      return false; 
    }
  };

  const handleBind = async (lineUser: LineConnection, customer: Customer) => {
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, "customers", customer.id), {
        UserId: lineUser.UserId, 
        lineDisplayName: lineUser.lineDisplayName,
        linePictureUrl: lineUser.linePictureUrl || ''
      });
      await updateDoc(doc(db, "line_connections", lineUser.id), { isBound: true });
      alert(`已成功將 UserId 連結至「${customer.name}」`);
    } catch (e) { alert("連結失敗"); } finally { setIsProcessing(false); }
  };

  const handleDeleteCustomer = async (id: string, name: string) => {
    if (window.confirm(`確定要永久刪除客戶「${name}」？`)) {
      try { await deleteDoc(doc(db, "customers", id)); } catch (e) { alert("刪除失敗"); }
    }
  };

  const isSameDay = (d1: Date, d2: Date) => 
    d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();

  const getReservationsForDay = useCallback((day: Date) => 
    reservations.filter(res => isSameDay(new Date(res.dateTime), day)), [reservations]);

  const filteredCustomers = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return customers.filter(c => c.name.toLowerCase().includes(term));
  }, [customers, searchTerm]);

  const inputClass = "w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 outline-none focus:border-slate-400 transition-all text-sm font-bold";
  const cardClass = "bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative group hover:shadow-md transition-all";

  return (
    <div className="space-y-6 pb-20 max-w-5xl mx-auto animate-fade-in text-slate-800">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-900">案場客戶管理</h2>
          <p className="text-[10px] text-slate-400 font-black tracking-widest uppercase mt-1">CRM & Automatic Reservation System</p>
        </div>
        <div className="flex gap-1">
          {[
            { id: 'reservations', label: '預約日曆' },
            { id: 'customers', label: '客戶列表' },
            { id: 'inbox', label: '連結中心' },
            { id: 'automation', label: '發送日誌' }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-4 py-2 text-xs font-black transition-all ${activeTab === tab.id ? 'text-slate-900 border-b-2 border-slate-900' : 'text-slate-400 hover:text-slate-600'}`}>
              {tab.label}
              {tab.id === 'inbox' && lineInbox.length > 0 && <span className="ml-1.5 bg-red-500 text-white px-1.5 py-0.5 rounded-full text-[8px] font-black">{lineInbox.length}</span>}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'inbox' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {lineInbox.length > 0 ? lineInbox.map(item => (
            <div key={item.id} className={cardClass}>
               <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-slate-50 rounded-full overflow-hidden border border-slate-100 flex-shrink-0">
                     {item.linePictureUrl ? <img src={item.linePictureUrl} className="w-full h-full object-cover"/> : <Bot className="w-full h-full p-2 text-slate-200"/>}
                  </div>
                  <div className="min-w-0">
                     <h4 className="font-bold text-sm truncate">{item.lineDisplayName}</h4>
                     <p className="text-[9px] font-mono text-emerald-500 font-black uppercase">U-ID 就緒</p>
                  </div>
               </div>
               <div className="pt-3 border-t border-slate-50">
                  <p className="text-[9px] font-black text-slate-300 uppercase mb-2">點擊客戶進行連結</p>
                  <div className="max-h-32 overflow-y-auto pr-1 space-y-1 custom-scrollbar">
                     {customers.filter(c => !c.UserId).map(c => (
                        <button key={c.id} onClick={() => handleBind(item, c)} className="w-full p-2.5 text-left bg-slate-50 hover:bg-slate-900 hover:text-white rounded-lg text-[11px] font-bold transition-all flex justify-between items-center group/btn">
                           {c.name} <LinkIcon className="w-3 h-3 opacity-0 group-hover/btn:opacity-100 transition-opacity"/>
                        </button>
                     ))}
                  </div>
               </div>
            </div>
          )) : <div className="col-span-full py-20 text-center text-slate-300 text-xs italic">無待連結的 LINE 帳號</div>}
        </div>
      )}

      {activeTab === 'reservations' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="font-bold text-sm">{currentDate.getFullYear()} 年 {currentDate.getMonth()+1} 月</h3>
                 <div className="flex items-center gap-2">
                    <div className="flex border border-slate-100 rounded-lg overflow-hidden">
                       <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth()-1, 1))} className="p-1.5 hover:bg-slate-50 border-r border-slate-100"><ChevronLeft className="w-4 h-4 text-slate-400"/></button>
                       <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth()+1, 1))} className="p-1.5 hover:bg-slate-50"><ChevronRight className="w-4 h-4 text-slate-400"/></button>
                    </div>
                    <button onClick={() => setShowResModal(true)} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[11px] font-black flex items-center gap-2 hover:bg-slate-800 transition-all"><Plus className="w-3 h-3"/> 新增預約</button>
                 </div>
              </div>
              <div className="grid grid-cols-7 gap-px bg-slate-100 border border-slate-100 rounded-2xl overflow-hidden">
                 {['日','一','二','三','四','五','六'].map(d => <div key={d} className="bg-white text-center text-[9px] font-black text-slate-300 py-2">{d}</div>)}
                 {Array.from({length: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay()}).map((_, i) => <div key={i} className="bg-white"/>)}
                 {Array.from({length: new Date(currentDate.getFullYear(), currentDate.getMonth()+1, 0).getDate()}).map((_, i) => {
                    const day = new Date(currentDate.getFullYear(), currentDate.getMonth(), i+1);
                    const isSelected = selectedDay && isSameDay(day, selectedDay);
                    const resCount = getReservationsForDay(day).length;
                    return (
                       <button key={i} onClick={() => setSelectedDay(day)} className={`h-16 bg-white transition-all flex flex-col items-center justify-center gap-1 relative border-2 ${isSelected ? 'border-slate-900 z-10 shadow-lg' : 'border-transparent hover:bg-slate-50/50'}`}>
                          <span className={`text-xs font-black ${isSelected ? 'text-slate-900' : 'text-slate-500'}`}>{i+1}</span>
                          {resCount > 0 && <div className="w-1.5 h-1.5 rounded-full bg-slate-900 animate-pulse"/>}
                       </button>
                    );
                 })}
              </div>
           </div>
           
           <div className="bg-white rounded-2xl border border-slate-100 flex flex-col h-fit shadow-sm overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-50 font-black text-slate-400 text-[10px] uppercase tracking-widest">本日行程</div>
              <div className="p-4 space-y-3 min-h-[300px] overflow-y-auto max-h-[500px] custom-scrollbar">
                 {selectedDay && getReservationsForDay(selectedDay).length > 0 ? getReservationsForDay(selectedDay).map(res => (
                   <div key={res.id} className="p-4 border border-slate-50 rounded-xl bg-white shadow-sm group">
                      <div className="flex justify-between items-start mb-2">
                         <span className="text-[9px] font-black text-slate-400 border border-slate-200 px-2 py-0.5 rounded-full">{res.type}</span>
                         <button onClick={() => { if(confirm("確定刪除此預約？")) deleteDoc(doc(db,"reservations",res.id))}} className="text-slate-200 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"><Trash2 className="w-3.5 h-3.5"/></button>
                      </div>
                      <h4 className="font-bold text-sm text-slate-900">{res.customerName}</h4>
                      <p className="text-[10px] font-black text-slate-400 flex items-center gap-1 mt-1"><Clock className="w-3 h-3"/> {new Date(res.dateTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                   </div>
                 )) : <div className="text-center py-20 text-slate-200 text-[10px] italic">今日無行程</div>}
              </div>
           </div>
        </div>
      )}

      {activeTab === 'customers' && (
        <div className="space-y-4">
           <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
              <input type="text" placeholder="搜尋客戶姓名..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={`${inputClass} pl-10`} />
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCustomers.map(c => (
                <div key={c.id} className={cardClass}>
                   <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center font-black text-slate-300 border border-slate-100 text-sm overflow-hidden flex-shrink-0">
                            {c.linePictureUrl ? <img src={c.linePictureUrl} className="w-full h-full object-cover"/> : c.name.charAt(0)}
                         </div>
                         <div className="min-w-0">
                            <h4 className="font-black text-sm truncate text-slate-900">{c.name}</h4>
                            <p className="text-[10px] text-slate-400 font-mono font-bold">{c.phone || '無電話'}</p>
                         </div>
                      </div>
                      <button onClick={() => handleDeleteCustomer(c.id, c.name)} className="p-2 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                   </div>
                   <div className="flex gap-2 pt-4 border-t border-slate-50">
                      <button onClick={() => onConvertToProject?.(c)} className="flex-1 bg-white text-slate-600 py-2 rounded-xl text-[10px] font-black border border-slate-100 hover:bg-slate-50 transition-all active:scale-95">轉正式案場</button>
                      <div className={`px-2.5 py-2 rounded-xl text-[10px] font-black border flex items-center gap-1 shadow-sm ${c.UserId ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-300 border-slate-100'}`}>
                         {c.UserId && <Zap className="w-3 h-3 fill-current"/>}
                         {c.UserId ? '已連動 LINE' : '未連動 LINE'}
                      </div>
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}

      {activeTab === 'automation' && (
        <div className="space-y-6">
           <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 overflow-hidden">
              <div className="flex items-center gap-3 mb-8">
                 <div className="p-2.5 bg-slate-900 rounded-xl">
                    <History className="w-5 h-5 text-white" />
                 </div>
                 <div>
                    <h3 className="font-black text-slate-900">自動化發送日誌</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Notification Logs (Real-time)</p>
                 </div>
              </div>

              <div className="border border-slate-50 rounded-2xl overflow-hidden overflow-x-auto">
                 <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-400 font-black uppercase tracking-widest">
                       <tr>
                          <th className="px-6 py-4">時間</th>
                          <th className="px-6 py-4">對象</th>
                          <th className="px-6 py-4">項目</th>
                          <th className="px-6 py-4">UserId (Key: UserId)</th>
                          <th className="px-6 py-4 text-right">狀態</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                       {webhookLogs.length > 0 ? webhookLogs.map(log => (
                         <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 font-bold text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</td>
                            <td className="px-6 py-4 font-black text-slate-700">{log.clientName}</td>
                            <td className="px-6 py-4 font-bold text-slate-500">{log.type}</td>
                            <td className="px-6 py-4 font-mono font-bold text-[10px] text-blue-500">{log.UserId}</td>
                            <td className="px-6 py-4 text-right">
                               <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${log.status === 'sent' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}>
                                  {log.status === 'sent' ? '發送成功' : '已跳過'}
                               </span>
                            </td>
                         </tr>
                       )) : (
                         <tr>
                            <td colSpan={5} className="py-20 text-center italic text-slate-200">當前工作階段尚無發送紀錄</td>
                         </tr>
                       )}
                    </tbody>
                 </table>
              </div>
              
              <div className="mt-8 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                 <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 mt-1 flex-shrink-0" />
                    <div>
                       <p className="text-sm font-bold text-slate-700 mb-1">診斷輔助</p>
                       <p className="text-xs font-bold text-slate-400 leading-relaxed">如果日誌顯示「發送成功」但 Make.com 沒收到資料，請檢查 Webhook 網址是否正確。系統發送時嚴格遵循 <code className="bg-white px-1 rounded text-slate-600 border">UserId</code> 這個 Key，並使用 URL Query 模式避開所有網路阻礙。</p>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {showResModal && (
        <div className="fixed inset-0 z-[300] bg-slate-900/20 backdrop-blur-[4px] flex items-center justify-center p-4">
           <div className="bg-white rounded-[32px] border border-slate-200 w-full max-w-sm p-8 shadow-2xl animate-slide-up relative">
              <button onClick={() => { setShowResModal(false); setSelectedCustomer(null); }} className="absolute top-6 right-6 text-slate-300 hover:text-slate-600 p-1"><X className="w-5 h-5"/></button>
              <h3 className="text-lg font-black text-slate-800 mb-6">建立預約行程</h3>
              
              {!selectedCustomer ? (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                   <p className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">請先選擇客戶</p>
                   {customers.map(c => (
                     <button key={c.id} onClick={() => setSelectedCustomer(c)} className="w-full p-4 text-left bg-slate-50 rounded-2xl font-black text-sm text-slate-700 hover:bg-slate-900 hover:text-white transition-all flex justify-between items-center group">
                        {c.name} <ChevronRight className="w-4 h-4 opacity-30 group-hover:opacity-100"/>
                     </button>
                   ))}
                </div>
              ) : (
                <div className="space-y-5">
                   <div className="p-4 bg-slate-50 rounded-2xl text-[12px] font-black text-slate-600 flex justify-between items-center border border-slate-100">
                      <span>已選客戶：{selectedCustomer.name}</span>
                      <button onClick={() => setSelectedCustomer(null)} className="text-blue-500 font-black">更換</button>
                   </div>
                   {(() => {
                      const latest = customers.find(c => c.id === selectedCustomer.id);
                      const uid = latest?.UserId || '';
                      return uid.startsWith('U') ? (
                        <div className="p-3 bg-emerald-50 rounded-xl text-[10px] font-black text-emerald-600 flex items-center gap-2 border border-emerald-100/50"><Zap className="w-4 h-4" /> 連結就緒，系統將記錄發送過程。</div>
                      ) : (
                        <div className="p-3 bg-amber-50 rounded-xl text-[10px] font-black text-amber-600 flex items-center gap-2 border border-amber-100/50"><AlertTriangle className="w-4 h-4" /> 客戶未連結 LINE，僅會建立本地預約。</div>
                      );
                   })()}
                   <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">預約時間</label>
                      <input type="datetime-local" value={resDate} onChange={e => setResDate(e.target.value)} className={inputClass} />
                   </div>
                   <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">行程項目</label>
                      <select value={resType} onChange={e => setResType(e.target.value)} className={inputClass}>
                         <option value="諮詢">諮詢</option>
                         <option value="丈量">丈量</option>
                         <option value="看圖">看圖</option>
                         <option value="簽約">簽約</option>
                      </select>
                   </div>
                   <button onClick={async () => {
                     if(!resDate) return alert("請填寫預約時間");
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
                       // 不管有沒有 U 開頭，我們都嘗試呼叫發送邏輯，以便日誌記錄
                       const ok = await triggerMakeWebhook(currentUserId, newRes.customerName, newRes.dateTime, newRes.type);
                       
                       if(currentUserId.startsWith('U')) {
                          if(ok) alert("預約已建立並已送出通知！請在「發送日誌」查看紀錄。");
                          else alert("預約已建立，但發送通知至 Make 失敗，請檢查網路連線。");
                       } else {
                          alert("預約已成功建立！(此客戶未連結 LINE)");
                       }
                       setShowResModal(false); setSelectedCustomer(null); setResDate('');
                     } catch(e) { alert("系統存檔失敗，請確認資料庫權限。"); } finally { setIsProcessing(false); }
                   }} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-slate-800 flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl">
                      {isProcessing ? <Loader2 className="w-5 h-5 animate-spin"/> : <ClipboardCheck className="w-5 h-5" />}
                      建立預約並發送通知
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
