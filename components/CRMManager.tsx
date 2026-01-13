
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Customer, Reservation, User, LineConnection } from '../types';
import { Search, Clock, X, Loader2, Plus, ChevronRight, Bot, ChevronLeft, Trash2, Zap, User as UserIcon, CheckCircle2, Calendar as CalendarIcon, Link2Off, Edit3, UserPlus, Send, Activity } from 'lucide-react';
import { db, lineConnectionsCollection, customersCollection, reservationsCollection, webhookLogsCollection, onSnapshot, query, orderBy, setDoc, doc, updateDoc, deleteDoc, limit } from '../services/firebase';

const MAKE_IMMEDIATE_WEBHOOK_URL = "https://hook.us2.make.com/qrp5dyybwi922p68c1rrfpr6ud8yuv9r"; 

interface WebhookLog {
  id: string;
  timestamp: number;
  UserId: string;
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

  const [showResModal, setShowResModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    const unsubCustomers = onSnapshot(query(customersCollection, orderBy("createdAt", "desc")), (snap) => {
      setCustomers(snap.docs.map(d => ({ ...d.data(), id: d.id }) as Customer));
    });
    
    const unsubInbox = onSnapshot(query(lineConnectionsCollection, orderBy("timestamp", "desc")), (snap) => {
      const connections = snap.docs.map(d => {
        const data = d.data();
        const uid = (data.UserId || data.lineUserId || data.userId || "").toString().trim();
        return {
          id: d.id,
          UserId: uid,
          lineUserId: data.lineUserId || data.displayName || "未知用戶",
          linePictureUrl: data.linePictureUrl || '',
          isBound: data.isBound === true 
        } as LineConnection;
      }).filter(i => i.UserId.startsWith('U')); 
      setRawLineInbox(connections);
    });
    
    const unsubRes = onSnapshot(query(reservationsCollection, orderBy("dateTime", "asc")), (snap) => {
      setReservations(snap.docs.map(d => ({ ...d.data(), id: d.id }) as Reservation));
    });

    const unsubLogs = onSnapshot(query(webhookLogsCollection, orderBy("timestamp", "desc"), limit(50)), (snap) => {
      setWebhookLogs(snap.docs.map(d => ({ ...d.data(), id: d.id }) as WebhookLog));
    });
    
    return () => { unsubCustomers(); unsubInbox(); unsubRes(); unsubLogs(); };
  }, []);

  const lineInbox = useMemo(() => rawLineInbox.filter(item => !item.isBound), [rawLineInbox]);
  const filteredCustomers = useMemo(() => customers.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase())), [customers, searchTerm]);

  const isLineLinked = (customer: Customer) => {
    const uid = (customer.UserId || "").toString().trim();
    return uid.startsWith('U') && uid.length > 20;
  };

  const handleDeleteCustomer = async (customer: Customer) => {
    if (!window.confirm(`確定要永久刪除客戶「${customer.name}」嗎？`)) return;
    await deleteDoc(doc(db, "customers", customer.id));
  };

  const handleDeleteReservation = async (res: Reservation) => {
    if (!window.confirm(`⚠️ 您確定要刪除「${res.customerName}」的此筆預約行程嗎？\n此動作無法復原。`)) return;
    try {
      await deleteDoc(doc(db, "reservations", res.id));
    } catch (e) {
      alert("刪除失敗，請檢查權限");
    }
  };

  const getReservationsForDay = useCallback((date: Date) => {
    return reservations.filter(res => {
      const resDate = new Date(res.dateTime);
      return resDate.getDate() === date.getDate() &&
             resDate.getMonth() === date.getMonth() &&
             resDate.getFullYear() === date.getFullYear();
    });
  }, [reservations]);

  const inputClass = "w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-800 focus:border-slate-400 outline-none transition-all font-bold";
  
  return (
    <div className="space-y-5 pb-20 max-w-7xl mx-auto animate-fade-in font-sans">
      {/* 頁面標題與分頁 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight">案場客戶管理中心</h2>
          <p className="text-xs text-slate-400 font-bold mt-0.5 uppercase tracking-wide">追蹤預約、管理名單與 LINE 連結狀態</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-sm">
          {[
            { id: 'reservations', label: '預約日曆' },
            { id: 'customers', label: '客戶列表' },
            { id: 'inbox', label: '流量池', count: lineInbox.length },
            { id: 'automation', label: '通知紀錄' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-5 py-2 text-[13px] font-black rounded-lg transition-all flex items-center gap-2 ${activeTab === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {tab.label}
              {tab.count ? <span className="bg-red-500 text-white px-1.5 py-0.5 rounded-full text-[9px]">{tab.count}</span> : null}
            </button>
          ))}
        </div>
      </div>

      {/* 預約日曆視圖 */}
      {activeTab === 'reservations' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-slate-800 flex items-center gap-3 text-lg">
                <CalendarIcon className="w-6 h-6 text-slate-300" /> {currentDate.getFullYear()} / {currentDate.getMonth() + 1}
              </h3>
              <div className="flex gap-2">
                <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-2 hover:bg-slate-50 rounded-lg border border-slate-100"><ChevronLeft className="w-4 h-4 text-slate-500" /></button>
                <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-2 hover:bg-slate-50 rounded-lg border border-slate-100"><ChevronRight className="w-4 h-4 text-slate-500" /></button>
                <button onClick={() => setShowResModal(true)} className="bg-slate-800 text-white px-5 py-2 rounded-xl font-black text-xs flex items-center gap-2 shadow-lg ml-2"><Plus className="w-4 h-4"/> 新增預約</button>
              </div>
            </div>
            
            <div className="grid grid-cols-7 gap-2">
              {['日', '一', '二', '三', '四', '五', '六'].map(d => <div key={d} className="text-center text-[10px] font-black text-slate-300 py-2 uppercase tracking-[0.2em]">{d}</div>)}
              {Array.from({ length: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay() }).map((_, i) => <div key={`empty-${i}`} className="h-20" />)}
              {Array.from({ length: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate() }).map((_, i) => {
                const day = new Date(currentDate.getFullYear(), currentDate.getMonth(), i + 1);
                const isSelected = selectedDay?.toDateString() === day.toDateString();
                const resCount = getReservationsForDay(day).length;
                return (
                  <button key={i} onClick={() => setSelectedDay(new Date(day))} className={`h-20 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all relative ${isSelected ? 'bg-slate-800 text-white shadow-xl scale-105 z-10' : 'bg-slate-50/50 hover:bg-white hover:border-slate-200 border border-transparent'}`}>
                    <span className={`text-[15px] font-black ${isSelected ? 'text-white' : 'text-slate-800'}`}>{i + 1}</span>
                    {resCount > 0 && <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-slate-800'}`} />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden h-[540px]">
            <div className="p-5 bg-white border-b border-slate-100 font-black text-slate-400 text-[10px] flex justify-between items-center uppercase tracking-widest">
              行程摘要 <span className="text-slate-300 font-bold">{selectedDay ? `${selectedDay.getMonth()+1}/${selectedDay.getDate()}` : '--'}</span>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              {selectedDay && getReservationsForDay(selectedDay).length > 0 ? getReservationsForDay(selectedDay).map(res => (
                <div key={res.id} className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-all group relative">
                   <div className="flex justify-between items-center mb-3">
                      <span className="bg-slate-100 text-slate-500 px-3 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest">{res.type}</span>
                      <button 
                        onClick={() => handleDeleteReservation(res)} 
                        className="text-slate-200 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all active:scale-90"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                   </div>
                   <h5 className="font-black text-slate-800 text-base mb-1">{res.customerName}</h5>
                   <div className="flex justify-between items-center text-[11px] text-slate-400 font-bold mt-4 pt-4 border-t border-slate-50">
                      <span className="flex items-center gap-2"><Clock className="w-3.5 h-3.5"/> {new Date(res.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {res.UserId && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                   </div>
                </div>
              )) : (
                <div className="h-full flex flex-col items-center justify-center opacity-30">
                   <p className="text-slate-400 text-xs font-bold italic">選取日期查看</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 客戶列表視圖 */}
      {activeTab === 'customers' && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex gap-3 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
              <input type="text" placeholder="搜尋客戶姓名..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-white border border-slate-100 rounded-xl pl-12 pr-6 py-3.5 text-sm shadow-sm outline-none focus:ring-2 focus:ring-slate-100" />
            </div>
            <button className="bg-slate-800 text-white px-8 py-3.5 rounded-xl font-black text-xs flex items-center gap-2 shadow-lg active:scale-95 transition-all"><Plus className="w-4 h-4"/> 新增客戶</button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCustomers.map(customer => (
              <div key={customer.id} className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-lg transition-all flex flex-col group relative">
                <button onClick={() => handleDeleteCustomer(customer)} className="absolute top-5 right-5 text-slate-200 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"><Trash2 className="w-4 h-4"/></button>
                <div className="flex items-center gap-4 mb-8">
                   <div className="relative">
                      <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 overflow-hidden flex items-center justify-center">
                         {customer.linePictureUrl ? <img src={customer.linePictureUrl} className="w-full h-full object-cover" /> : <UserIcon className="w-6 h-6 text-slate-200" />}
                      </div>
                      {isLineLinked(customer) && (
                        <div className="absolute -top-1.5 -right-1.5 bg-emerald-100 text-emerald-500 p-1 rounded-full border-2 border-white">
                           <Zap className="w-3 h-3 fill-current" />
                        </div>
                      )}
                   </div>
                   <div>
                      <h4 className="font-black text-slate-800 text-lg flex items-center gap-2">{customer.name} <Edit3 className="w-3.5 h-3.5 text-slate-200 cursor-pointer hover:text-slate-400" /></h4>
                      <p className="text-[11px] text-slate-400 font-bold mt-0.5">{customer.phone || '無電話紀錄'}</p>
                   </div>
                </div>
                
                <div className="space-y-3">
                   <button onClick={() => onConvertToProject?.(customer)} className="w-full bg-slate-50 text-slate-800 py-3.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 hover:bg-slate-100 transition-all">
                      轉為正式案場
                   </button>
                   <div className="pt-4 border-t border-slate-50 flex flex-col items-center">
                      <p className="text-[9px] text-slate-300 font-black uppercase tracking-widest mb-2">LINE: {customer.lineUserId || '未連動'}</p>
                      <button className="text-[10px] font-black text-red-400 flex items-center gap-2 hover:underline"><Link2Off className="w-3.5 h-3.5" /> 解除連動</button>
                   </div>
                </div>
              </div>
            ))}
            {filteredCustomers.length === 0 && <div className="col-span-full py-20 text-center text-slate-300 font-black italic">尚無客戶資料</div>}
          </div>
        </div>
      )}

      {/* 流量池視圖 */}
      {activeTab === 'inbox' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
          {lineInbox.map(item => (
            <div key={item.id} className="bg-white rounded-2xl border border-slate-100 p-8 shadow-sm hover:shadow-lg transition-all flex flex-col text-center">
              <div className="flex justify-center mb-6">
                 <div className="w-20 h-20 rounded-2xl bg-slate-50 border border-slate-100 overflow-hidden shadow-inner">
                    {item.linePictureUrl ? <img src={item.linePictureUrl} className="w-full h-full object-cover" /> : <Bot className="w-full h-full p-5 text-slate-200" />}
                 </div>
              </div>
              <h4 className="font-black text-slate-800 text-xl mb-0.5">{item.lineUserId}</h4>
              <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-8">UID: {item.UserId.substring(0, 12)}...</p>
              
              <button className="w-full bg-slate-700 text-white py-4 rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all mb-6">
                <UserPlus className="w-4 h-4" /> 一鍵新增為客戶
              </button>
              
              <div className="pt-6 border-t border-slate-50">
                 <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-3">或手動連動現有客戶</p>
                 <p className="text-[11px] text-slate-200 italic font-bold">目前無待綁定客戶</p>
              </div>
            </div>
          ))}
          {lineInbox.length === 0 && <div className="col-span-full py-32 text-center text-slate-300 font-black italic">目前流量池是空的</div>}
        </div>
      )}

      {/* 通知紀錄視圖 */}
      {activeTab === 'automation' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 space-y-3 animate-fade-in">
           <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-6">LINE 自動發送日誌 (近 50 筆)</p>
           <div className="space-y-4">
              {webhookLogs.map(log => (
                <div key={log.id} className="flex items-center justify-between p-6 bg-white border border-slate-50 rounded-2xl hover:bg-slate-50 transition-all group">
                   <div className="flex items-center gap-6">
                      <div className="p-3 bg-emerald-50 rounded-xl text-emerald-500">
                         <Send className="w-5 h-5" />
                      </div>
                      <div>
                         <div className="flex items-center gap-3 mb-0.5">
                            <h4 className="text-base font-black text-slate-800">{log.clientName}</h4>
                            <span className="bg-slate-100 text-slate-400 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest">{log.type}</span>
                         </div>
                         <p className="text-[9px] text-slate-300 font-black uppercase tracking-tighter">UID: {log.UserId}</p>
                      </div>
                   </div>
                   <div className="text-right">
                      <p className="text-emerald-500 font-black text-[11px] mb-0.5">已送出</p>
                      <p className="text-[10px] text-slate-300 font-bold">{new Date(log.timestamp).toLocaleString()}</p>
                   </div>
                </div>
              ))}
              {webhookLogs.length === 0 && (
                <div className="py-24 text-center text-slate-200 font-black italic">尚無通知紀錄</div>
              )}
           </div>
        </div>
      )}

      {/* 預約彈窗 */}
      {showResModal && (
        <div className="fixed inset-0 z-[500] bg-slate-900/10 backdrop-blur-md flex items-center justify-center p-4">
           <div className="bg-white rounded-3xl border border-slate-100 w-full max-w-md p-10 shadow-2xl">
              <div className="flex justify-between items-center mb-8">
                 <h3 className="text-xl font-black text-slate-800 tracking-tight">建立預約通知</h3>
                 <button onClick={() => { setShowResModal(false); setSelectedCustomer(null); }} className="p-1.5 hover:bg-slate-50 rounded-full"><X className="w-6 h-6 text-slate-200"/></button>
              </div>
              
              {!selectedCustomer ? (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                   {customers.map(c => (
                     <button key={c.id} onClick={() => setSelectedCustomer(c)} className="w-full text-left p-6 bg-slate-50/50 hover:bg-white rounded-2xl font-black text-slate-700 flex justify-between items-center transition-all border border-transparent hover:border-slate-100">
                        <span className="text-[15px]">{c.name}</span>
                        {isLineLinked(c) && <Zap className="w-4 h-4 text-emerald-500 fill-current" />}
                        <ChevronRight className="w-5 h-5 text-slate-200" />
                     </button>
                   ))}
                </div>
              ) : (
                <div className="space-y-6 animate-fade-in">
                   <div className="p-6 bg-slate-50 rounded-2xl flex justify-between items-center">
                      <span className="text-sm font-black text-slate-800">對象：{selectedCustomer.name}</span>
                      <button onClick={() => setSelectedCustomer(null)} className="text-[11px] font-black text-blue-500 underline">切換</button>
                   </div>
                   <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block tracking-widest">日期時間設定</label>
                      <input type="datetime-local" value={resDate} onChange={e => setResDate(e.target.value)} className={inputClass} />
                   </div>
                   <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase mb-3 block tracking-widest">事項類別</label>
                      <div className="grid grid-cols-2 gap-2">
                         {['諮詢', '丈量', '看圖', '簽約'].map(type => (
                           <button key={type} onClick={() => setResType(type)} className={`py-3 rounded-xl text-xs font-black transition-all ${resType === type ? 'bg-slate-800 text-white shadow-lg' : 'bg-slate-50 text-slate-400'}`}>{type}</button>
                         ))}
                      </div>
                   </div>
                   <button 
                    onClick={async () => {
                      if(!resDate) return alert("請選擇日期");
                      setIsProcessing(true);
                      const uid = selectedCustomer.UserId || "";
                      const rid = `res-${Date.now()}`;
                      try {
                        await setDoc(doc(db, "reservations", rid), {
                          id: rid, customerId: selectedCustomer.id, customerName: selectedCustomer.name, 
                          UserId: uid, lineUserId: selectedCustomer.lineUserId || selectedCustomer.name, dateTime: resDate, 
                          type: resType, status: 'pending', createdAt: Date.now()
                        });
                        if (uid) {
                          const params = new URLSearchParams({ UserId: uid, clientName: selectedCustomer.name, serviceName: resType, appointmentTime: resDate.replace('T', ' ') });
                          await fetch(`${MAKE_IMMEDIATE_WEBHOOK_URL}?${params.toString()}`, { method: 'POST', mode: 'no-cors' });
                          const lid = `log-${Date.now()}`;
                          await setDoc(doc(db, "webhook_logs", lid), {
                            id: lid, timestamp: Date.now(), UserId: uid, clientName: selectedCustomer.name, type: resType, status: 'sent', operator: currentUser.name
                          });
                        }
                        setShowResModal(false); setSelectedCustomer(null); alert("✅ 預約已送出");
                      } catch(e) { alert("失敗"); } finally { setIsProcessing(false); }
                    }} 
                    className="w-full bg-slate-800 text-white py-5 rounded-2xl font-black text-sm shadow-xl flex justify-center items-center gap-2 active:scale-95 transition-all"
                   >
                     {isProcessing ? <Loader2 className="w-5 h-5 animate-spin"/> : <Send className="w-4 h-4" />} 確認建立
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
