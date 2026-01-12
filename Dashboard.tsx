
import React, { useMemo, useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ProjectBudget, LedgerEntry, TripLog } from '../types';
import { CURRENCY, ICONS } from '../constants';
import { generateAuditAnalysis, AuditResult } from '../services/gemini';

interface DashboardProps {
  projects: ProjectBudget[];
  ledger: LedgerEntry[];
  tripLogs: TripLog[];
}

const Dashboard: React.FC<DashboardProps> = ({ projects, ledger, tripLogs }) => {
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);

  const stats = useMemo(() => {
    const revenue = ledger
      .filter(l => l.category === 'REVENUE' || l.category === 'INVOICE')
      .reduce((acc, curr) => acc + curr.credit, 0);
    
    const expense = ledger
      .filter(l => l.category !== 'REVENUE' && l.category !== 'INVOICE' && l.debit > 0)
      .reduce((acc, curr) => acc + curr.debit, 0);

    const totalKm = tripLogs.reduce((acc, curr) => {
      if (curr.kmEnd && curr.kmStart) return acc + (curr.kmEnd - curr.kmStart);
      return acc;
    }, 0);

    return { revenue, expense, margin: revenue - expense, trips: tripLogs.length, distance: totalKm };
  }, [ledger, tripLogs]);

  const runAudit = async () => {
    if (isAuditing) return;
    setIsAuditing(true);
    const result = await generateAuditAnalysis(
      ledger.slice(0, 15), 
      tripLogs.slice(0, 10),
      stats,
      projects
    );
    setAudit(result);
    setIsAuditing(false);
  };

  useEffect(() => {
    runAudit();
  }, []); 

  // 7-DAY PERFORMANCE DATA
  const chartData = useMemo(() => {
    const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return { date: d.toISOString().split('T')[0], dayName: days[d.getDay()], revenue: 0, expense: 0 };
    });

    ledger.forEach(entry => {
      const dataPoint = last7Days.find(d => d.date === entry.date);
      if (dataPoint) {
        if (entry.category === 'REVENUE' || entry.category === 'INVOICE') dataPoint.revenue += entry.credit;
        else if (entry.debit > 0) dataPoint.expense += entry.debit;
      }
    });
    return last7Days;
  }, [ledger]);

  // NEW: 12-MONTH CASH FLOW DATA
  const monthlyChartData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const data = [];
    const now = new Date();
    
    // Create skeleton for last 12 months
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthIndex = d.getMonth();
      const year = d.getFullYear();
      data.push({
        month: months[monthIndex],
        monthIndex,
        year,
        fullLabel: `${months[monthIndex]} ${year}`,
        revenue: 0,
        expense: 0
      });
    }

    ledger.forEach(entry => {
      const entryDate = new Date(entry.date);
      const entryMonth = entryDate.getMonth();
      const entryYear = entryDate.getFullYear();
      
      const dataPoint = data.find(d => d.monthIndex === entryMonth && d.year === entryYear);
      if (dataPoint) {
        if (entry.category === 'REVENUE' || entry.category === 'INVOICE') {
          dataPoint.revenue += entry.credit;
        } else if (entry.debit > 0 && entry.category !== 'CASH') { // Exclude capital injection from operational expense
          dataPoint.expense += entry.debit;
        }
      }
    });
    return data;
  }, [ledger]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Pendapatan" value={stats.revenue} color="text-blue-600" icon={<ICONS.Revenue className="w-4 h-4" />} trend="+12.5%" />
        <StatCard label="Biaya Operasional" value={stats.expense} color="text-red-500" icon={<ICONS.BBM className="w-4 h-4" />} trend="+3.2%" />
        <StatCard label="Margin Laba Bersih" value={stats.margin} color="text-emerald-600" icon={<ICONS.Finance className="w-4 h-4" />} trend="+8.1%" />
        
        <div className={`relative p-6 rounded-[2rem] border transition-all duration-500 shadow-2xl overflow-hidden group ${
          isAuditing ? 'bg-slate-900 animate-pulse' : 
          audit?.status === 'KRITIS' ? 'bg-red-950 border-red-500/30' : 
          audit?.status === 'PERINGATAN' ? 'bg-orange-950 border-orange-500/30' : 
          'bg-slate-900 border-white/10'
        }`}>
           <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
              <ICONS.Scan className="w-12 h-12 text-blue-400" />
           </div>
           
           <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                 <div className={`w-2 h-2 rounded-full ${isAuditing ? 'bg-blue-500 animate-ping' : audit?.status === 'AMAN' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                 <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">Audit AI Engine</h4>
              </div>
           </div>

           {isAuditing ? (
             <div className="space-y-3 py-4">
                <div className="h-2 bg-white/5 rounded-full w-3/4 overflow-hidden">
                  <div className="h-full bg-blue-500 w-1/2 animate-shimmer" style={{ background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.5), transparent)' }} />
                </div>
                <p className="text-[10px] font-mono text-blue-500 animate-pulse uppercase">Auditing Enterprise Data...</p>
             </div>
           ) : (
             <div className="space-y-4">
               <p className="text-[11px] text-slate-300 leading-relaxed font-medium line-clamp-3">
                 "{audit?.summary}"
               </p>
               <div className="flex justify-between items-center pt-2">
                 <button onClick={runAudit} className="text-[9px] font-black text-blue-500 hover:text-blue-400 underline uppercase tracking-widest transition-colors">Audit Ulang</button>
                 <span className={`text-[8px] font-black px-2 py-0.5 rounded border uppercase ${
                   audit?.status === 'KRITIS' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                   audit?.status === 'PERINGATAN' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                   'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                 }`}>
                   {audit?.status}
                 </span>
               </div>
             </div>
           )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">Performa Keuangan 7 Hari</h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Revenue vs Operational Expense</p>
            </div>
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="dayName" stroke="#cbd5e1" fontSize={11} fontWeight="700" axisLine={false} tickLine={false} dy={10} />
                <YAxis hide />
                <Tooltip />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fill="url(#colorRev)" strokeWidth={4} />
                <Area type="monotone" dataKey="expense" stroke="#f87171" fill="transparent" strokeWidth={3} strokeDasharray="5 5" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 flex flex-col">
           <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight mb-2">Penyerapan Anggaran Proyek</h3>
           <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-8">Biaya Aktual vs Project Cap</p>
           <div className="flex-1 space-y-6">
              {projects.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs font-black uppercase">Belum ada proyek aktif</div>
              ) : (
                projects.slice(0, 3).map(prj => (
                  <div key={prj.id} className="space-y-2">
                     <div className="flex justify-between text-[10px] font-black uppercase">
                        <span className="text-slate-900 truncate w-32">{prj.name}</span>
                        <span className="text-blue-600">{((prj.realizedCost / prj.cap) * 100).toFixed(0)}%</span>
                     </div>
                     <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-1000 ${prj.realizedCost / prj.cap > 0.85 ? 'bg-red-500' : 'bg-blue-600'}`} 
                          style={{ width: `${Math.min((prj.realizedCost / prj.cap) * 100, 100)}%` }} 
                        />
                     </div>
                  </div>
                ))
              )}
           </div>
        </div>
      </div>

      {/* NEW SECTION: ANNUAL CASH FLOW CHART */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight italic">Ringkasan Arus Kas Tahunan</h3>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Pemasukan vs Pengeluaran per Bulan</p>
          </div>
          <div className="flex items-center gap-6">
             <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-600 rounded-full" />
                <span className="text-[10px] font-black uppercase text-slate-600">Pemasukan</span>
             </div>
             <div className="flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-red-400 rounded-full border-dashed" />
                <span className="text-[10px] font-black uppercase text-slate-600">Pengeluaran</span>
             </div>
          </div>
        </div>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthlyChartData}>
              <defs>
                <linearGradient id="colorMonthRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="month" 
                stroke="#64748b" 
                fontSize={10} 
                fontWeight="800" 
                axisLine={false} 
                tickLine={false} 
                dy={15}
                className="uppercase tracking-widest"
              />
              <YAxis 
                stroke="#64748b" 
                fontSize={10} 
                fontWeight="800" 
                axisLine={false} 
                tickLine={false} 
                tickFormatter={(val) => `${(val / 1000000).toFixed(0)}M`}
              />
              <Tooltip 
                contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '1.5rem' }}
                formatter={(value: number) => [`${CURRENCY} ${value.toLocaleString()}`, '']}
                labelStyle={{ fontWeight: '900', textTransform: 'uppercase', marginBottom: '0.5rem', color: '#1e293b' }}
              />
              <Area 
                type="monotone" 
                dataKey="revenue" 
                name="Pemasukan"
                stroke="#2563eb" 
                fill="url(#colorMonthRev)" 
                strokeWidth={5} 
                activeDot={{ r: 8, strokeWidth: 0, fill: '#2563eb' }}
              />
              <Area 
                type="monotone" 
                dataKey="expense" 
                name="Pengeluaran"
                stroke="#f87171" 
                fill="transparent" 
                strokeWidth={3} 
                strokeDasharray="8 6" 
                activeDot={{ r: 6, strokeWidth: 0, fill: '#f87171' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, color, icon, trend }: any) => (
  <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex justify-between items-start mb-4">
       <div className={`p-2 rounded-xl bg-slate-50 ${color.replace('text-', 'text-opacity-70 text-')}`}>{icon}</div>
       <span className="text-[10px] font-black px-2 py-1 rounded-lg bg-green-50 text-green-600 border border-green-100">{trend}</span>
    </div>
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
    <p className={`text-2xl font-black mt-1 tracking-tighter ${color}`}><span className="text-xs font-bold mr-1 opacity-50">{CURRENCY}</span>{value.toLocaleString()}</p>
  </div>
);

export default Dashboard;
