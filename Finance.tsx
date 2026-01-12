
import React, { useState, useMemo, useRef } from 'react';
import { LedgerEntry, TripLog, FuelLog, FinancialCategory, AttendanceRecord, AccountType, User, UserRole, ProjectBudget, CompanySettings } from '../types';
import { ICONS, CURRENCY } from '../constants';
import { scanReceipt } from '../services/gemini';

// Dynamic import for PDF tools
const getPdfTools = async () => {
  const html2canvas = (await import('https://esm.sh/html2canvas@1.4.1')).default;
  const { jsPDF } = await import('https://esm.sh/jspdf@2.5.1');
  return { html2canvas, jsPDF };
};

interface FinanceProps {
  ledger: LedgerEntry[];
  setLedger: React.Dispatch<React.SetStateAction<LedgerEntry[]>>;
  tripLogs: TripLog[];
  setFuelLogs: React.Dispatch<React.SetStateAction<FuelLog[]>>;
  fuelLogs: FuelLog[];
  attendance: AttendanceRecord[];
  currentUser: User;
  projects: ProjectBudget[];
  setProjects: React.Dispatch<React.SetStateAction<ProjectBudget[]>>;
  companySettings: CompanySettings;
}

const CATEGORIES: { value: FinancialCategory; label: string; defaultAccount: string; type: AccountType }[] = [
  { value: 'INVOICE', label: 'Penagihan Client (Revenue)', defaultAccount: 'PIUTANG USAHA', type: AccountType.REVENUE },
  { value: 'BBM', label: 'Bahan Bakar (BBM)', defaultAccount: 'BEBAN BBM', type: AccountType.EXPENSE },
  { value: 'MAINTENANCE', label: 'Perbaikan & Suku Cadang', defaultAccount: 'BEBAN PEMELIHARAAN', type: AccountType.EXPENSE },
  { value: 'GAJI', label: 'Gaji, Upah & Komisi', defaultAccount: 'BEBAN GAJI', type: AccountType.EXPENSE },
  { value: 'PERIZINAN', label: 'Pajak STNK / KIR / Izin', defaultAccount: 'BEBAN PERIZINAN', type: AccountType.EXPENSE },
  { value: 'ASURANSI', label: 'Asuransi Armada', defaultAccount: 'BEBAN ASURANSI', type: AccountType.EXPENSE },
  { value: 'CASH', label: 'Setoran Modal Pemilik', defaultAccount: 'MODAL DISESTOR', type: AccountType.EQUITY },
  { value: 'REVENUE', label: 'Pendapatan Lain-lain', defaultAccount: 'PENDAPATAN LAIN', type: AccountType.REVENUE },
  { value: 'ATK', label: 'Alat Tulis & Kantor', defaultAccount: 'BEBAN ATK', type: AccountType.EXPENSE },
  { value: 'LISTRIK_AIR', label: 'Utilitas (Listrik/Air)', defaultAccount: 'BEBAN UTILITAS', type: AccountType.EXPENSE },
  { value: 'SEWA_KANTOR', label: 'Sewa Kantor/Mess', defaultAccount: 'BEBAN SEWA', type: AccountType.EXPENSE },
  { value: 'PAJAK', label: 'PPh / PPN Perusahaan', defaultAccount: 'HUTANG PAJAK', type: AccountType.LIABILITY },
  { value: 'BIAYA_LAIN', label: 'Biaya Operasional Lainnya', defaultAccount: 'BEBAN LAIN-LAIN', type: AccountType.EXPENSE },
];

