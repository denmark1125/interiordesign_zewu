import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Customer, Reservation, User, LineConnection } from '../types';
import { Search, Clock, Link as LinkIcon, X, Loader2, Plus, ChevronRight, Bot, ChevronLeft, Trash2, Save, AlertTriangle, Zap, History, ClipboardCheck, User as UserIcon, CheckCircle2, Calendar as CalendarIcon, Link2Off, Edit3, UserPlus } from 'lucide-react';
import { db, lineConnectionsCollection, customersCollection, reservationsCollection, webhookLogsCollection, onSnapshot, query, orderBy, setDoc, doc, updateDoc, deleteDoc, limit } from '../services/firebase';

// Make.com Webhook URL - 用於發送 Flex 訊息
const MAKE_IMMEDIATE_WEBHOOK_URL = "https://hook.us2.make.com/fn9j1q2wlndrxf17jb5eylithejbnyv"; 

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
  const [rawLineInbox, setRawLineInbox] = useState<LineConnection[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());

  const [isProcessing, setIsProcessing] = useState(false);
  const [resDate, setResDate] = useState('');
  const [resType, setResType] = useState<string>('諮詢');
  const [customType, setCustomType] = useState(''); 

  const [showResModal, setShowResModal] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  
  const customInputRef = useRef<HTMLInputElement>(null);

  // 1. 核心數據監聽
  useEffect(() => {
    const unsubCustomers = onSnapshot(query(customersCollection, orderBy("createdAt", "desc")), 
      (snap) => {
        setCustomers(snap.docs.map(d => {
          const data = d.data();
          return { 
            id: d.id, 
            ...data,
            // 關鍵修復：確保讀取時支援多種欄位命名
            UserId: (data.UserId || data.lineUserId || "").toString().trim() 
          } as Customer;
        }));
      }
    );
    
    const unsubInbox = onSnapshot(query(lineConnectionsCollection, orderBy("timestamp", "desc")), 
      (snap) => {
        const data = snap.docs.map(d => {
          const item = d.data();
          const uid = (item.lineUserId || item.UserId || "").toString().trim();
          return { 
            id: d.id, 
            lineUserId: uid, 
            lineDisplayName: item.lineDisplayName || "未命名用戶", 
            linePictureUrl: item.linePictureUrl || '',
            isBound: item.isBound || false
          } as LineConnection;
        }).filter(i => i.lineUserId); 
        setRawLineInbox(data);
      }
    );
    
    const unsubRes = onSnapshot(query(reservationsCollection, orderBy("dateTime", "asc")), 
      (snap) => setReservations(snap.docs.map(d => {
        const data = d.data();
        return { 
            ...data,
            UserId: (data.UserId || data.lineUserId || "").toString().trim()
        } as Reservation;
      }))
    );

    const unsubLogs = onSnapshot(query(webhookLogsCollection, orderBy("timestamp", "desc"), limit(50)), 
      (snap) => setWebhookLogs(snap.docs.map(d => {
        const data = d.data();
        return {
          ...data,
          lineUserId: (data.UserId || data.lineUserId || "無 ID").toString().trim()
        } as WebhookLog;
      }))
    );
    
    return () => { unsubCustomers(); unsubInbox(); unsubRes(); unsubLogs(); };
  }, []);

  // 核心過濾邏輯：透過全局清洗過的 UserId 集合進行絕對過濾
  const lineInbox = useMemo(() => {
    const boundUserIds = new Set(customers.map(c => c.UserId).filter(id => !!id && id.length > 5));
    return rawLineInbox.filter(item => {
      const currentId = item.lineUserId.trim();
      return !item.isBound && currentId.length > 5 && !boundUserIds.has(currentId);
    });
  }, [rawLineInbox, customers]);

  // 關鍵函式：判定客戶是否已連動 LINE
  const getCleanUserId = (customer: Customer | undefined) => {
    if (!customer) return "";
    // 同時檢查 UserId 與可能殘留的 lineUserId 欄位
    const uid = (customer.UserId || (customer as any).lineUserId || "").toString().trim();
    return uid.startsWith('U') ? uid : "";
  };

  const handleUnlinkLine = async (customer: Customer) => {
    if (!window.confirm(`確定要解除「${customer.name}」的 LINE 連動？`)) return;
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, "customers", customer.id), {
        UserId: "", 
        lineUserId: "", // 同步清除備份欄位
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
    const cleanId = lineUser.lineUserId.trim();
    try {
      // 標準化綁定：確保寫入正確欄位名，並同步 lineUserId 欄位以利相容
      await updateDoc(doc(db, "customers", customer.id), {
        UserId: cleanId, 
        lineUserId: cleanId, 
        lineDisplayName: lineUser.lineDisplayName,
        linePictureUrl: lineUser.linePictureUrl || ''
      });
      await updateDoc(doc(db, "line_connections", lineUser.id), { isBound: true });
      alert(`已成功連結：${customer.name}\nID: ${cleanId.substring(0, 8)}...`);
    } catch (e) { alert("連結失敗"); } finally { setIsProcessing(false); }
  };

  const getReservationsForDay = useCallback((day: Date) => 
    reservations.filter(res => isSameDay(new Date(res.dateTime), day)), [reservations]);

  const filteredCustomers = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return customers.filter(c => c.name.toLowerCase().includes(term));
  }, [customers, searchTerm]);

  // 關鍵發送機制：將預約資料對應至 Make.com Webhook
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

    // 對應數值至 Make.com URL 參數，讓 Make 端的 Flex Message 抓取
    const params = new URLSearchParams();
    params.append('UserId', userId.trim()); 
    params.append('clientName', clientName); 
    params.append('serviceName', serviceName);
    params.append('appointmentTime', dateTime.replace('T', ' ')); 

    const finalUrl = `${MAKE_IMMEDIATE_WEBHOOK_URL}?${params.toString()}`;

    try {
      // 使用 no-cors 模式發送，避免瀏覽器攔截 CORS，Make 依然能收得到資料
      await fetch(finalUrl, { method: 'POST', mode: 'no-cors' });
      return true; 
    } catch (e) { 
      await updateDoc(doc(db, "webhook_logs", logId), { status: 'failed' });
      return false; 
    }
  };

  const inputClass = "w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-800 outline-none focus:border-slate-800 transition-all text-sm font-bold shadow-sm";
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

      {/* 連結中心 */}
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
                     <p className="text-[9px] font-mono text-emerald-500 font-black uppercase">U-ID: {item.lineUserId.substring(0, 10)}...</p>
                  </div>
               </div>
               <div className="pt-3 border-t border-slate-50">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-[9px] font-black text-slate-300 uppercase">點擊客戶進行連結</p>
                    <button onClick={() => setShowAddCustomerModal(true)} className="text-[9px] font-black text-blue-500 flex items-center gap-1 hover:text-blue-700">
                      <Plus className="w-2.5 h-2.5" /> 快速新增
                    </button>
                  </div>
                  <div className="max-h-32 overflow-y-auto pr-1 space-y-1 custom-scrollbar">
                     {customers.filter(c => !getCleanUserId(c)).map(c => (
                        <button key={c.id} onClick={() => handleBind(item, c)} className="w-full p-2.5 text-left bg-slate-50 hover:bg-slate-900 hover:text-white rounded-lg text-[11px] font-bold transition-all flex justify-between items-center group/btn">
                           {c.name} <LinkIcon className="w-3 h-3 opacity-0 group-hover/btn:opacity-100 transition-opacity"/>
                        </button>
                     ))}
                  </div>
               </div>
            </div>
          )) : <div className="col-span-full py-20 text-center text-slate-300 text-xs italic">無待連結的 LINE 帳號 (所有用戶皆已完成綁定)</div>}
        </div>
      )}

      {/* 預約日曆 */}
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
                         className={`h-16 transition-all flex flex-col items-center justify-center gap-1 relative border-2 cursor-pointer z-10 ${
                           isSelected ? 'bg-slate-900 border-slate-900 shadow-[0_10px_30px_rgba(0,0,0,0.3)] scale-110 !z-30 rounded-lg' : 'bg-white border-transparent hover:bg-slate-50'
                         }`}
                       >
                          <span className={`text-[13px] font-black ${isSelected ? 'text-white' : isToday ? 'text-blue-500' : 'text-slate-500'}`}>{i+1}</span>
                          {resCount > 0 && <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isSelected ? 'bg-white' : 'bg-slate-900'}`}/>}
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

      {/* 客戶列表 */}
      {activeTab === 'customers' && (
        <div className="space-y-4">
           <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
                 <input type="text" placeholder="搜尋客戶姓名..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={`${inputClass} pl-10 h-12 bg-white`} />
              </div>
              <button onClick={() => setShowAddCustomerModal(true)} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all hover:bg-slate-800">
                 <UserPlus className="w-5 h-5"/> 新增客戶資料
              </button>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCustomers.map(c => {
                const uid = getCleanUserId(c);
                const isValid = !!uid;
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
                              {isValid ? `已連動 (${uid.substring(0, 6)})` : '未連動 LINE'}
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

      {/* 發送日誌 */}
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

      {/* --- Modals --- */}

      {/* 建立預約 Modal */}
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
                   
                   <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">預約日期與時間</label>
                      <input 
                        type="datetime-local" 
                        value={resDate} 
                        onChange={e => setResDate(e.target.value)}
                        style={{ colorScheme: 'light' }}
                        className={`${inputClass} h-12 cursor-pointer bg-white`} 
                      />
                   </div>

                   <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">行程項目</label>
                      <div className="flex flex-wrap gap-2 mb-3">
                         {['諮詢', '丈量', '看圖', '簽約'].map(type => (
                           <button key={type} onClick={() => { setResType(type); setCustomType(''); }} className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all ${resType === type ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>{type}</button>
                         ))}
                         <button onClick={() => setResType('其他')} className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all ${resType === '其他' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>+ 其他</button>
                      </div>
                   </div>
                   
                   {resType === '其他' && (
                     <input type="text" placeholder="輸入行程內容..." value={customType} onChange={e => setCustomType(e.target.value)} className={`${inputClass} bg-emerald-50/30 border-emerald-100 h-12`} />
                   )}

                   <button onClick={async () => {
                     if(!resDate) return alert("請填寫時間");
                     setIsProcessing(true);
                     
                     // 關鍵：從最新狀態抓取 ID
                     const latestCustomer = customers.find(c => c.id === selectedCustomer.id);
                     const currentUserId = getCleanUserId(latestCustomer);
                     const rid = `res-${Date.now()}`;
                     const finalService = resType === '其他' ? customType : resType;
                     
                     const newRes: Reservation = {
                       id: rid,
                       customerId: selectedCustomer.id,
                       customerName: selectedCustomer.name,
                       UserId: currentUserId, // 確保 ID 被正確存入預約紀錄
                       dateTime: resDate,
                       type: finalService as any,
                       status: 'pending',
                       immediateNotified: false,
                       reminded: false,
                       createdAt: Date.now()
                     };

                     try {
                       await setDoc(doc(db, "reservations", rid), newRes);
                       // 觸發 Webhook，對應數值至 Make.com
                       await triggerMakeWebhook(currentUserId, newRes.customerName, newRes.dateTime, finalService);
                       setShowResModal(false); setSelectedCustomer(null);
                     } catch(e) { alert("失敗"); } finally { setIsProcessing(false); }
                   }} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-sm active:scale-95 transition-all shadow-xl">確認行程並發送通知</button>
                </div>
              )}
           </div>
        </div>
      )}

      {/* 新增客戶 Modal */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-[300] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4">
           <div className="bg-white rounded-[40px] border border-slate-200 w-full max-w-sm p-10 shadow-2xl animate-slide-up relative text-slate-900">
              <button onClick={() => setShowAddCustomerModal(false)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-900 p-2"><X className="w-6 h-6"/></button>
              <h3 className="text-xl font-black text-slate-900 mb-8 tracking-tight flex items-center gap-2">
                <UserPlus className="w-6 h-6 text-slate-800" /> 新增客戶基本資料
              </h3>
              <form onSubmit={async (e) => {
                 e.preventDefault();
                 const name = (e.currentTarget.elements.namedItem('name') as HTMLInputElement).value;
                 const phone = (e.currentTarget.elements.namedItem('phone') as HTMLInputElement).value;
                 if (!name) return alert("請輸入姓名");
                 setIsProcessing(true);
                 const id = `cust-${Date.now()}`;
                 try {
                   await setDoc(doc(db, "customers", id), { id, name, phone, tags: [], createdAt: Date.now() });
                   setShowAddCustomerModal(false);
                   alert("客戶新增成功！");
                 } catch (err) { alert("新增失敗"); } finally { setIsProcessing(false); }
              }} className="space-y-6">
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">客戶姓名 (必填)</label>
                    <input name="name" type="text" placeholder="例如：林大明" className={`${inputClass} h-14 bg-white`} required />
                 </div>
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">聯絡電話 (選填)</label>
                    <input name="phone" type="text" placeholder="09xx-xxx-xxx" className={`${inputClass} h-14 bg-white`} />
                 </div>
                 <button type="submit" disabled={isProcessing} className="w-full h-16 bg-slate-900 text-white rounded-3xl font-black shadow-xl active:scale-95 transition-all hover:bg-slate-800">
                    {isProcessing ? <Loader2 className="w-6 h-6 animate-spin mx-auto"/> : "確認儲存"}
                 </button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default CRMManager;