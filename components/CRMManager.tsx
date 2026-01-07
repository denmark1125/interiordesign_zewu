
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Customer, Reservation, User, LineConnection } from '../types';
import { Search, Clock, Link as LinkIcon, X, Loader2, Plus, ChevronRight, Bot, ChevronLeft, Trash2, Save, AlertTriangle, Zap, History, ClipboardCheck, User as UserIcon, CheckCircle2, Calendar as CalendarIcon, Link2Off, Edit3 } from 'lucide-react';
import { db, lineConnectionsCollection, customersCollection, reservationsCollection, webhookLogsCollection, onSnapshot, query, orderBy, setDoc, doc, updateDoc, deleteDoc, limit } from '../services/firebase';

// Make.com Webhook URL
const MAKE_IMMEDIATE_WEBHOOK_URL = "https://hook.us2.make.com/fn9j1q2wlqndrxf17jb5eylithejbnyv"; 

interface WebhookLog {
  id: string;
  timestamp: number;
  lineUserId: string;
  clientName: string;
  type: string;
  status: 'sent' | 'skipped' | 'failed';
  operator: string;
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
  const [customType, setCustomType] = useState(''); 

  const [showResModal, setShowResModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  
  const customInputRef = useRef<HTMLInputElement>(null);

  // 1. 核心數據監聽 (強制統一為 UserId)
  useEffect(() => {
    const unsubCustomers = onSnapshot(query(customersCollection, orderBy("createdAt", "desc")), 
      (snap) => {
        setCustomers(snap.docs.map(d => {
          const data = d.data();
          return { 
            id: d.id, 
            ...data,
            UserId: data.UserId || "" 
          } as Customer;
        }));
      }
    );
    
    const unsubInbox = onSnapshot(query(lineConnectionsCollection, orderBy("timestamp", "desc")), 
      (snap) => {
        const data = snap.docs.map(d => {
          const item = d.data();
          return { 
            id: d.id, 
            lineUserId: item.lineUserId || "", 
            lineDisplayName: item.lineDisplayName || "未命名用戶", 
            linePictureUrl: item.linePictureUrl || '',
            isBound: item.isBound || false
          } as LineConnection;
        }).filter(i => !i.isBound && i.lineUserId); 
        setLineInbox(data);
      }
    );
    
    const unsubRes = onSnapshot(query(reservationsCollection, orderBy("dateTime", "asc")), 
      (snap) => setReservations(snap.docs.map(d => {
        const data = d.data();
        return { 
            ...data,
            UserId: data.UserId || ""
        } as Reservation;
      }))
    );

    const unsubLogs = onSnapshot(query(webhookLogsCollection, orderBy("timestamp", "desc"), limit(50)), 
      (snap) => setWebhookLogs(snap.docs.map(d => {
        const data = d.data();
        return {
          ...data,
          lineUserId: data.UserId || data.lineUserId || "無 ID"
        } as WebhookLog;
      }))
    );
    
    return () => { unsubCustomers(); unsubInbox(); unsubRes(); unsubLogs(); };
  }, []);

  const getCleanUserId = (customer: Customer | undefined) => {
    if (!customer) return "";
    const uid = (customer.UserId || "").toString().trim();
    return uid.startsWith('U') ? uid : "";
  };

  const handleUnlinkLine = async (customer: Customer) => {
    if (!window.confirm(`確定要解除「${customer.name}」的 LINE 連動？`)) return;
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, "customers", customer.id), {
        UserId: "", 
        lineDisplayName: "",
        linePictureUrl: ""
      });
      alert("已成功解除連動");
    } catch (e) { alert("操作失敗"); } finally { setIsProcessing(false); }
  };

  const handleDeleteCustomer = async (id: string, name: string) => {
    if (window.confirm(`確定要永久刪除客戶「${name}」？`)) {
      try { await deleteDoc(doc(db, "customers", id)); alert("已刪除該客戶"); } catch (e) { alert("失敗"); }
    }
  };

  const getDateKey = (date: Date | string | null) => {
    if (!date) return '';
    const d = new Date(date);
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  };

  const isSameDay = (d1: Date | null, d2: Date | null) => {
    return getDateKey(d1) === getDateKey(d2);
  };

  const handleDateClick = (day: Date) => {
    setSelectedDay(new Date(day.getTime()));
  };

  const openReservationModal = () => {
    if (selectedDay) {
      const year = selectedDay.getFullYear();
      const month = String(selectedDay.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDay.getDate()).padStart(2, '0');
      setResDate(`${year}-${month}-${day}T09:00`);
    } else {
      setResDate('');
    }
    setResType('諮詢');
    setCustomType('');
    setShowResModal(true);
  };

  const handleBind = async (lineUser: LineConnection, customer: Customer) => {
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, "customers", customer.id), {
        UserId: lineUser.lineUserId, 
        lineDisplayName: lineUser.lineDisplayName,
        linePictureUrl: lineUser.linePictureUrl || ''
      });
      await updateDoc(doc(db, "line_connections", lineUser.id), { isBound: true });
      alert(`已成功連結：${customer.name}`);
    } catch (e) { alert("連結失敗"); } finally { setIsProcessing(false); }
  };

  const getReservationsForDay = useCallback((day: Date) => 
    reservations.filter(res => isSameDay(new Date(res.dateTime), day)), [reservations]);

  const filteredCustomers = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return customers.filter(c => c.name.toLowerCase().includes(term));
  }, [customers, searchTerm]);

  const triggerMakeWebhook = async (userId: string, clientName: string, dateTime: string, serviceName: string) => {
    const isUIdValid = userId && userId.startsWith('U');
    const logId = `log-${Date.now()}`;
    
    const newLog: WebhookLog = {
      id: logId,
      timestamp: Date.now(),
      lineUserId: userId || "無 ID",
      clientName: clientName,
      type: serviceName,
      status: isUIdValid ? 'sent' : 'skipped',
      operator: currentUser.name
    };

    await setDoc(doc(db, "webhook_logs", logId), newLog);
    if (!isUIdValid) return false;

    const params = new URLSearchParams();
    params.append('UserId', userId); 
    params.append('clientName', clientName); 
    params.append('serviceName', serviceName);
    params.append('appointmentTime', dateTime.replace('T', ' ')); 

    const finalUrl = `${MAKE_IMMEDIATE_WEBHOOK_URL}?${params.toString()}`;

    try {
      await fetch(finalUrl, { method: 'POST', mode: 'no-cors' });
      return true; 
    } catch (e) { 
      await updateDoc(doc(db, "webhook_logs", logId), { status: 'failed' });
      return false; 
    }
  };

  const inputClass = "w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 outline-none focus:border-slate-400 transition-all text-sm font-bold";
  const cardClass = "bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative group hover:shadow-md transition-all";

  return (
    <div className="space-y-6 pb-20 max-w-5xl mx-auto animate-fade-in text-slate-800">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-900">案場客戶管理</h2>
          <p className="text-[10px] text-slate-400 font-black tracking-widest uppercase mt-1">CRM & Shared Notification System</p>
        </div>
        <div className="flex gap-1 overflow-x-auto max-w-full pb-1">
          {[
            { id: 'reservations', label: '預約日曆' },
            { id: 'customers', label: '客戶列表' },
            { id: 'inbox', label: '連結中心' },
            { id: 'automation', label: '發送日誌' }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-4 py-2 text-xs font-black whitespace-nowrap transition-all ${activeTab === tab.id ? 'text-slate-900 border-b-2 border-slate-900' : 'text-slate-400 hover:text-slate-600'}`}>
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
                     <p className="text-[9px] font-mono text-emerald-500 font-black uppercase">U-ID 待綁定</p>
                  </div>
               </div>
               <div className="pt-3 border-t border-slate-50">
                  <p className="text-[9px] font-black text-slate-300 uppercase mb-2">點擊客戶進行連結</p>
                  <div className="max-h-32 overflow-y-auto pr-1 space-y-1 custom-scrollbar">
                     {customers.filter(c => !getCleanUserId(c)).map(c => (
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
                 <h3 className="font-bold text-sm flex items-center gap-2"><CalendarIcon className="w-4 h-4 text-slate-400"/> {currentDate.getFullYear()} 年 {currentDate.getMonth()+1} 月</h3>
                 <div className="flex items-center gap-2">
                    <div className="flex border border-slate-100 rounded-lg overflow-hidden bg-slate-50">
                       <button onClick={(e) => { e.stopPropagation(); setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth()-1, 1)); }} className="p-2 hover:bg-slate-200 border-r border-slate-100 transition-colors"><ChevronLeft className="w-4 h-4 text-slate-400"/></button>
                       <button onClick={(e) => { e.stopPropagation(); setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth()+1, 1)); }} className="p-2 hover:bg-slate-200 transition-colors"><ChevronRight className="w-4 h-4 text-slate-400"/></button>
                    </div>
                    <button onClick={openReservationModal} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[11px] font-black flex items-center gap-2 hover:bg-slate-800 transition-all shadow-md active:scale-95"><Plus className="w-3 h-3"/> 新增預約</button>
                 </div>
              </div>
              <div className="grid grid-cols-7 gap-px bg-slate-100 border border-slate-100 rounded-2xl overflow-hidden shadow-inner relative">
                 {['日','一','二','三','四','五','六'].map(d => <div key={d} className="bg-white text-center text-[10px] font-black text-slate-300 py-3 uppercase">{d}</div>)}
                 {Array.from({length: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay()}).map((_, i) => <div key={`empty-${i}`} className="bg-white/40 h-16"/>)}
                 {Array.from({length: new Date(currentDate.getFullYear(), currentDate.getMonth()+1, 0).getDate()}).map((_, i) => {
                    const day = new Date(currentDate.getFullYear(), currentDate.getMonth(), i+1);
                    const isSelected = isSameDay(day, selectedDay);
                    const isToday = isSameDay(day, new Date());
                    const resCount = getReservationsForDay(day).length;
                    
                    return (
                       <button 
                         key={`day-${i}`} 
                         onClick={() => handleDateClick(day)} 
                         className={`h-16 bg-white transition-all flex flex-col items-center justify-center gap-1 relative border-2 cursor-pointer z-10 ${
                           isSelected ? 'border-slate-900 !z-30 shadow-xl scale-105 bg-slate-50' : 'border-transparent hover:bg-slate-50'
                         }`}
                       >
                          <span className={`text-[13px] font-black ${isSelected ? 'text-slate-900' : isToday ? 'text-blue-500' : 'text-slate-500'}`}>{i+1}</span>
                          {resCount > 0 && <div className="w-1.5 h-1.5 rounded-full bg-slate-900 animate-pulse"/>}
                       </button>
                    );
                 })}
              </div>
           </div>
           
           <div className="bg-white rounded-2xl border border-slate-100 flex flex-col h-fit shadow-sm overflow-hidden min-h-[400px]">
              <div className="p-4 bg-slate-50 border-b border-slate-50 font-black text-slate-400 text-[10px] uppercase tracking-widest flex items-center gap-2">
                 <Clock className="w-3 h-3"/> 本日行程 
                 {selectedDay && <span className="ml-auto text-slate-900 font-bold">{selectedDay.getMonth()+1}/{selectedDay.getDate()}</span>}
              </div>
              <div className="p-4 space-y-3 flex-1 overflow-y-auto max-h-[500px] custom-scrollbar">
                 {selectedDay && getReservationsForDay(selectedDay).length > 0 ? getReservationsForDay(selectedDay).map(res => (
                   <div key={res.id} className="p-4 border border-slate-50 rounded-xl bg-white shadow-sm group hover:border-slate-200 transition-all">
                      <div className="flex justify-between items-start mb-2">
                         <span className="text-[9px] font-black text-slate-400 border border-slate-200 px-2 py-0.5 rounded-full">{res.type}</span>
                         <button onClick={() => { if(confirm("確定刪除此預約？")) deleteDoc(doc(db,"reservations",res.id))}} className="text-slate-200 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"><Trash2 className="w-3.5 h-3.5"/></button>
                      </div>
                      <h4 className="font-bold text-sm text-slate-900">{res.customerName}</h4>
                      <p className="text-[10px] font-black text-slate-400 flex items-center gap-1 mt-1"><Clock className="w-3 h-3"/> {new Date(res.dateTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                   </div>
                 )) : <div className="text-center py-20 text-slate-200 text-[10px] italic">點選左側日期查看行程</div>}
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
              {filteredCustomers.map(c => {
                const isValid = !!getCleanUserId(c);
                return (
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
                        <button onClick={() => handleDeleteCustomer(c.id, c.name)} className="p-2 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                     </div>
                     <div className="flex flex-col gap-3 pt-4 border-t border-slate-50">
                        <button onClick={() => onConvertToProject?.(c)} className="w-full bg-white text-slate-600 py-2.5 rounded-xl text-[10px] font-black border border-slate-100 hover:bg-slate-50 transition-all active:scale-95">轉正式案場</button>
                        
                        <div className="flex flex-col gap-1 w-full">
                           <div className={`w-full px-2.5 py-2.5 rounded-xl text-[10px] font-black border flex items-center justify-center gap-1 shadow-sm ${isValid ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-300 border-slate-100'}`}>
                              {isValid && <Zap className="w-3 h-3 fill-current"/>}
                              {isValid ? '已連動 LINE' : '未連動 LINE'}
                           </div>
                           {isValid && (
                             <button onClick={() => handleUnlinkLine(c)} className="text-[9px] text-red-400 font-black hover:text-red-600 flex items-center justify-center gap-1 mt-1 transition-colors">
                                <Link2Off className="w-3 h-3" /> 解除連動
                             </button>
                           )}
                        </div>
                     </div>
                  </div>
                );
              })}
           </div>
        </div>
      )}

      {activeTab === 'automation' && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 overflow-hidden">
           <div className="flex justify-between items-center mb-8">
              <h3 className="font-black text-slate-900 flex items-center gap-2"><History className="w-5 h-5"/> 自動化發送日誌</h3>
           </div>
           <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                 <thead className="bg-slate-50 text-slate-400 font-black uppercase tracking-widest">
                    <tr>
                       <th className="px-6 py-4">時間</th>
                       <th className="px-6 py-4">建立人</th>
                       <th className="px-6 py-4">客戶 / 項目</th>
                       <th className="px-6 py-4">UserId (LINE)</th>
                       <th className="px-6 py-4 text-right">狀態</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                    {webhookLogs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                         <td className="px-6 py-4 text-slate-400 font-bold">{new Date(log.timestamp).toLocaleDateString()}</td>
                         <td className="px-6 py-4 font-bold text-slate-600">{log.operator}</td>
                         <td className="px-6 py-4 font-black text-slate-700">{log.clientName}</td>
                         <td className="px-6 py-4 font-mono text-blue-500">{log.lineUserId}</td>
                         <td className="px-6 py-4 text-right">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${log.status === 'sent' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-50 text-slate-400'}`}>
                               {log.status === 'sent' ? '發送成功' : '已跳過'}
                            </span>
                         </td>
                      </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </div>
      )}

      {showResModal && (
        <div className="fixed inset-0 z-[300] bg-slate-900/20 backdrop-blur-[4px] flex items-center justify-center p-4">
           <div className="bg-white rounded-[32px] border border-slate-200 w-full max-w-sm p-8 shadow-2xl animate-slide-up relative">
              <button onClick={() => { setShowResModal(false); setSelectedCustomer(null); }} className="absolute top-6 right-6 text-slate-300 hover:text-slate-600 p-1"><X className="w-5 h-5"/></button>
              <h3 className="text-lg font-black text-slate-800 mb-6">建立行程通知</h3>
              
              {!selectedCustomer ? (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                   <p className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">請先選擇客戶</p>
                   {customers.map(c => {
                     const isLinked = !!getCleanUserId(c);
                     return (
                       <button key={c.id} onClick={() => setSelectedCustomer(c)} className="w-full p-4 text-left bg-slate-50 rounded-2xl font-black text-sm text-slate-700 hover:bg-slate-900 hover:text-white transition-all flex justify-between items-center group">
                          <span className="flex items-center gap-2">
                             {c.name}
                             {isLinked && <Zap className="w-3 h-3 text-emerald-500 fill-current"/>}
                          </span>
                          <ChevronRight className="w-4 h-4 opacity-30 group-hover:opacity-100"/>
                       </button>
                     );
                   })}
                </div>
              ) : (
                <div className="space-y-5">
                   <div className="p-4 bg-slate-50 rounded-2xl text-[12px] font-black text-slate-600 flex justify-between items-center border border-slate-100">
                      <span>已選客戶：{selectedCustomer.name}</span>
                      <button onClick={() => setSelectedCustomer(null)} className="text-blue-500 font-black">更換</button>
                   </div>
                   {(() => {
                      const latest = customers.find(c => c.id === selectedCustomer.id);
                      const uid = getCleanUserId(latest);
                      return uid ? (
                        <div className="p-3 bg-emerald-50 rounded-xl text-[10px] font-black text-emerald-600 flex items-center gap-2 border border-emerald-100/50"><Zap className="w-4 h-4" /> 連動就緒：{uid.substring(0,8)}...</div>
                      ) : (
                        <div className="p-3 bg-amber-50 rounded-xl text-[10px] font-black text-amber-600 flex items-center gap-2 border border-amber-100/50"><AlertTriangle className="w-4 h-4" /> 客戶未連動 LINE，將僅建立本地紀錄。</div>
                      );
                   })()}
                   
                   {/* 💡 修正：增加 showPicker() 呼叫，確保點擊時 100% 彈出日曆 */}
                   <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">預約日期與時間</label>
                      <div className="relative group">
                        <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none group-focus-within:text-slate-900 transition-colors" />
                        <input 
                          type="datetime-local" 
                          value={resDate} 
                          onChange={e => setResDate(e.target.value)}
                          onClick={(e) => {
                            try { (e.target as any).showPicker(); } catch(err) { console.debug("Native picker error"); }
                          }}
                          className={`${inputClass} pl-10 h-12 cursor-pointer focus:bg-white active:bg-slate-100`} 
                        />
                      </div>
                      <p className="text-[9px] text-slate-400 mt-1 font-bold italic">若未彈出，請點擊輸入框中心區域</p>
                   </div>

                   <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">行程項目</label>
                      <div className="flex flex-wrap gap-2 mb-3">
                         {['諮詢', '丈量', '看圖', '簽約'].map(type => (
                           <button 
                             key={type} 
                             onClick={() => { setResType(type); setCustomType(''); }}
                             className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all ${resType === type ? 'bg-slate-900 text-white shadow-md scale-105' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                           >
                             {type}
                           </button>
                         ))}
                         <button 
                             onClick={() => { setResType('其他'); setTimeout(() => customInputRef.current?.focus(), 100); }}
                             className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all ${resType === '其他' ? 'bg-emerald-600 text-white shadow-md scale-105' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                           >
                             + 其他自訂
                           </button>
                      </div>
                   </div>
                   
                   {resType === '其他' && (
                     <div className="animate-slide-up">
                        <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">請輸入具體行程內容</label>
                        <div className="relative">
                           <Edit3 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                           <input 
                              ref={customInputRef}
                              type="text" 
                              placeholder="例如：交屋驗收、挑選建材..." 
                              value={customType} 
                              onChange={e => setCustomType(e.target.value)} 
                              className={`${inputClass} pl-10 border-emerald-100 bg-emerald-50/30 focus:border-emerald-500`} 
                           />
                        </div>
                     </div>
                   )}

                   <button onClick={async () => {
                     if(!resDate) return alert("請填寫預約時間");
                     if(resType === '其他' && !customType.trim()) return alert("請輸入自訂行程內容");
                     
                     setIsProcessing(true);
                     const latestCustomer = customers.find(c => c.id === selectedCustomer.id);
                     const currentUserId = getCleanUserId(latestCustomer);
                     const rid = `res-${Date.now()}`;
                     
                     const finalService = resType === '其他' ? customType.trim() : resType;
                     
                     const newRes: Reservation = {
                       id: rid, 
                       customerId: selectedCustomer.id, 
                       customerName: selectedCustomer.name,
                       UserId: currentUserId,
                       dateTime: resDate, 
                       type: finalService as any, 
                       status: 'pending', 
                       createdAt: Date.now(), 
                       immediateNotified: false, 
                       reminded: false
                     };
                     
                     try {
                       await setDoc(doc(db, "reservations", rid), newRes);
                       const ok = await triggerMakeWebhook(currentUserId, newRes.customerName, newRes.dateTime, finalService);
                       
                       if(currentUserId) {
                          if(ok) alert("預約建立成功！LINE 通知已送出。");
                          else alert("預約已建立，但 Webhook 發送異常，請檢查日誌。");
                       } else {
                          alert("本地預約已建立！(此客戶無 LINE ID)");
                       }
                       setShowResModal(false); setSelectedCustomer(null); setResDate(''); setCustomType('');
                     } catch(e) { alert("存檔失敗"); } finally { setIsProcessing(false); }
                   }} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-slate-800 flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl mt-4">
                      {isProcessing ? <Loader2 className="w-5 h-5 animate-spin"/> : <ClipboardCheck className="w-5 h-5" />}
                      確認行程並發送通知
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