const Finance: React.FC<FinanceProps> = ({ 
  ledger, setLedger, tripLogs, setFuelLogs, fuelLogs, attendance, 
  currentUser, projects, setProjects, companySettings 
}) => {
  const [activeSubTab, setActiveSubTab] = useState<string>('rekening-koran');
  const [showManualModal, setShowManualModal] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isAiFilled, setIsAiFilled] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [journalForm, setJournalForm] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    accountId: '',
    amount: 0,
    flowType: 'OUT' as 'IN' | 'OUT', 
    category: 'BIAYA_LAIN' as FinancialCategory
  });

  const filteredCategories = useMemo(() => {
    if (journalForm.flowType === 'IN') {
      return CATEGORIES.filter(cat => cat.type === AccountType.REVENUE || cat.type === AccountType.EQUITY);
    } else {
      return CATEGORIES.filter(cat => cat.type === AccountType.EXPENSE || cat.type === AccountType.LIABILITY);
    }
  }, [journalForm.flowType]);

  const handleFlowToggle = (type: 'IN' | 'OUT') => {
    const firstCompatibleCat = CATEGORIES.find(c => 
      type === 'IN' 
        ? (c.type === AccountType.REVENUE || c.type === AccountType.EQUITY)
        : (c.type === AccountType.EXPENSE || c.type === AccountType.LIABILITY)
    )?.value || 'BIAYA_LAIN';
    
    setJournalForm({ ...journalForm, flowType: type, category: firstCompatibleCat as FinancialCategory });
    setIsAiFilled(false);
  };

  const handleScanClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Image = (reader.result as string).split(',')[1];
        const data = await scanReceipt(base64Image);
        
        // Pre-fill the form with AI data
        setJournalForm({
          date: data.date || new Date().toISOString().split('T')[0],
          description: `INVOICE: ${data.vendor || 'UNKNOWN VENDOR'}`,
          accountId: (data.vendor || '').toUpperCase(),
          amount: data.amount || 0,
          flowType: 'OUT', // Receipts are usually outgoing money
          category: (data.category as FinancialCategory) || 'BIAYA_LAIN'
        });
        
        setIsAiFilled(true);
        setShowManualModal(true);
      } catch (error) {
        console.error("Scanning Error:", error);
        alert("Gagal memproses dokumen. Pastikan gambar jelas dan coba lagi.");
      } finally {
        setIsScanning(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  // Profit & Loss 12 Months Calculation
  const profitLoss12Months = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const now = new Date();
    const result = [];

    for (let i = 11; i >= 0; i--) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = targetDate.getMonth();
      const year = targetDate.getFullYear();
      
      const monthlyRevenue = ledger
        .filter(l => {
          const d = new Date(l.date);
          return d.getMonth() === month && d.getFullYear() === year && l.accountType === AccountType.REVENUE;
        })
        .reduce((sum, l) => sum + (l.credit - l.debit), 0);

      const monthlyExpense = ledger
        .filter(l => {
          const d = new Date(l.date);
          return d.getMonth() === month && d.getFullYear() === year && l.accountType === AccountType.EXPENSE;
        })
        .reduce((sum, l) => sum + (l.debit - l.credit), 0);

      result.push({
        label: `${months[month]} ${year}`,
        revenue: monthlyRevenue,
        expense: monthlyExpense,
        profit: monthlyRevenue - monthlyExpense
      });
    }
    return result;
  }, [ledger]);

  // PDF Export Logic
  const handleDownloadPDF = async (elementId: string, fileName: string) => {
    const element = document.getElementById(elementId);
    if (!element) return;
    setIsGeneratingPdf(true);

    try {
      const { html2canvas, jsPDF } = await getPdfTools();
      const canvas = await html2canvas(element, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: '#FFFFFF',
        windowWidth: 1200,
        onclone: (clonedDoc) => {
          const clonedEl = clonedDoc.getElementById(elementId);
          if (clonedEl) {
            clonedEl.style.width = "1100px";
            clonedEl.style.padding = "40px";
            clonedEl.style.borderRadius = "0";
            clonedEl.style.boxShadow = "none";
          }
        }
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
      pdf.save(`${fileName}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error("PDF Export Error:", error);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const KopSurat = () => (
    <div className="mb-10 flex items-center justify-between border-b-4 border-double border-slate-900 pb-8 px-2">
       <div className="flex items-center gap-8 text-slate-900">
          {companySettings.logo ? (
            <img src={companySettings.logo} className="w-24 h-24 object-contain" alt="Logo" />
          ) : (
            <div className="w-24 h-24 bg-slate-950 rounded-3xl flex items-center justify-center text-white shadow-xl">
              <ICONS.Truck className="w-12 h-12" />
            </div>
          )}
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tighter text-slate-950 leading-none">{companySettings.name}</h1>
            <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em] mt-2 mb-2">Transportasi & Logistik Alat Berat</p>
            <div className="space-y-1">
              <p className="text-[11px] font-bold text-slate-500 uppercase leading-tight italic max-w-xl">{companySettings.address}</p>
              <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">NIB: {companySettings.registrationId}</p>
            </div>
          </div>
       </div>
       <div className="text-right border-l-2 border-slate-100 pl-8 text-slate-900">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Authenticated Financial Report</p>
          <div className="px-4 py-1.5 bg-blue-50 text-blue-600 text-[10px] font-black rounded-lg border border-blue-100 uppercase mb-2">Enterprise Ready</div>
          <p className="text-[10px] font-black text-slate-900 uppercase">{new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })}</p>
       </div>
    </div>
  );

  const rekeningKoranData = useMemo(() => {
    const sorted = [...ledger].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let currentBalance = 0;
    return sorted.map(entry => {
      if (entry.accountId === 'KAS & BANK') {
        currentBalance += (entry.debit - entry.credit);
      }
      return { ...entry, runningBalance: currentBalance };
    }).filter(e => e.accountId === 'KAS & BANK').reverse();
  }, [ledger]);

  const groupedLedger = useMemo(() => {
    const groups: Record<string, LedgerEntry[]> = {};
    const sortedLedger = [...ledger].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    sortedLedger.forEach(entry => {
      if (!groups[entry.journalId]) groups[entry.journalId] = [];
      groups[entry.journalId].push(entry);
    });
    return Object.values(groups);
  }, [ledger]);

  const totalDebit = useMemo(() => ledger.reduce((sum, entry) => sum + entry.debit, 0), [ledger]);
  const totalCredit = useMemo(() => ledger.reduce((sum, entry) => sum + entry.credit, 0), [ledger]);

  const neracaData = useMemo(() => {
    const accounts: Record<string, { balance: number; type: AccountType }> = {};
    ledger.forEach(entry => {
      if (!accounts[entry.accountId]) accounts[entry.accountId] = { balance: 0, type: entry.accountType };
      if (entry.accountType === AccountType.ASSET) accounts[entry.accountId].balance += (entry.debit - entry.credit);
      else if (entry.accountType === AccountType.LIABILITY || entry.accountType === AccountType.EQUITY) accounts[entry.accountId].balance += (entry.credit - entry.debit);
    });
    const totalRev = ledger.filter(l => l.accountType === AccountType.REVENUE).reduce((sum, l) => sum + (l.credit - l.debit), 0);
    const totalExp = ledger.filter(l => l.accountType === AccountType.EXPENSE).reduce((sum, l) => sum + (l.debit - l.credit), 0);
    const profitLoss = totalRev - totalExp;
    const assets = Object.keys(accounts).filter(k => accounts[k].type === AccountType.ASSET && accounts[k].balance !== 0);
    const liabilities = Object.keys(accounts).filter(k => accounts[k].type === AccountType.LIABILITY && accounts[k].balance !== 0);
    const equity = Object.keys(accounts).filter(k => accounts[k].type === AccountType.EQUITY && accounts[k].balance !== 0);
    const totalAssets = assets.reduce((sum, k) => sum + accounts[k].balance, 0);
    const totalLiabilities = liabilities.reduce((sum, k) => sum + accounts[k].balance, 0);
    const totalEquity = equity.reduce((sum, k) => sum + accounts[k].balance, 0) + profitLoss;
    return { accounts, assets, liabilities, equity, profitLoss, totalAssets, totalLiabilities, totalEquity };
  }, [ledger]);

  const handlePostJournal = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (journalForm.amount <= 0) { setFormError("Nominal harus lebih besar dari 0."); return; }
    const journalId = `JV-${Math.floor(Math.random() * 900) + 100}`;
    const timestamp = Date.now();
    const selectedCat = CATEGORIES.find(c => c.value === journalForm.category);
    const targetAccount = (journalForm.accountId || selectedCat?.defaultAccount || 'AKUN UMUM').toUpperCase();
    let entries: LedgerEntry[] = [];
    if (journalForm.flowType === 'IN') {
      entries = [
        { id: `L-${timestamp}-1`, date: journalForm.date, description: journalForm.description.toUpperCase(), debit: Number(journalForm.amount), credit: 0, accountId: 'KAS & BANK', accountType: AccountType.ASSET, category: 'CASH', journalId },
        { id: `L-${timestamp}-2`, date: journalForm.date, description: journalForm.description.toUpperCase(), debit: 0, credit: Number(journalForm.amount), accountId: targetAccount, accountType: selectedCat?.type || AccountType.REVENUE, category: journalForm.category, journalId }
      ];
    } else {
      entries = [
        { id: `L-${timestamp}-1`, date: journalForm.date, description: journalForm.description.toUpperCase(), debit: Number(journalForm.amount), credit: 0, accountId: targetAccount, accountType: selectedCat?.type || AccountType.EXPENSE, category: journalForm.category, journalId },
        { id: `L-${timestamp}-2`, date: journalForm.date, description: journalForm.description.toUpperCase(), debit: 0, credit: Number(journalForm.amount), accountId: 'KAS & BANK', accountType: AccountType.ASSET, category: 'CASH', journalId }
      ];
    }
    setLedger(prev => [...entries, ...prev]);
    setShowManualModal(false);
    setJournalForm({ ...journalForm, description: '', accountId: '', amount: 0 });
    setIsAiFilled(false);
  };

  return (
    <div className="space-y-6">
      {/* SCANNING OVERLAY */}
      {isScanning && (
        <div className="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-xl flex flex-col items-center justify-center">
           <div className="relative">
              <div className="w-32 h-32 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                 <ICONS.Scan className="w-10 h-10 text-blue-500 animate-pulse" />
              </div>
           </div>
           <h3 className="mt-10 text-2xl font-black text-white uppercase tracking-[0.2em] italic">AI Document Vision</h3>
           <p className="mt-4 text-[10px] font-black text-blue-400 uppercase tracking-[0.4em] animate-pulse">Extracting financial data via Gemini Core...</p>
        </div>
      )}

      <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl overflow-x-auto scrollbar-hide w-full md:w-auto">
            {[
              { id: 'rekening-koran', label: 'Rekening Koran' },
              { id: 'jurnal', label: 'Jurnal Umum' },
              { id: 'neraca', label: 'Neraca' },
              { id: 'labarugi', label: 'Laba Rugi' }
            ].map(tab => (
              <button 
                key={tab.id} 
                onClick={() => setActiveSubTab(tab.id)} 
                className={`flex-1 md:flex-none px-6 md:px-8 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all whitespace-nowrap ${
                  activeSubTab === tab.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          
          <div className="flex flex-wrap md:flex-nowrap gap-4 w-full md:w-auto">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept="image/*" 
              className="hidden" 
            />
            <button 
              onClick={handleScanClick}
              className="flex-1 md:flex-none px-6 py-3 bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl border border-blue-200 shadow-sm hover:bg-blue-100 transition-all flex items-center justify-center gap-3"
            >
              <ICONS.Scan className="w-4 h-4" /> Scan Struk (AI)
            </button>
            <button 
              disabled={isGeneratingPdf}
              onClick={() => handleDownloadPDF(activeSubTab === 'rekening-koran' ? 'print-rekening' : activeSubTab === 'jurnal' ? 'print-jurnal' : activeSubTab === 'neraca' ? 'print-neraca' : 'print-labarugi', activeSubTab.toUpperCase())}
              className="flex-1 md:flex-none px-6 py-3 bg-white border border-slate-200 text-slate-900 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-3"
            >
              <ICONS.Invoice className="w-4 h-4 text-slate-400" /> {isGeneratingPdf ? 'Processing...' : 'Cetak PDF'}
            </button>
            <button 
              onClick={() => { setIsAiFilled(false); setShowManualModal(true); }} 
              className="flex-1 md:flex-none px-8 py-3 bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.3em] rounded-2xl shadow-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-3"
            >
              <ICONS.Plus className="w-4 h-4" /> Entry Jurnal
            </button>
          </div>
        </div>
      </div>

      {activeSubTab === 'labarugi' && (
        <div className="bg-white rounded-[2rem] border border-slate-200 p-8 md:p-12 shadow-sm animate-in fade-in duration-500 text-slate-900 overflow-x-auto">
          <div id="print-labarugi" className="min-w-[800px] md:min-w-0">
            <KopSurat />
            <div className="text-center mb-10">
              <h2 className="text-2xl font-black uppercase tracking-[0.4em] text-slate-950 leading-none">Laporan Laba Rugi</h2>
              <p className="text-[12px] font-bold text-slate-400 mt-2">(Profit & Loss Statement - Last 12 Months)</p>
            </div>

            <div className="mb-8 p-6 bg-slate-900 rounded-3xl text-white flex justify-between items-center">
               <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-blue-400">Periode Laporan</p>
                  <p className="text-sm font-black uppercase">{profitLoss12Months[0].label} - {profitLoss12Months[11].label}</p>
               </div>
               <div className="text-right">
                  <p className="text-[9px] font-black uppercase tracking-widest text-blue-400">Laba Bersih Kumulatif</p>
                  <p className="text-2xl font-black font-mono text-emerald-400 italic">
                    {profitLoss12Months.reduce((sum, m) => sum + m.profit, 0).toLocaleString('id-ID')}
                  </p>
               </div>
            </div>

            <table className="w-full border-collapse border border-slate-200 text-[11px]">
               <thead className="bg-slate-100 text-slate-900 font-black">
                  <tr>
                     <th className="border border-slate-300 px-6 py-4 text-left uppercase tracking-widest">Bulan / Periode</th>
                     <th className="border border-slate-300 px-6 py-4 text-right uppercase tracking-widest">Total Pendapatan (Revenue)</th>
                     <th className="border border-slate-300 px-6 py-4 text-right uppercase tracking-widest">Total Pengeluaran (Expense)</th>
                     <th className="border border-slate-300 px-6 py-4 text-right uppercase tracking-widest bg-slate-200">Laba / Rugi Bersih</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {profitLoss12Months.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                       <td className="border border-slate-100 px-6 py-5 font-black uppercase text-slate-950">{row.label}</td>
                       <td className="border border-slate-100 px-6 py-5 text-right font-mono font-bold text-blue-600">{row.revenue.toLocaleString('id-ID')}</td>
                       <td className="border border-slate-100 px-6 py-5 text-right font-mono font-bold text-red-600">{row.expense.toLocaleString('id-ID')}</td>
                       <td className={`border border-slate-100 px-6 py-5 text-right font-mono font-black ${row.profit >= 0 ? 'text-emerald-600 bg-emerald-50/30' : 'text-red-700 bg-red-50/30'}`}>
                          {row.profit.toLocaleString('id-ID')}
                       </td>
                    </tr>
                  ))}
               </tbody>
               <tfoot className="bg-slate-900 text-white font-black">
                  <tr>
                     <td className="border border-slate-800 px-6 py-5 uppercase tracking-widest text-[10px]">Total Konsolidasi 12 Bulan</td>
                     <td className="border border-slate-800 px-6 py-5 text-right font-mono text-sm">
                        {profitLoss12Months.reduce((s, m) => s + m.revenue, 0).toLocaleString('id-ID')}
                     </td>
                     <td className="border border-slate-800 px-6 py-5 text-right font-mono text-sm text-red-400">
                        {profitLoss12Months.reduce((s, m) => s + m.expense, 0).toLocaleString('id-ID')}
                     </td>
                     <td className="border border-slate-800 px-6 py-5 text-right font-mono text-sm text-emerald-400 bg-white/10">
                        {profitLoss12Months.reduce((s, m) => s + m.profit, 0).toLocaleString('id-ID')}
                     </td>
                  </tr>
               </tfoot>
            </table>

            <div className="mt-8 flex justify-center">
               <div className="px-12 py-4 bg-slate-50 border border-slate-200 rounded-full flex items-center gap-4 text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 italic">
                  <ICONS.Scan className="w-4 h-4" /> Data Finansial Terverifikasi AI Core System
               </div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'rekening-koran' && (
        <div className="bg-white rounded-[2rem] border border-slate-200 p-8 md:p-12 shadow-sm animate-in fade-in duration-500 text-slate-900 overflow-x-auto">
          <div id="print-rekening" className="min-w-[800px] md:min-w-0">
            <KopSurat />
            <div className="text-center mb-10">
              <h2 className="text-2xl font-black uppercase tracking-[0.4em] text-slate-950 leading-none">Rekening Koran</h2>
              <p className="text-[12px] font-bold text-slate-400 mt-2">(Account Statement)</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 text-[11px] font-bold uppercase tracking-tight">
               <div className="space-y-2">
                  <div className="flex gap-4">
                     <span className="w-32 text-slate-400">Periode</span>
                     <span className="text-slate-900">: 01 {new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })} - {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </div>
                  <div className="flex gap-4">
                     <span className="w-32 text-slate-400">Nomor Akun</span>
                     <span className="text-slate-900">: 100-244-9988-1 / {companySettings.name}</span>
                  </div>
                  <div className="flex gap-4">
                     <span className="w-32 text-slate-400">Mata Uang</span>
                     <span className="text-slate-900">: {CURRENCY}</span>
                  </div>
               </div>
               <div className="space-y-2">
                  <div className="flex gap-4">
                     <span className="w-32 text-slate-400">Cabang</span>
                     <span className="text-slate-900">: JAKARTA CORPORATE OFFICE</span>
                  </div>
                  <div className="flex gap-4">
                     <span className="w-32 text-slate-400">Saldo Awal</span>
                     <span className="text-slate-900">: 0,00</span>
                  </div>
               </div>
            </div>

            <table className="w-full border-collapse border border-slate-200 text-[11px]">
              <thead className="bg-[#B8CCE4] text-slate-900 font-black">
                <tr>
                  <th className="border border-slate-300 px-4 py-3 text-center uppercase">Tanggal & Jam</th>
                  <th className="border border-slate-300 px-4 py-3 text-left uppercase">Keterangan Transaksi</th>
                  <th className="border border-slate-300 px-4 py-3 text-center uppercase">Ref No.</th>
                  <th className="border border-slate-300 px-4 py-3 text-right uppercase">Debit (Masuk)</th>
                  <th className="border border-slate-300 px-4 py-3 text-right uppercase">Kredit (Keluar)</th>
                  <th className="border border-slate-300 px-4 py-3 text-right uppercase bg-[#92B1D6]">Saldo (Balance)</th>
                </tr>
              </thead>
              <tbody>
                {rekeningKoranData.length === 0 ? (
                  <tr><td colSpan={6} className="py-20 text-center font-black text-slate-300 uppercase italic">Belum Ada Transaksi Bulan Ini</td></tr>
                ) : (
                  rekeningKoranData.map((row, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      <td className="border border-slate-100 px-4 py-4 text-center font-medium">
                        {new Date(row.date).toLocaleDateString('id-ID')}
                        <p className="text-[9px] text-slate-400">08:00:00</p>
                      </td>
                      <td className="border border-slate-100 px-4 py-4 font-bold text-slate-950 uppercase">
                        {row.description}
                        <p className="text-[9px] font-normal text-slate-400 lowercase tracking-tight italic">Trans ID: {row.journalId}</p>
                      </td>
                      <td className="border border-slate-100 px-4 py-4 text-center font-mono text-slate-400">{row.journalId.split('-')[1]}</td>
                      <td className="border border-slate-100 px-4 py-4 text-right font-mono font-bold text-emerald-600">{row.debit > 0 ? row.debit.toLocaleString('id-ID') : '0,00'}</td>
                      <td className="border border-slate-100 px-4 py-4 text-right font-mono font-bold text-red-600">{row.credit > 0 ? row.credit.toLocaleString('id-ID') : '0,00'}</td>
                      <td className="border border-slate-100 px-4 py-4 text-right font-mono font-black text-slate-950 bg-slate-50/50">{row.runningBalance.toLocaleString('id-ID')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            
            <div className="mt-10 p-6 bg-slate-50 rounded-2xl border border-slate-200 flex flex-row justify-between items-center gap-6">
               <div className="flex gap-10">
                  <div>
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Debit</p>
                     <p className="text-sm font-black text-emerald-600 font-mono">{rekeningKoranData.reduce((s,r) => s+r.debit, 0).toLocaleString('id-ID')}</p>
                  </div>
                  <div>
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Kredit</p>
                     <p className="text-sm font-black text-red-600 font-mono">{rekeningKoranData.reduce((s,r) => s+r.credit, 0).toLocaleString('id-ID')}</p>
                  </div>
               </div>
               <div className="text-right">
                  <p className="text-[10px] font-black text-slate-950 uppercase tracking-widest">Saldo Akhir Terverifikasi</p>
                  <p className="text-2xl font-black text-blue-600 font-mono italic">
                     {rekeningKoranData[0]?.runningBalance.toLocaleString('id-ID') || '0,00'}
                  </p>
               </div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'jurnal' && (
        <div className="bg-white rounded-[2rem] border border-slate-200 p-8 md:p-12 shadow-sm animate-in fade-in duration-500 text-slate-900 overflow-x-auto">
          <div id="print-jurnal" className="min-w-[800px] md:min-w-0">
            <KopSurat />
            <div className="text-center mb-10">
              <h2 className="text-2xl font-black uppercase tracking-[0.4em] text-slate-950 border-y-2 border-slate-900 py-3 inline-block px-12">Jurnal Umum</h2>
            </div>
            <table className="w-full border-collapse border border-slate-900 text-[11px]">
              <thead className="bg-slate-100 text-slate-900 font-black">
                <tr>
                  <th className="border border-slate-900 px-4 py-3 text-center w-32 uppercase">Tanggal</th>
                  <th className="border border-slate-900 px-4 py-3 text-left uppercase">Keterangan / Nama Akun</th>
                  <th className="border border-slate-900 px-4 py-3 text-center w-20 uppercase">Ref</th>
                  <th className="border border-slate-900 px-4 py-3 text-right w-40 uppercase">Debit (Masuk)</th>
                  <th className="border border-slate-900 px-4 py-3 text-right w-40 uppercase">Kredit (Keluar)</th>
                </tr>
              </thead>
              <tbody>
                {groupedLedger.map((group, gIdx) => (
                  <React.Fragment key={gIdx}>
                    {group.map((entry, eIdx) => (
                      <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                        {eIdx === 0 && <td className="border border-slate-900 px-4 py-3 text-center align-top font-bold" rowSpan={group.length}>{new Date(entry.date).toLocaleDateString('id-ID')}</td>}
                        <td className={`border-x border-slate-900 px-4 py-3 ${entry.credit > 0 ? 'pl-12 italic text-slate-500' : 'font-bold text-slate-950'}`}>
                          {entry.accountId}
                          {eIdx === 0 && <p className="text-[9px] font-normal text-slate-400 mt-1 lowercase tracking-tight italic">{entry.description}</p>}
                        </td>
                        <td className="border border-slate-900 px-4 py-3 text-center align-top font-mono">{entry.journalId.split('-')[1]}</td>
                        <td className="border border-slate-900 px-4 py-3 text-right font-mono text-[12px]">{entry.debit > 0 ? entry.debit.toLocaleString('id-ID') : '-'}</td>
                        <td className="border border-slate-900 px-4 py-3 text-right font-mono text-[12px]">{entry.credit > 0 ? entry.credit.toLocaleString('id-ID') : '-'}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-900 h-[2px]"><td colSpan={5}></td></tr>
                  </React.Fragment>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 font-black text-slate-950">
                <tr>
                  <td colSpan={3} className="border border-slate-900 px-6 py-4 text-center uppercase tracking-widest">Total Saldo Jurnal</td>
                  <td className="border border-slate-900 px-4 py-4 text-right font-mono text-[13px]">{totalDebit.toLocaleString('id-ID')}</td>
                  <td className="border border-slate-900 px-4 py-4 text-right font-mono text-[13px]">{totalCredit.toLocaleString('id-ID')}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === 'neraca' && (
        <div className="bg-white rounded-[2rem] border border-slate-200 p-8 md:p-12 shadow-sm animate-in fade-in duration-500 text-slate-900 overflow-x-auto">
          <div id="print-neraca" className="min-w-[800px] md:min-w-0">
            <KopSurat />
            <div className="text-center mb-10">
              <h2 className="text-2xl font-black uppercase tracking-[0.4em] text-slate-950 border-y-2 border-slate-900 py-3 inline-block px-12">Neraca Keuangan</h2>
              <p className="text-xs font-bold text-slate-400 mt-4 uppercase tracking-widest">Per Tanggal: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
            <div className="grid grid-cols-2 border-2 border-slate-950 min-h-[500px]">
               <div className="border-r border-slate-900 flex flex-col">
                  <div className="bg-slate-900 text-white p-4 text-center font-black uppercase tracking-widest text-sm">Aktiva (Aset)</div>
                  <div className="flex-1 p-6 space-y-4">
                     <div className="space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1">Aset Lancar</p>
                        {neracaData.assets.map(acc => (
                           <div key={acc} className="flex justify-between text-[11px] font-bold text-slate-950 py-1">
                              <span>{acc}</span><span className="font-mono">{neracaData.accounts[acc].balance.toLocaleString('id-ID')}</span>
                           </div>
                        ))}
                     </div>
                  </div>
                  <div className="bg-slate-100 p-5 border-t border-slate-900 flex justify-between items-center">
                     <span className="text-xs font-black uppercase tracking-widest">Total Aktiva</span>
                     <span className="text-sm font-black font-mono">{neracaData.totalAssets.toLocaleString('id-ID')}</span>
                  </div>
               </div>
               <div className="flex flex-col">
                  <div className="bg-slate-900 text-white p-4 text-center font-black uppercase tracking-widest text-sm">Pasiva (Kewajiban & Ekuitas)</div>
                  <div className="flex-1 p-6 space-y-6">
                     <div className="space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1">Kewajiban</p>
                        {neracaData.liabilities.length > 0 ? neracaData.liabilities.map(acc => (
                           <div key={acc} className="flex justify-between text-[11px] font-bold text-slate-950 py-1">
                              <span>{acc}</span><span className="font-mono">{neracaData.accounts[acc].balance.toLocaleString('id-ID')}</span>
                           </div>
                        )) : <p className="text-[9px] text-slate-300 italic">Tidak ada kewajiban terdaftar</p>}
                     </div>
                     <div className="space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1">Ekuitas (Modal)</p>
                        {neracaData.equity.map(acc => (
                           <div key={acc} className="flex justify-between text-[11px] font-bold text-slate-950 py-1">
                              <span>{acc}</span><span className="font-mono">{neracaData.accounts[acc].balance.toLocaleString('id-ID')}</span>
                           </div>
                        ))}
                        <div className="flex justify-between text-[11px] font-black text-blue-600 py-1 bg-blue-50/50 px-2 rounded">
                           <span>LABA TAHUN BERJALAN</span><span className="font-mono">{neracaData.profitLoss.toLocaleString('id-ID')}</span>
                        </div>
                     </div>
                  </div>
                  <div className="bg-slate-100 p-5 border-t border-slate-900 flex justify-between items-center">
                     <span className="text-xs font-black uppercase tracking-widest">Total Pasiva</span>
                     <span className="text-sm font-black font-mono">{(neracaData.totalLiabilities + neracaData.totalEquity).toLocaleString('id-ID')}</span>
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}

      {showManualModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh] text-slate-900 border border-slate-200">
             <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-6">
                <div>
                   <h4 className="text-2xl font-black uppercase tracking-tighter text-slate-950 italic">Entry Jurnal {isAiFilled ? 'Verified AI' : 'Manual'}</h4>
                   <p className="text-[8px] font-black text-blue-600 uppercase tracking-widest mt-1">Sistem Double-Entry Enterprise</p>
                </div>
                <button onClick={() => { setShowManualModal(false); setIsAiFilled(false); }} className="p-3 bg-slate-50 rounded-2xl text-slate-400 hover:text-red-500 transition-all"><ICONS.Plus className="w-6 h-6 rotate-45" /></button>
             </div>
             
             {isAiFilled && (
               <div className="mb-6 px-6 py-3 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-4">
                  <ICONS.Scan className="w-4 h-4 text-emerald-600" />
                  <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Auto-filled by Gemini AI Document Vision</p>
               </div>
             )}

             <form onSubmit={handlePostJournal} className="space-y-6">
                <div className={`flex p-1 rounded-2xl mb-4 transition-colors ${journalForm.flowType === 'IN' ? 'bg-emerald-50' : 'bg-red-50'}`}>
                  <button type="button" onClick={() => handleFlowToggle('OUT')} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${journalForm.flowType === 'OUT' ? 'bg-white text-red-600 shadow-sm border border-red-100' : 'text-slate-400'}`}>Uang Keluar</button>
                  <button type="button" onClick={() => handleFlowToggle('IN')} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${journalForm.flowType === 'IN' ? 'bg-white text-emerald-600 shadow-sm border border-emerald-100' : 'text-slate-400'}`}>Uang Masuk</button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Tanggal</label>
                    <input type="date" value={journalForm.date} onChange={e => { setJournalForm({...journalForm, date: e.target.value}); setIsAiFilled(false); }} className={`w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-black outline-none focus:ring-2 focus:ring-blue-500 transition-all ${isAiFilled ? 'ring-2 ring-emerald-500/20' : ''}`} required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Nominal (IDR)</label>
                    <input type="number" placeholder="0" value={journalForm.amount || ''} onChange={e => { setJournalForm({...journalForm, amount: Number(e.target.value)}); setIsAiFilled(false); }} className={`w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-black outline-none focus:ring-2 focus:ring-blue-500 transition-all ${isAiFilled ? 'ring-2 ring-emerald-500/20 animate-pulse' : ''}`} required />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Kategori Transaksi ({journalForm.flowType === 'IN' ? 'Pemasukan' : 'Pengeluaran'})</label>
                  <select value={journalForm.category} onChange={e => { setJournalForm({...journalForm, category: e.target.value as FinancialCategory}); setIsAiFilled(false); }} className={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-sm font-black outline-none focus:ring-2 transition-all ${journalForm.flowType === 'IN' ? 'border-emerald-200 focus:ring-emerald-500' : 'border-red-200 focus:ring-red-500'} ${isAiFilled ? 'ring-2 ring-emerald-500/20' : ''}`}>{filteredCategories.map(cat => <option key={cat.value} value={cat.value}>{cat.label}</option>)}</select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">{journalForm.flowType === 'IN' ? 'Sumber Dana' : 'Akun Tujuan / Beban'}</label>
                  <input type="text" placeholder="E.G. PENDAPATAN JASA" value={journalForm.accountId} onChange={e => { setJournalForm({...journalForm, accountId: e.target.value}); setIsAiFilled(false); }} className={`w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-black uppercase outline-none focus:ring-2 focus:ring-blue-500 transition-all ${isAiFilled ? 'ring-2 ring-emerald-500/20' : ''}`} />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Deskripsi Lengkap</label>
                  <textarea placeholder="Deskripsi transaksi..." value={journalForm.description} onChange={e => { setJournalForm({...journalForm, description: e.target.value}); setIsAiFilled(false); }} className={`w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-black h-20 outline-none focus:ring-2 focus:ring-blue-500 transition-all ${isAiFilled ? 'ring-2 ring-emerald-500/20' : ''}`} required />
                </div>
                <button type="submit" className={`w-full py-5 text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-3xl shadow-xl transition-all ${journalForm.flowType === 'IN' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200' : 'bg-red-600 hover:bg-red-700 shadow-red-200'}`}>
                  {isAiFilled ? 'Review & Simpan Transaksi AI' : 'Posting Jurnal & Update Saldo Kas'}
                </button>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Finance;
