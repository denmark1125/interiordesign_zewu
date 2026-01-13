
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Customer, Reservation, User, LineConnection } from '../types';
import { Search, Clock, Link as LinkIcon, X, Loader2, Plus, ChevronRight, Bot, ChevronLeft, Trash2, Save, AlertTriangle, Zap, History, ClipboardCheck, User as UserIcon, CheckCircle2, Calendar as CalendarIcon, Link2Off, Edit3, UserPlus, MessageSquare, ShieldCheck, Activity, Send, Phone } from 'lucide-react';
import { db, lineConnectionsCollection, customersCollection, reservationsCollection, webhookLogsCollection, onSnapshot, query, orderBy, setDoc, doc, updateDoc, deleteDoc, limit, getDocs, where, collection } from '../services/firebase';

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
  const [customType, setCustomType] = useState(''); 

  const [showResModal, setShowResModal] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [editNameValue, setEditNameValue] = useState('');
  
  const customInputRef = useRef<HTMLInputElement>(null);

  // 1. 資料監聽
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

  // 一鍵新增客戶：從流量池新增
  const handleQuickAdd = async (lineUser: LineConnection) => {
    const name = window.prompt("請輸入客戶正式姓名：", lineUser.lineUserId);
    if (!name) return;

    setIsProcessing(true);
    try {
      const customerId = `cust-${Date.now()}`;
      const newCustomer: Customer = {
        id: customerId,
        name: name.trim(),
        phone: '',
        UserId: lineUser.UserId,
        lineUserId: lineUser.lineUserId,
        linePictureUrl: lineUser.linePictureUrl || '',
        lineConnectionId: lineUser.id,
        tags: ['來自流量池一鍵新增'],
        createdAt: Date.now()
      };

      // 1. 建立客戶資料
      await setDoc(doc(db, "customers", customerId), newCustomer);
      
      // 2. 標記流量池該筆資料為已綁定
      await updateDoc(doc(db, "line_connections", lineUser.id), {
        isBound: true
      });

      alert(`✅ 已成功將「${name}」新增為客戶並完成 LINE 連動`);
    } catch (error) {
      console.error(error);
      alert("❌ 新增失敗，請檢查網路連線");
    } finally {
      setIsProcessing(false);
    }
  };

  // 解除連動：將客戶資料中的 LINE 資訊清除，並將該 LINE ID 放回流量池
  const handleUnlinkLine = async (customer: Customer) => {
    if (!window.confirm(`確定要解除「${customer.name}」與 LINE 帳號的連動嗎？\n解除後該 LINE 帳號將會重新出現在流量池中。`)) return;

    setIsProcessing(true);
    try {
      const targetUserId = customer.UserId;

      // 1. 更新客戶資料，清除 LINE 資訊
      await updateDoc(doc(db, "customers", customer.id), {
        UserId: "",
        lineUserId: "",
        linePictureUrl: "",
        lineConnectionId: ""
      });

      // 2. 在流量池中找到該 UserId 並將其設為未綁定
      if (targetUserId) {
        const q = query(lineConnectionsCollection, where("UserId", "==", targetUserId));
        const snap = await getDocs(q);
        const updatePromises = snap.docs.map(d => updateDoc(doc(db, "line_connections", d.id), {
          isBound: false
        }));
        await Promise.all(updatePromises);
      }

      alert("✅ 已解除連動，該帳號已回到流量池");
    } catch (error) {
      console.error(error);
      alert("❌ 解除連動失敗");
    } finally {
      setIsProcessing(false);
    }
  };

  // 手動連動：將流量池帳號與現有客戶連動
  const handleBind = async (lineUser: LineConnection, customer: Customer) => {
    if (!window.confirm(`確定將 LINE 用戶「${lineUser.lineUserId}」連動到客戶「${customer.name}」？`)) return;
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, "customers", customer.id), {
        UserId: lineUser.UserId,
        lineUserId: lineUser.lineUserId,
        linePictureUrl: lineUser.linePictureUrl || '',
        lineConnectionId: lineUser.id
      });
      await updateDoc(doc(db, "line_connections", lineUser.id), { isBound: true });
      alert("✅ 連動成功！");
    } catch (e) { 
      alert("連動失敗"); 
    } finally { 
      setIsProcessing(false); 
    }
  };

  const handleDeleteCustomer = async (customer: Customer) => {
    if (!window.confirm(`確定要永久刪除客戶「${customer.name}」嗎？`)) return;
    setIsProcessing(true);
    try {
      // 刪除前如果已連動，先釋放流量池
      if (customer.UserId) {
        const q = query(lineConnectionsCollection, where("UserId", "==", customer.UserId));
        const snap = await getDocs(q);
        const updates = snap.docs.map(d => updateDoc(doc(db, "line_connections", d.id), { isBound: false }));
        await Promise.all(updates);
      }
      await deleteDoc(doc(db, "customers", customer.id));
      alert("✅ 客戶資料已刪除");
    } catch (e) {
      alert("❌ 刪除失敗");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateName = async () => {
    if (!selectedCustomer || !editNameValue.trim()) return;
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, "customers", selectedCustomer.id), { name: editNameValue.trim() });
      setShowEditNameModal(false);
      setSelectedCustomer(null);
      alert("✅ 名稱已更新");
    } catch (e) { alert("更新失敗"); } finally { setIsProcessing(false); }
  };

  const getReservationsForDay = useCallback((date: Date) => {
    return reservations.filter(res => {
      const resDate = new Date(res.dateTime);
      return resDate.getDate() === date.getDate() &&
             resDate.getMonth() === date.getMonth() &&
             resDate.getFullYear() === date.getFullYear();
    });
  }, [reservations]);

  const inputClass = "w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-800 focus:border-slate-400 focus:ring-1 focus:ring-slate-400 outline-none transition-all";
  
  return (
    <div className="space-y-6 pb-20 max-w-6xl mx-auto animate-fade-in font-sans">
      {/* 標題與分頁 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-800">案場客戶管理中心</h2>
          <p className="text-xs text-slate-500 mt-1">追蹤預約、管理名單與 LINE 連結狀態</p>
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
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${activeTab === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {tab.label}
              {tab.count ? <span className="bg-red-500 text-white px-1.5 py-0.5 rounded-full text-[9px]">{tab.count}</span> : null}
            </button>
          ))}
        </div>
      </div>

      {/* 流量池內容 */}
      {activeTab === 'inbox' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {lineInbox.length > 0 ? lineInbox.map(item => (
            <div key={item.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0">
                  {item.linePictureUrl ? <img src={item.linePictureUrl} className="w-full h-full object-cover" /> : <Bot className="w-full h-full p-2 text-slate-300" />}
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-slate-800 truncate">{item.lineUserId}</h4>
                  <p className="text-[10px] text-slate-400 font-mono truncate uppercase">UID: {item.UserId.substring(0, 12)}...</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <button 
                  onClick={() => handleQuickAdd(item)} 
                  disabled={isProcessing}
                  className="w-full bg-[#54534d] text-white py-2.5 rounded-lg font-bold text-xs flex items-center justify-center gap-2 hover:bg-slate-700 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} 一鍵新增為客戶
                </button>
                
                <div className="pt-3 mt-1 border-t border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wider">或手動連動現有客戶</p>
                  <div className="max-h-32 overflow-y-auto space-y-1 custom-scrollbar">
                    {customers.filter(c => !isLineLinked(c)).length > 0 ? customers.filter(c => !isLineLinked(c)).map(c => (
                      <button 
                        key={c.id} 
                        onClick={() => handleBind(item, c)} 
                        disabled={isProcessing}
                        className="w-full text-left px-3 py-2 bg-slate-50 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 flex justify-between items-center transition-all border border-transparent hover:border-slate-200 active:scale-95 disabled:opacity-50"
                      >
                        {c.name} <LinkIcon className="w-3 h-3 text-slate-300" />
                      </button>
                    )) : <p className="text-[10px] text-slate-300 text-center py-2 italic">目前無待綁定客戶</p>}
                  </div>
                </div>
              </div>
            </div>
          )) : (
            <div className="col-span-full py-24 text-center">
              <div className="bg-slate-50 inline-flex p-6 rounded-full mb-4 border border-slate-100"><Bot className="w-10 h-10 text-slate-300" /></div>
              <p className="text-slate-400 text-sm font-medium">流量池目前無新資料</p>
            </div>
          )}
        </div>
      )}

      {/* 客戶列表 */}
      {activeTab === 'customers' && (
        <div className="space-y-6">
          <div className="flex gap-4">
            <div className="relative flex-1 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-slate-600 transition-colors" />
              <input type="text" placeholder="搜尋客戶姓名..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={`${inputClass} pl-10 h-12`} />
            </div>
            <button onClick={() => setShowAddCustomerModal(true)} className="bg-slate-800 text-white px-6 py-3 rounded-lg font-bold text-sm shadow-sm hover:bg-slate-700 transition-all flex items-center gap-2 active:scale-95"><Plus className="w-5 h-5"/> 新增客戶</button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredCustomers.map(c => {
              const linked = isLineLinked(c);
              return (
                <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center font-bold text-slate-400 text-lg overflow-hidden shadow-inner">
                          {c.linePictureUrl ? <img src={c.linePictureUrl} className="w-full h-full object-cover" /> : c.name.charAt(0)}
                        </div>
                        {linked && (
                          <div className="absolute -top-1 -right-1 bg-white rounded-full p-1 shadow-sm border border-slate-50">
                            <Zap className="w-4 h-4 text-emerald-500 fill-current animate-pulse" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-800 truncate">{c.name}</h4>
                          <button onClick={() => { setSelectedCustomer(c); setEditNameValue(c.name); setShowEditNameModal(true); }} className="p-1 text-slate-300 hover:text-slate-600 transition-colors"><Edit3 className="w-3.5 h-3.5" /></button>
                        </div>
                        <p className="text-xs text-slate-400 font-medium truncate">{c.phone || '無電話紀錄'}</p>
                      </div>
                    </div>
                    <button onClick={() => handleDeleteCustomer(c)} disabled={isProcessing} className="text-slate-200 hover:text-red-500 transition-colors p-1 active:scale-90 disabled:opacity-50"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  
                  <div className="space-y-2 pt-4 border-t border-slate-100 mt-4">
                    <button onClick={() => onConvertToProject?.(c)} className="w-full bg-slate-50 text-slate-700 py-2.5 rounded-lg text-xs font-bold hover:bg-slate-100 border border-slate-100 transition-all active:scale-95">轉為正式案場</button>
                    {linked ? (
                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-400 text-center italic truncate">LINE: {c.lineUserId}</p>
                        <button 
                          onClick={() => handleUnlinkLine(c)} 
                          disabled={isProcessing}
                          className="w-full text-red-500 py-2 rounded-lg text-[10px] font-bold hover:bg-red-50 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                        >
                          {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2Off className="w-3.5 h-3.5" />} 解除連動
                        </button>
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-300 text-center py-2 italic font-medium">未連動 LINE 帳號</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 預約日曆 (保持不變) */}
      {activeTab === 'reservations' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-slate-400" /> {currentDate.getFullYear()} / {currentDate.getMonth() + 1}
              </h3>
              <div className="flex gap-2">
                <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-2 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"><ChevronLeft className="w-4 h-4 text-slate-500" /></button>
                <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-2 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"><ChevronRight className="w-4 h-4 text-slate-500" /></button>
                <button onClick={() => setShowResModal(true)} className="bg-slate-800 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 active:scale-95"><Plus className="w-4 h-4"/> 新增預約</button>
              </div>
            </div>
            
            <div className="grid grid-cols-7 gap-1">
              {['日', '一', '二', '三', '四', '五', '六'].map(d => <div key={d} className="text-center text-[10px] font-bold text-slate-400 py-3 uppercase tracking-widest">{d}</div>)}
              {Array.from({ length: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay() }).map((_, i) => <div key={`empty-${i}`} className="h-16" />)}
              {Array.from({ length: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate() }).map((_, i) => {
                const day = new Date(currentDate.getFullYear(), currentDate.getMonth(), i + 1);
                const isSelected = selectedDay?.toDateString() === day.toDateString();
                const resCount = getReservationsForDay(day).length;
                return (
                  <button key={i} onClick={() => setSelectedDay(new Date(day))} className={`h-16 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${isSelected ? 'bg-slate-800 text-white shadow-lg scale-[1.05] z-10' : 'bg-slate-50 hover:bg-slate-100'}`}>
                    <span className="text-xs font-bold">{i + 1}</span>
                    {resCount > 0 && <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-slate-800'}`} />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-slate-500 text-[10px] flex justify-between uppercase tracking-widest">
              行程摘要 {selectedDay && <span>{selectedDay.getMonth()+1}/{selectedDay.getDate()}</span>}
            </div>
            <div className="p-4 space-y-3 overflow-y-auto max-h-[500px] custom-scrollbar">
              {selectedDay && getReservationsForDay(selectedDay).length > 0 ? getReservationsForDay(selectedDay).map(res => (
                <div key={res.id} className="p-4 bg-white border border-slate-100 rounded-xl shadow-sm hover:border-slate-300 transition-all group relative">
                   <div className="flex justify-between items-center mb-2">
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[9px] font-bold uppercase">{res.type}</span>
                      <button onClick={() => deleteDoc(doc(db, "reservations", res.id))} className="text-slate-200 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all active:scale-90"><Trash2 className="w-3.5 h-3.5" /></button>
                   </div>
                   <h5 className="font-bold text-slate-800 text-sm">{res.customerName}</h5>
                   {res.lineUserId && (
                     <p className="text-[10px] text-slate-400 font-bold mb-2 flex items-center gap-1">
                       <Bot className="w-3 h-3"/> LINE: {res.lineUserId}
                     </p>
                   )}
                   <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold mt-2">
                      <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5"/> {new Date(res.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {res.UserId && <Zap className="w-3.5 h-3.5 text-emerald-500 fill-current" />}
                   </div>
                </div>
              )) : <div className="py-24 text-center text-slate-300 text-xs italic font-medium">選取日期查看預約</div>}
            </div>
          </div>
        </div>
      )}

      {/* 通知日誌 (保持不變) */}
      {activeTab === 'automation' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden animate-fade-in">
          <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-slate-500 text-[10px] uppercase tracking-widest">
            LINE 自動發送日誌 (近 50 筆)
          </div>
          <div className="divide-y divide-slate-100">
            {webhookLogs.length > 0 ? webhookLogs.map(log => (
              <div key={log.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors group">
                <div className="flex items-center gap-4">
                   <div className={`p-2.5 rounded-lg ${log.status === 'sent' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'} shadow-sm`}>
                      {log.status === 'sent' ? <Send className="w-4 h-4" /> : <X className="w-4 h-4" />}
                   </div>
                   <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 text-sm">{log.clientName}</span>
                        <span className="text-[9px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded uppercase font-black">{log.type}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono mt-1 uppercase tracking-tighter">UID: {log.UserId}</p>
                   </div>
                </div>
                <div className="text-right">
                   <p className={`text-[10px] font-bold uppercase tracking-widest ${log.status === 'sent' ? 'text-emerald-500' : 'text-slate-400'}`}>{log.status === 'sent' ? '已送出' : '失敗/略過'}</p>
                   <p className="text-[10px] text-slate-400 mt-1 font-medium">{new Date(log.timestamp).toLocaleString()}</p>
                </div>
              </div>
            )) : <div className="py-20 text-center text-slate-300 text-xs italic">尚無歷史紀錄</div>}
          </div>
        </div>
      )}

      {/* 彈窗區域 */}
      {showEditNameModal && (
        <div className="fixed inset-0 z-[500] bg-slate-900/10 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="bg-white rounded-xl border border-slate-200 w-full max-w-sm p-8 shadow-2xl animate-slide-up">
              <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2"><Edit3 className="w-5 h-5 text-slate-400" /> 更正案主正式名稱</h3>
              <input type="text" value={editNameValue} onChange={e => setEditNameValue(e.target.value)} className={inputClass} placeholder="輸入正式姓名..." autoFocus />
              <div className="flex gap-3 mt-8">
                 <button onClick={() => setShowEditNameModal(false)} className="flex-1 text-slate-500 text-sm font-bold hover:bg-slate-50 py-3 rounded-lg transition-colors">取消</button>
                 <button onClick={handleUpdateName} className="flex-2 bg-slate-800 text-white px-6 py-3 rounded-lg text-sm font-bold shadow-sm hover:bg-slate-700 transition-all active:scale-95">確認儲存</button>
              </div>
           </div>
        </div>
      )}

      {/* 其他彈窗 (預約、新增客戶) 保持不變，已整合 logic */}
      {showResModal && (
        <div className="fixed inset-0 z-[400] bg-slate-900/10 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="bg-white rounded-xl border border-slate-200 w-full max-w-md p-8 shadow-2xl animate-slide-up">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-lg font-bold text-slate-800">建立預約通知</h3>
                 <button onClick={() => { setShowResModal(false); setSelectedCustomer(null); }} className="hover:bg-slate-100 p-1 rounded-full transition-colors"><X className="w-5 h-5 text-slate-400"/></button>
              </div>
              
              {!selectedCustomer ? (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                   <p className="text-[10px] font-bold text-slate-400 uppercase mb-3 tracking-[0.2em]">第一步：選擇預約對象</p>
                   {customers.map(c => (
                     <button key={c.id} onClick={() => setSelectedCustomer(c)} className="w-full text-left p-4 bg-slate-50 hover:bg-slate-100 rounded-lg font-bold text-slate-700 flex justify-between items-center group transition-all border border-transparent hover:border-slate-200 active:scale-95">
                        <div className="flex flex-col">
                           <div className="flex items-center gap-2">
                              {c.name} {isLineLinked(c) && <Zap className="w-3.5 h-3.5 text-emerald-500 fill-current" />}
                           </div>
                           {c.lineUserId && <span className="text-[10px] text-slate-400 font-bold">LINE: {c.lineUserId}</span>}
                        </div>
                        <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 text-slate-400 transition-opacity" />
                     </button>
                   ))}
                </div>
              ) : (
                <div className="space-y-5 animate-fade-in">
                   <div className="p-4 bg-slate-50 rounded-xl flex justify-between items-center border border-slate-100">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-700 flex items-center gap-2"><UserIcon className="w-4 h-4 text-slate-400" /> 對象：{selectedCustomer.name}</span>
                        {selectedCustomer.lineUserId && <span className="text-[10px] text-slate-400 font-bold ml-6">連動 LINE: {selectedCustomer.lineUserId}</span>}
                      </div>
                      <button onClick={() => setSelectedCustomer(null)} className="text-[10px] font-bold text-blue-600 hover:underline">更換客戶</button>
                   </div>
                   
                   <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block tracking-widest">日期時間</label>
                      <input type="datetime-local" value={resDate} onChange={e => setResDate(e.target.value)} className={inputClass} />
                   </div>
                   
                   <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block tracking-widest">預約事項</label>
                      <div className="flex flex-wrap gap-2">
                         {['諮詢', '丈量', '看圖', '簽約'].map(type => (
                           <button key={type} onClick={() => { setResType(type); setCustomType(''); }} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${resType === type ? 'bg-slate-800 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>{type}</button>
                         ))}
                         <button onClick={() => setResType('其他')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${resType === '其他' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>+ 自定義</button>
                      </div>
                      {resType === '其他' && <input ref={customInputRef} type="text" placeholder="輸入預約名稱..." value={customType} onChange={e => setCustomType(e.target.value)} className={`${inputClass} mt-3`} autoFocus />}
                   </div>

                   <button 
                    onClick={async () => {
                      if(!resDate) return alert("請先選擇預約時間");
                      setIsProcessing(true);
                      const uid = selectedCustomer.UserId || "";
                      const luid = selectedCustomer.lineUserId || selectedCustomer.name;
                      const rid = `res-${Date.now()}`;
                      const service = resType === '其他' ? customType : resType;
                      
                      try {
                        await setDoc(doc(db, "reservations", rid), {
                          id: rid, customerId: selectedCustomer.id, customerName: selectedCustomer.name, 
                          UserId: uid, lineUserId: luid, dateTime: resDate, 
                          type: service, status: 'pending', createdAt: Date.now()
                        });
                        
                        if (uid) {
                          const params = new URLSearchParams({ UserId: uid, clientName: luid, serviceName: service, appointmentTime: resDate.replace('T', ' ') });
                          await fetch(`${MAKE_IMMEDIATE_WEBHOOK_URL}?${params.toString()}`, { method: 'POST', mode: 'no-cors' });
                          
                          const lid = `log-${Date.now()}`;
                          await setDoc(doc(db, "webhook_logs", lid), {
                            id: lid, timestamp: Date.now(), UserId: uid, clientName: selectedCustomer.name, 
                            type: service, status: 'sent', operator: currentUser.name
                          });
                        }
                        
                        setShowResModal(false); setSelectedCustomer(null);
                        alert("✅ 預約成功且已發送 LINE 通知！");
                      } catch(e) { alert("錯誤"); } finally { setIsProcessing(false); }
                    }} 
                    className="w-full bg-slate-800 text-white py-4 rounded-lg font-bold text-sm shadow-lg mt-4 hover:bg-slate-700 active:scale-95 transition-all flex justify-center items-center gap-2"
                   >
                     {isProcessing ? <Loader2 className="w-5 h-5 animate-spin"/> : <Send className="w-4 h-4" />} 確認建立並推送 LINE
                   </button>
                </div>
              )}
           </div>
        </div>
      )}

      {showAddCustomerModal && (
        <div className="fixed inset-0 z-[400] bg-slate-900/10 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="bg-white rounded-xl border border-slate-200 w-full max-w-sm p-8 shadow-2xl animate-slide-up">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-lg font-bold text-slate-800">新增客戶資料</h3>
                 <button onClick={() => setShowAddCustomerModal(false)} className="hover:bg-slate-100 p-1 rounded-full transition-colors"><X className="w-5 h-5 text-slate-400"/></button>
              </div>
              <form onSubmit={async (e) => {
                 e.preventDefault();
                 const name = (e.currentTarget.elements.namedItem('name') as HTMLInputElement).value;
                 const phone = (e.currentTarget.elements.namedItem('phone') as HTMLInputElement).value;
                 if (!name) return alert("請輸入姓名");
                 setIsProcessing(true);
                 const id = `cust-${Date.now()}`;
                 try {
                   await setDoc(doc(db, "customers", id), { id, name, phone, tags: [], createdAt: Date.now(), UserId: "", lineUserId: "" });
                   setShowAddCustomerModal(false);
                   alert("✅ 客戶已加入名單");
                 } catch (err) { alert("失敗"); } finally { setIsProcessing(false); }
              }} className="space-y-4">
                 <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block tracking-widest">案主姓名 (必填)</label>
                    <input name="name" type="text" placeholder="例如：林大明" className={inputClass} required />
                 </div>
                 <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block tracking-widest">聯絡電話</label>
                    <input name="phone" type="text" placeholder="09xx-xxx-xxx" className={inputClass} />
                 </div>
                 <button type="submit" disabled={isProcessing} className="w-full bg-slate-800 text-white py-4 rounded-lg font-bold text-sm shadow-lg mt-4 active:scale-95 transition-all">
                    {isProcessing ? <Loader2 className="w-5 h-5 animate-spin mx-auto"/> : "確認儲存"}
                 </button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default CRMManager;
