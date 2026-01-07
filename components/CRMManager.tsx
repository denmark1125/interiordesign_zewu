
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Customer, Reservation, User, LineConnection } from '../types';
import { Search, Clock, Link as LinkIcon, X, Loader2, Plus, ChevronRight, Bot, ChevronLeft, Trash2, Zap, CheckCircle2, UserPlus, Database, Settings, CheckCircle, Calendar } from 'lucide-react';
import { db, lineConnectionsCollection, customersCollection, reservationsCollection, onSnapshot, query, orderBy, setDoc, doc, deleteDoc } from '../services/firebase';

const CRMManager: React.FC<{ currentUser: User; onConvertToProject?: (customer: Customer) => void }> = ({ currentUser, onConvertToProject }) => {
  const [activeTab, setActiveTab] = useState<'reservations' | 'customers' | 'inbox' | 'automation'>('reservations');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [lineInbox, setLineInbox] = useState<LineConnection[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Modal 狀態
  const [showResModal, setShowResModal] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [bindingLineUser, setBindingLineUser] = useState<LineConnection | null>(null);

  // 預約表單 (嚴格遵守：不含備註)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [resDate, setResDate] = useState('');
  const [resType, setResType] = useState<string>('諮詢');
  const [customResType, setCustomResType] = useState('');

  // 日曆
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());

  // 1. 資料庫即時監聽
  useEffect(() => {
    const unsubCustomers = onSnapshot(query(customersCollection, orderBy("createdAt", "desc")), 
      (snap) => setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)))
    );
    const unsubInbox = onSnapshot(query(lineConnectionsCollection, orderBy("timestamp", "desc")), 
      (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as LineConnection))
          .filter(i => i.isBound !== true && i.UserId); 
        setLineInbox(data);
      }
    );
    const unsubRes = onSnapshot(query(reservationsCollection, orderBy("dateTime", "asc")), 
      (snap) => setReservations(snap.docs.map(d => ({ id: d.id, ...d.data() } as Reservation)))
    );
    return () => { unsubCustomers(); unsubInbox(); unsubRes(); };
  }, []);

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.phone && c.phone.includes(searchTerm))
    );
  }, [customers, searchTerm]);

  // 2. 核心綁定邏輯
  const handleBindConnection = async (lineUser: LineConnection, targetCustomer: Customer) => {
    if (!lineUser?.UserId || !targetCustomer?.id) {
      alert("綁定資料異常");
      return;
    }
    setIsProcessing(true);
    try {
      const customerRef = doc(db, "customers", targetCustomer.id);
      await setDoc(customerRef, {
        UserId: lineUser.UserId,
        lineDisplayName: lineUser.lineDisplayName,
        linePictureUrl: lineUser.linePictureUrl || ''
      }, { merge: true });

      const connectionRef = doc(db, "line_connections", lineUser.id);
      await setDoc(connectionRef, { isBound: true }, { merge: true });

      setBindingLineUser(null);
      setSearchTerm('');
      alert(`✅ 綁定成功：${targetCustomer.name}`);
    } catch (err) {
      console.error(err);
      alert("綁定失敗");
    } finally { setIsProcessing(false); }
  };

  const isSameDay = (d1: Date, d2: Date) => 
    d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();

  const getReservationsForDay = useCallback((day: Date) => 
    reservations.filter(res => isSameDay(new Date(res.dateTime), day)), [reservations]);

  // 強化視覺：背景略深，邊框明顯，文字全黑
  const inputClass = "w-full block bg-slate-100/50 border-2 border-slate-200 rounded-2xl p-4 text-slate-900 outline-none focus:border-slate-800 focus:bg-white transition-all text-sm font-black cursor-pointer min-h-[58px]";

  return (
    <div className="space-y-6 pb-20 max-w-5xl mx-auto animate-fade-in text-slate-800 font-sans">
      {/* 導覽列 */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-slate-100 pb-6 px-4">
        <div className="pl-1">
          <h2 className="text-2xl font-black tracking-tight text-slate-900">案場客戶管理</h2>
          <p className="text-[10px] text-slate-400 font-black tracking-widest uppercase mt-1">CRM & Automatic Scheduling</p>
        </div>
        <div className="flex gap-4 overflow-visible pb-1">
          {[
            { id: 'reservations', label: '預約日曆' },
            { id: 'customers', label: '客戶列表' },
            { id: 'inbox', label: '連結中心' },
            { id: 'automation', label: '自動化說明' }
          ].map(tab => (
            <button 
              key={tab.id} 
              onClick={() => setActiveTab(tab.id as any)} 
              className={`px-1 py-3 text-xs font-black transition-all whitespace-nowrap relative ${activeTab === tab.id ? 'text-slate-900 border-b-2 border-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {tab.label}
              {tab.id === 'inbox' && lineInbox.length > 0 && (
                <span className="absolute -top-1.5 -right-5 flex h-5 w-5 z-[100]">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-5 w-5 bg-red-600 text-white text-[9px] items-center justify-center font-black border-2 border-white shadow-lg">{lineInbox.length}</span>
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 1. 預約日曆區域 */}
      {activeTab === 'reservations' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in px-4">
           <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="font-black text-sm text-slate-800">{currentDate.getFullYear()} 年 {currentDate.getMonth()+1} 月</h3>
                 <div className="flex items-center gap-4">
                    <div className="flex border border-slate-100 rounded-xl overflow-hidden">
                       <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth()-1, 1))} className="p-2 hover:bg-slate-50 border-r border-slate-100"><ChevronLeft className="w-4 h-4 text-slate-400"/></button>
                       <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth()+1, 1))} className="p-2 hover:bg-slate-50"><ChevronRight className="w-4 h-4 text-slate-400"/></button>
                    </div>
                    <button onClick={() => setShowResModal(true)} className="bg-slate-900 text-white px-6 py-2.5 rounded-2xl text-[11px] font-black flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg"><Plus className="w-4 h-4"/> 新增行程</button>
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
           
           <div className="bg-white rounded-3xl border border-slate-100 h-fit shadow-sm overflow-hidden flex flex-col min-h-[400px]">
              <div className="p-5 bg-slate-50 border-b border-slate-100 font-black text-slate-400 text-[10px] uppercase tracking-widest">當日預約行程</div>
              <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar">
                 {selectedDay && getReservationsForDay(selectedDay).length > 0 ? getReservationsForDay(selectedDay).map(res => (
                   <div key={res.id} className="p-5 border border-slate-50 rounded-[24px] bg-white shadow-sm hover:shadow-md transition-all group">
                      <div className="flex justify-between items-start mb-3">
                         <div className="flex items-center gap-2">
                           <span className="text-[9px] font-black text-slate-400 bg-slate-50 border border-slate-100 px-3 py-1 rounded-full uppercase tracking-widest">{res.type}</span>
                           {res.reminded && <span className="text-[8px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-black border border-emerald-100 flex items-center gap-1"><CheckCircle className="w-2.5 h-2.5"/> 提醒已送</span>}
                         </div>
                         <button onClick={() => { if(confirm("刪除此預約？")) deleteDoc(doc(db,"reservations",res.id))}} className="text-slate-200 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4"/></button>
                      </div>
                      <h4 className="font-bold text-sm text-slate-900">{res.customerName}</h4>
                      <p className="text-[10px] font-black text-slate-400 flex items-center gap-1.5 mt-2"><Clock className="w-3.5 h-3.5"/> {new Date(res.dateTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                   </div>
                 )) : <div className="py-20 text-center text-slate-200 text-[10px] italic font-black">今日尚無行程</div>}
              </div>
           </div>
        </div>
      )}

      {/* 2. 客戶列表 */}
      {activeTab === 'customers' && (
        <div className="space-y-4 animate-fade-in px-4">
           <div className="flex flex-col sm:flex-row gap-4 items-center">
              <div className="relative flex-1 w-full">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5" />
                 <input type="text" placeholder="搜尋客戶姓名或電話..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={`${inputClass} pl-12 shadow-sm`} />
              </div>
              <button onClick={() => setShowAddCustomerModal(true)} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-sm flex items-center gap-2 shadow-xl hover:bg-slate-800 transition-all active:scale-95 whitespace-nowrap">
                 <UserPlus className="w-5 h-5"/> 新增客戶
              </button>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredCustomers.map(c => (
                <div key={c.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative group hover:shadow-xl transition-all">
                   <div className="flex items-start justify-between mb-6">
                      <div className="flex items-center gap-4">
                         <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center font-black text-slate-300 border border-slate-100 overflow-hidden">
                            {c.linePictureUrl ? <img src={c.linePictureUrl} className="w-full h-full object-cover"/> : c.name.charAt(0)}
                         </div>
                         <div className="min-w-0">
                            <h4 className="font-black text-slate-900 truncate">{c.name}</h4>
                            <p className="text-[11px] text-slate-400 font-bold">{c.phone || '無電話紀錄'}</p>
                         </div>
                      </div>
                      <button onClick={() => { if(confirm(`永久刪除客戶「${c.name}」？`)) deleteDoc(doc(db,"customers",c.id))}} className="p-2 text-slate-200 hover:text-red-500 transition-all"><Trash2 className="w-5 h-5" /></button>
                   </div>
                   <div className="flex gap-2 pt-5 border-t border-slate-50">
                      <button onClick={() => onConvertToProject?.(c)} className="flex-1 bg-white text-slate-600 h-11 rounded-xl text-[10px] font-black border border-slate-100 hover:bg-slate-50 transition-all">轉為案場</button>
                      <div className={`px-4 h-11 rounded-xl text-[10px] font-black border flex items-center gap-2 transition-all ${c.UserId ? 'bg-emerald-50 text-emerald-600 border-emerald-100 shadow-sm' : 'bg-slate-50 text-slate-300 border-slate-100'}`}>
                         {c.UserId && <Zap className="w-4 h-4 fill-current animate-pulse text-emerald-500"/>}
                         {c.UserId ? 'LINE 已連通' : '未連通'}
                      </div>
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}

      {/* 3. 連結中心 */}
      {activeTab === 'inbox' && (
        <div className="space-y-6 animate-fade-in px-4">
           <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-8">
              <div className="flex items-center gap-3 mb-8">
                 <div className="p-2.5 bg-blue-600 rounded-xl shadow-lg shadow-blue-200"><LinkIcon className="w-6 h-6 text-white" /></div>
                 <div>
                    <h3 className="font-black text-slate-900 text-lg">LINE 連結中心</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">將 LINE 新好友手動配對至客戶資料</p>
                 </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {lineInbox.map(user => (
                   <div key={user.id} className="p-5 border border-slate-100 rounded-2xl bg-slate-50 flex items-center justify-between group hover:bg-white transition-all shadow-sm">
                      <div className="flex items-center gap-4">
                         <div className="w-12 h-12 rounded-2xl bg-slate-200 overflow-hidden border border-white shadow-sm">
                            {user.linePictureUrl ? <img src={user.linePictureUrl} className="w-full h-full object-cover" /> : <Bot className="w-full h-full p-2 text-slate-400" />}
                         </div>
                         <div className="min-w-0">
                            <h4 className="font-black text-sm text-slate-800 truncate">{user.lineDisplayName}</h4>
                            <p className="text-[10px] font-mono text-slate-400 truncate w-32">{user.UserId}</p>
                         </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setBindingLineUser(user)} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black flex items-center gap-2 hover:bg-blue-600 transition-all shadow-md">
                          <UserPlus className="w-3.5 h-3.5"/> 點擊連結
                        </button>
                        <button onClick={() => deleteDoc(doc(db,"line_connections",user.id))} className="p-2 text-slate-300 hover:text-red-500 rounded-xl">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                   </div>
                 ))}
                 {lineInbox.length === 0 && <p className="col-span-full py-20 text-center text-slate-300 text-sm font-black italic">目前沒有待處理的新好友</p>}
              </div>
           </div>
        </div>
      )}

      {/* 4. 自動化說明 */}
      {activeTab === 'automation' && (
        <div className="space-y-6 animate-fade-in px-4">
           <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm p-10">
              <div className="flex items-center gap-4 mb-10">
                <div className="p-3 bg-slate-900 rounded-2xl"><Settings className="w-6 h-6 text-white" /></div>
                <div>
                   <h3 className="text-xl font-black text-slate-900">Make.com 運作流程</h3>
                   <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">系統自動化提醒的核心邏輯</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                 <div className="space-y-6">
                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                       <h4 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2"><Database className="w-4 h-4 text-blue-500"/> 自動化專用欄位</h4>
                       <ul className="space-y-3">
                          <li className="flex justify-between items-center text-xs font-bold">
                             <span className="text-slate-500">日期索引</span>
                             <code className="bg-white px-2 py-1 rounded border border-slate-200 text-blue-600 font-mono">dateOnly</code>
                          </li>
                          <li className="flex justify-between items-center text-xs font-bold">
                             <span className="text-slate-500">LINE UID</span>
                             <code className="bg-white px-2 py-1 rounded border border-slate-200 text-blue-600 font-mono">UserId</code>
                          </li>
                       </ul>
                    </div>
                 </div>
                 <div className="bg-slate-900 p-8 rounded-[32px] text-white">
                    <h4 className="text-sm font-black mb-6 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400"/> 運作步驟</h4>
                    <div className="space-y-6">
                       {[
                         { step: "01", title: "排程", desc: "每天 20:00 執行一次" },
                         { step: "02", title: "搜尋", desc: "篩選明天的預約資料" },
                         { step: "03", title: "推播", desc: "透過 UserId 發送 Flex Message" },
                         { step: "04", title: "註記", desc: "更新 reminded=true 避免重發" }
                       ].map(s => (
                         <div key={s.step} className="flex gap-4">
                            <span className="text-xs font-black opacity-30">{s.step}</span>
                            <div>
                               <p className="text-xs font-black">{s.title}</p>
                               <p className="text-[10px] font-bold text-slate-400 mt-0.5">{s.desc}</p>
                            </div>
                         </div>
                       ))}
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* --- Modals --- */}

      {/* 建立預約 Modal - 強化日曆觸發 */}
      {showResModal && (
        <div className="fixed inset-0 z-[300] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4">
           <div className="bg-white rounded-[40px] border border-slate-200 w-full max-w-sm p-10 shadow-2xl animate-slide-up relative">
              <button onClick={() => { setShowResModal(false); setSelectedCustomer(null); setResDate(''); setCustomResType(''); }} className="absolute top-8 right-8 text-slate-300 hover:text-slate-900 p-2"><X className="w-6 h-6"/></button>
              <h3 className="text-xl font-black text-slate-900 mb-8 tracking-tight">建立預約行程</h3>
              
              {!selectedCustomer ? (
                <div className="space-y-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                   {customers.map(c => (
                     <button key={c.id} onClick={() => setSelectedCustomer(c)} className="w-full p-5 text-left bg-slate-50 rounded-2xl font-black text-sm text-slate-800 hover:bg-slate-900 hover:text-white transition-all flex justify-between items-center group">
                        {c.name} <ChevronRight className="w-5 h-5 opacity-20 group-hover:opacity-100"/>
                     </button>
                   ))}
                </div>
              ) : (
                <div className="space-y-8">
                   <div className="p-4 bg-slate-50 rounded-2xl text-xs font-black text-slate-700 flex justify-between items-center border border-slate-100">
                      <span>預約客戶：{selectedCustomer.name}</span>
                      <button onClick={() => setSelectedCustomer(null)} className="text-blue-500 font-black underline">更換</button>
                   </div>

                   {/* 日期選取器 - 加入強制彈出 API 與圖示 */}
                   <div className="relative">
                      <label className="text-[10px] font-black text-slate-500 uppercase mb-3 block tracking-widest flex items-center gap-2">
                        <Calendar className="w-3 h-3"/> 行程日期與時間
                      </label>
                      <input 
                        type="datetime-local" 
                        value={resDate} 
                        onChange={e => setResDate(e.target.value)} 
                        onClick={(e) => (e.currentTarget as any).showPicker?.()}
                        className={inputClass}
                        required
                      />
                      <div className="absolute right-4 bottom-4 pointer-events-none opacity-20">
                         <Clock className="w-5 h-5" />
                      </div>
                   </div>

                   <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase mb-3 block tracking-widest">行程事項</label>
                      <select value={resType} onChange={e => setResType(e.target.value)} className={`${inputClass} mb-3`}>
                         <option value="諮詢">諮詢</option>
                         <option value="丈量">丈量</option>
                         <option value="看圖">看圖</option>
                         <option value="簽約">簽約</option>
                         <option value="其他">其他 (自定義)</option>
                      </select>
                      {resType === '其他' && (
                        <input type="text" placeholder="請輸入項目名稱..." value={customResType} onChange={e => setCustomResType(e.target.value)} className={`${inputClass} border-amber-200 focus:border-amber-400`} />
                      )}
                   </div>
                   
                   <button onClick={async () => {
                     if(!resDate) return alert("請輸入預約時間");
                     setIsProcessing(true);
                     const finalType = resType === '其他' ? customResType : resType;
                     const rid = `res-${Date.now()}`;
                     const dateOnly = resDate.split('T')[0];
                     
                     // 關鍵：從客戶庫獲取最新 UserId
                     const currentCust = customers.find(c => c.id === selectedCustomer.id);
                     
                     const newRes: Reservation = {
                       id: rid, 
                       customerId: selectedCustomer.id, 
                       customerName: selectedCustomer.name,
                       UserId: currentCust?.UserId || '', 
                       dateTime: resDate, 
                       dateOnly: dateOnly, 
                       type: finalType, 
                       status: 'pending', 
                       createdAt: Date.now(), 
                       immediateNotified: false, 
                       reminded: false
                     };
                     try {
                       await setDoc(doc(db, "reservations", rid), newRes);
                       alert("✅ 預約成功！\n資料已同步，雲端自動化將在預定日前夕發送 LINE 提醒。");
                       setShowResModal(false); setSelectedCustomer(null); setResDate(''); setCustomResType('');
                     } catch(e) { alert("行程存檔失敗。"); } finally { setIsProcessing(false); }
                   }} className="w-full h-16 bg-slate-900 text-white rounded-3xl font-black shadow-xl transition-all active:scale-95">
                      {isProcessing ? <Loader2 className="w-6 h-6 animate-spin mx-auto"/> : "建立預約行程"}
                   </button>
                </div>
              )}
           </div>
        </div>
      )}

      {/* LINE 綁定配對 Modal */}
      {bindingLineUser && (
        <div className="fixed inset-0 z-[400] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
           <div className="bg-white rounded-[40px] border border-slate-200 w-full max-w-md p-10 shadow-2xl animate-slide-up relative">
              <button onClick={() => { setBindingLineUser(null); setSearchTerm(''); }} className="absolute top-8 right-8 text-slate-300 hover:text-slate-800 p-2"><X className="w-6 h-6"/></button>
              <div className="flex items-center gap-4 mb-8 pb-6 border-b border-slate-50">
                 <img src={bindingLineUser.linePictureUrl} className="w-14 h-14 rounded-2xl border border-slate-100 shadow-sm" />
                 <div>
                    <h3 className="text-lg font-black text-slate-900">連結至現有客戶名單</h3>
                    <p className="text-xs font-bold text-slate-400">LINE 名稱：{bindingLineUser.lineDisplayName}</p>
                 </div>
              </div>
              <div className="relative mb-6">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
                 <input type="text" placeholder="搜尋客戶姓名或電話..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={`${inputClass} pl-12 h-12 rounded-2xl shadow-inner`} />
              </div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                 {filteredCustomers.map(c => (
                   <button key={c.id} onClick={() => handleBindConnection(bindingLineUser, c)} disabled={isProcessing} className="w-full p-4 text-left bg-slate-50 rounded-2xl font-black text-sm hover:bg-slate-900 hover:text-white transition-all flex justify-between items-center group disabled:opacity-50">
                      <div><p>{c.name}</p><p className="text-[10px] opacity-50 font-mono">{c.phone || '無電話紀錄'}</p></div>
                      <ChevronRight className="w-4 h-4 opacity-20 group-hover:opacity-100"/>
                   </button>
                 ))}
                 {filteredCustomers.length === 0 && <p className="text-center py-10 text-slate-300 text-xs italic">查無符合客戶</p>}
              </div>
           </div>
        </div>
      )}

      {/* 新增客戶 Modal */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-[400] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4">
           <div className="bg-white rounded-[40px] border border-slate-200 w-full max-w-sm p-10 shadow-2xl animate-slide-up relative">
              <button onClick={() => setShowAddCustomerModal(false)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-900 p-2"><X className="w-6 h-6"/></button>
              <h3 className="text-xl font-black text-slate-900 mb-8 tracking-tight">新增客戶基本資料</h3>
              <form onSubmit={async (e) => {
                 e.preventDefault();
                 const name = (e.currentTarget.elements.namedItem('name') as HTMLInputElement).value;
                 const phone = (e.currentTarget.elements.namedItem('phone') as HTMLInputElement).value;
                 if (!name) return;
                 setIsProcessing(true);
                 const id = `cust-${Date.now()}`;
                 await setDoc(doc(db, "customers", id), { id, name, phone, tags: [], createdAt: Date.now() });
                 setShowAddCustomerModal(false);
                 setIsProcessing(false);
                 alert("客戶新增成功！");
              }} className="space-y-6">
                 <input name="name" type="text" placeholder="客戶姓名 (必填)" className={`${inputClass} h-14 rounded-2xl cursor-text`} required />
                 <input name="phone" type="text" placeholder="聯絡電話 (選填)" className={`${inputClass} h-14 rounded-2xl cursor-text`} />
                 <button type="submit" disabled={isProcessing} className="w-full h-16 bg-slate-900 text-white rounded-3xl font-black shadow-xl">
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
