
import React, { useState, useMemo } from 'react';
import { TripLog, Vehicle, User, UserRole, CompanySettings, FuelLog } from '../types';
import { ICONS, CURRENCY } from '../constants';
import { generateProfessionalManifestAnalysis } from '../services/gemini';

const getPdfTools = async () => {
  const html2canvas = (await import('https://esm.sh/html2canvas@1.4.1')).default;
  const { jsPDF } = await import('https://esm.sh/jspdf@2.5.1');
  return { html2canvas, jsPDF };
};

interface OperationsProps {
  tripLogs: TripLog[];
  setTripLogs: React.Dispatch<React.SetStateAction<TripLog[]>>;
  vehicles: Vehicle[];
  setVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
  currentUser: User;
  companySettings: CompanySettings;
  fuelLogs: FuelLog[];
}

type OperationsTab = 'ritase' | 'armada';

const Operations: React.FC<OperationsProps> = ({ tripLogs, setTripLogs, vehicles, setVehicles, currentUser, companySettings, fuelLogs }) => {
  const [activeTab, setActiveTab] = useState<OperationsTab>('ritase');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAddVehicleForm, setShowAddVehicleForm] = useState(false);
  const [selectedManifest, setSelectedManifest] = useState<TripLog | null>(null);
  const [manifestAnalysis, setManifestAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const [newTrip, setNewTrip] = useState<Partial<TripLog>>({
    vehicleId: '',
    route: '',
    tonnage: 0,
    kmStart: 0,
    cargoType: '',
    haulingLocation: ''
  });

  const [newVehicle, setNewVehicle] = useState<Partial<Vehicle>>({
    plateNumber: '',
    model: '',
    type: 'CONTAINER',
    status: 'AKTIF',
    gpsId: ''
  });

  const isManager = currentUser.role === UserRole.OWNER || currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.DEVELOPER;

  // Calculate efficiency for selected manifest
  const efficiencyData = useMemo(() => {
    if (!selectedManifest) return { liters: 0, distance: 0, l100km: 0 };
    const tripFuel = fuelLogs.filter(f => f.tripId === selectedManifest.id);
    const totalLiters = tripFuel.reduce((sum, log) => sum + log.liters, 0);
    const distance = (selectedManifest.kmEnd && selectedManifest.kmStart) ? (selectedManifest.kmEnd - selectedManifest.kmStart) : 0;
    const l100km = distance > 0 ? (totalLiters / distance) * 100 : 0;
    return { liters: totalLiters, distance, l100km };
  }, [selectedManifest, fuelLogs]);

  const handleAddTrip = (e: React.FormEvent) => {
    e.preventDefault();
    const trip: TripLog = {
      ...newTrip as TripLog,
      id: `TRP-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      driverId: currentUser.id,
      startTime: new Date().toISOString(),
    };
    setTripLogs(prev => [trip, ...prev]);
    setShowAddForm(false);
    setNewTrip({ vehicleId: '', route: '', tonnage: 0, kmStart: 0, cargoType: '', haulingLocation: '' });
  };

  const handleAddVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    const vehicle: Vehicle = {
      ...newVehicle as Vehicle,
      id: `VEH-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
    };
    setVehicles(prev => [...prev, vehicle]);
    setShowAddVehicleForm(false);
    setNewVehicle({ plateNumber: '', model: '', type: 'CONTAINER', status: 'AKTIF', gpsId: '' });
  };

  const handleDeleteVehicle = (id: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus armada ini dari sistem?")) {
      setVehicles(prev => prev.filter(v => v.id !== id));
    }
  };

  const handleOpenManifest = async (trip: TripLog) => {
    setSelectedManifest(trip);
    setManifestAnalysis('');
    setIsAnalyzing(true);
    const tripFuel = fuelLogs.filter(f => f.tripId === trip.id);
    const analysis = await generateProfessionalManifestAnalysis(trip, tripFuel);
    setManifestAnalysis(analysis);
    setIsAnalyzing(false);
  };

  const handleDownloadPDF = async () => {
    const element = document.getElementById('manifest-print-area');
    if (!element) return;
    setIsGeneratingPdf(true);

    try {
      const { html2canvas, jsPDF } = await getPdfTools();
      
      const canvas = await html2canvas(element, {
        scale: 3, 
        useCORS: true,
        logging: false,
        backgroundColor: '#FFFFFF',
        windowWidth: 1200, 
      });

      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdfWidth = 210;
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: [pdfWidth, pdfHeight], 
        compress: true
      });

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      pdf.save(`MANIFEST_${selectedManifest?.id}.pdf`);
    } catch (error) { 
      console.error("PDF Export Error:", error); 
    } finally { 
      setIsGeneratingPdf(false); 
    }
  };

  const formatAIText = (text: string) => {
    if (!text) return null;
    return text.split('\n').map((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={i} className="h-4" />;
      if (trimmed.startsWith('###')) {
        return (
          <h5 key={i} className="text-blue-400 font-black uppercase tracking-[0.2em] text-[10px] md:text-[11px] mt-6 md:mt-8 mb-4 flex items-center gap-2">
            <div className="w-1 h-3 bg-blue-500" />
            {trimmed.replace(/###|\*\*/g, '').trim()}
          </h5>
        );
      }
      const isBullet = trimmed.startsWith('*');
      const content = isBullet ? trimmed.substring(1).trim() : trimmed;
      const parts = content.split(/(\*\*.*?\*\*)/g);
      return (
        <div key={i} className={`flex gap-3 mb-2.5 ${isBullet ? 'pl-4' : ''}`}>
          {isBullet && <span className="text-blue-500 font-bold mt-1 text-[10px]">●</span>}
          <p className="text-slate-100 text-[13px] md:text-[15px] leading-relaxed flex-1 font-medium">
            {parts.map((part, j) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={j} className="text-white font-black tracking-tight">{part.slice(2, -2)}</strong>;
              }
              return part;
            })}
          </p>
        </div>
      );
    });
  };

  return (
    <div className="space-y-6">
      {/* ACTION BAR */}
      <div className="bg-white/50 md:bg-slate-50/50 rounded-[1.5rem] md:rounded-[2rem] border border-slate-200 p-4 md:p-8 shadow-sm">
        <div className="flex flex-col gap-4 md:gap-6">
          <div className="flex gap-2 p-1 bg-slate-200/50 rounded-2xl w-full md:w-fit overflow-x-auto scrollbar-hide">
            <button 
              onClick={() => setActiveTab('ritase')} 
              className={`flex-1 md:flex-none px-12 md:px-16 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap ${activeTab === 'ritase' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}
            >
              Log Ritase
            </button>
            {isManager && (
              <button 
                onClick={() => setActiveTab('armada')} 
                className={`flex-1 md:flex-none px-12 md:px-16 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap ${activeTab === 'armada' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
              >
                Armada
              </button>
            )}
          </div>

          <button 
            onClick={() => activeTab === 'ritase' ? setShowAddForm(true) : setShowAddVehicleForm(true)} 
            className="flex items-center justify-center gap-4 w-full md:w-full max-w-4xl px-8 md:px-10 py-5 bg-[#0F172A] text-white text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-blue-600 transition-all shadow-xl active:scale-95 transition-transform"
          >
            <ICONS.Plus className="w-5 h-5" /> {activeTab === 'ritase' ? 'Input Ritase Baru' : 'Tambah Unit'}
          </button>
        </div>
      </div>

      {/* TABLE SECTION */}
      <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm animate-in fade-in duration-500">
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full text-left min-w-[700px] md:min-w-0">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {activeTab === 'ritase' ? (
                  <>
                    <th className="px-6 md:px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Manifest ID</th>
                    <th className="px-6 md:px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Unit</th>
                    <th className="px-6 md:px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Rute Perjalanan</th>
                    <th className="px-6 md:px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Muatan</th>
                    <th className="px-6 md:px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Aksi</th>
                  </>
                ) : (
                  <>
                    <th className="px-6 md:px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Unit</th>
                    <th className="px-6 md:px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Model & Tipe</th>
                    <th className="px-6 md:px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status Operasional</th>
                    <th className="px-6 md:px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">GPS Tracking</th>
                    <th className="px-6 md:px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Aksi</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeTab === 'ritase' ? (
                tripLogs.map(trip => (
                  <tr key={trip.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 md:px-8 py-6">
                      <p className="text-[10px] font-mono font-black text-slate-400 mb-1">#{trip.id}</p>
                      <span className={`px-2 py-0.5 text-[8px] font-black rounded border uppercase ${trip.endTime ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-blue-50 text-blue-600 border-blue-100 animate-pulse'}`}>
                        {trip.endTime ? 'Selesai' : 'Berjalan'}
                      </span>
                    </td>
                    <td className="px-6 md:px-8 py-6">
                      <p className="text-sm font-black text-slate-900">{vehicles.find(v => v.id === trip.vehicleId)?.plateNumber || 'N/A'}</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase">{vehicles.find(v => v.id === trip.vehicleId)?.model || 'Unit'}</p>
                    </td>
                    <td className="px-6 md:px-8 py-6 text-xs font-black text-slate-800 uppercase tracking-tight">{trip.route}</td>
                    <td className="px-6 md:px-8 py-6"><span className="text-lg font-black text-slate-900 font-mono">{trip.tonnage}</span><span className="text-[10px] font-black text-slate-400 uppercase ml-1">Ton</span></td>
                    <td className="px-6 md:px-8 py-6 text-right">
                      <button onClick={() => handleOpenManifest(trip)} className="px-5 py-2.5 bg-slate-900 text-white text-[9px] font-black uppercase rounded-lg shadow-sm hover:bg-blue-600 transition-all">Manifes</button>
                    </td>
                  </tr>
                ))
              ) : (
                vehicles.map(v => (
                  <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 md:px-8 py-6">
                      <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{v.plateNumber}</p>
                      <p className="text-[10px] font-mono text-slate-400 font-bold">ID: {v.id}</p>
                    </td>
                    <td className="px-6 md:px-8 py-6">
                      <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{v.model}</p>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{v.type}</span>
                    </td>
                    <td className="px-6 md:px-8 py-6 text-center">
                      <span className={`px-4 py-1.5 text-[8px] md:text-[9px] font-black rounded-full border uppercase tracking-widest inline-block min-w-[110px] ${
                        v.status === 'AKTIF' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                        v.status === 'PERBAIKAN' ? 'bg-red-50 text-red-600 border-red-100' :
                        'bg-amber-50 text-amber-600 border-amber-100'
                      }`}>
                        {v.status}
                      </span>
                    </td>
                    <td className="px-6 md:px-8 py-6 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {v.gpsId ? (
                           <span className="text-[10px] font-mono font-black text-blue-600 uppercase tracking-widest">{v.gpsId}</span>
                        ) : (
                          <span className="text-[10px] font-black text-slate-300 uppercase italic tracking-widest">Offline</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 md:px-8 py-6 text-right">
                      <button onClick={() => handleDeleteVehicle(v.id)} className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL INPUT RITASE */}
      {showAddForm && ( activeTab === 'ritase' &&
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="bg-white w-full max-w-xl rounded-[2rem] p-6 md:p-12 shadow-2xl animate-in zoom-in-95 overflow-y-auto max-h-[90vh]">
            <h4 className="text-xl md:text-2xl font-black uppercase tracking-tighter text-slate-950 mb-8 italic border-b border-slate-100 pb-4">Input Ritase Baru</h4>
            <form onSubmit={handleAddTrip} className="space-y-4 md:space-y-6">
               <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Armada Unit</label>
                 <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 md:px-6 py-4 text-sm font-black outline-none focus:ring-2 focus:ring-blue-500" required onChange={e => setNewTrip({...newTrip, vehicleId: e.target.value})}>
                   <option value="">Pilih Armada...</option>
                   {vehicles.map(v => <option key={v.id} value={v.id}>{v.plateNumber} — {v.model}</option>)}
                 </select>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Rute Perjalanan</label>
                   <input type="text" placeholder="E.G. JKT - SUB" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-6 py-4 text-sm font-black uppercase outline-none focus:ring-2 focus:ring-blue-500" required onChange={e => setNewTrip({...newTrip, route: e.target.value})} />
                 </div>
                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Lokasi Hauling</label>
                   <input type="text" placeholder="E.G. JETTY / SITE" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-6 py-4 text-sm font-black uppercase outline-none focus:ring-2 focus:ring-blue-500" required onChange={e => setNewTrip({...newTrip, haulingLocation: e.target.value})} />
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-4 md:gap-6">
                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Muatan (Ton)</label>
                   <input type="number" step="0.01" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-6 py-4 text-sm font-black outline-none focus:ring-2 focus:ring-blue-500" required onChange={e => setNewTrip({...newTrip, tonnage: parseFloat(e.target.value)})} />
                 </div>
                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">KM Awal</label>
                   <input type="number" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-6 py-4 text-sm font-black outline-none focus:ring-2 focus:ring-blue-500" required onChange={e => setNewTrip({...newTrip, kmStart: parseInt(e.target.value)})} />
                 </div>
               </div>

               <div className="flex flex-col-reverse md:flex-row gap-4 pt-6 md:pt-10">
                 <button type="button" onClick={() => setShowAddForm(false)} className="flex-1 px-4 py-4 text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors">Batalkan</button>
                 <button type="submit" className="flex-1 px-4 py-4 bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl shadow-xl hover:bg-blue-600 transition-all">Simpan Perjalanan</button>
               </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL REGISTRASI UNIT ARMADA */}
      {showAddVehicleForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] p-8 md:p-12 shadow-2xl animate-in zoom-in-95 overflow-y-auto max-h-[90vh]">
            <h4 className="text-xl md:text-2xl font-black uppercase tracking-tighter text-slate-950 mb-10 italic border-b border-slate-100 pb-6">Registrasi Unit Armada</h4>
            <form onSubmit={handleAddVehicle} className="space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Plat Nomor</label>
                   <input type="text" placeholder="B 1234 XYZ" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black uppercase outline-none focus:ring-2 focus:ring-blue-500" required onChange={e => setNewVehicle({...newVehicle, plateNumber: e.target.value})} />
                 </div>
                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Model / Brand</label>
                   <input type="text" placeholder="SCANIA / HINO" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black uppercase outline-none focus:ring-2 focus:ring-blue-500" required onChange={e => setNewVehicle({...newVehicle, model: e.target.value})} />
                 </div>
               </div>
               <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipe Karoseri</label>
                   <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black outline-none focus:ring-2 focus:ring-blue-500" required onChange={e => setNewVehicle({...newVehicle, type: e.target.value as any})}>
                     <option value="CONTAINER">Container</option>
                     <option value="WINGBOX">Wingbox</option>
                     <option value="FLATBED">Flatbed</option>
                   </select>
                 </div>
                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status Awal</label>
                   <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black outline-none focus:ring-2 focus:ring-blue-500" required onChange={e => setNewVehicle({...newVehicle, status: e.target.value as any})}>
                     <option value="AKTIF">Aktif / Siap</option>
                     <option value="STANDBY">Standby</option>
                     <option value="PERBAIKAN">Maintenance</option>
                   </select>
                 </div>
               </div>
               <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ID GPS Tracker (Mendaftarkan Lokasi)</label>
                 <div className="relative">
                   <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-blue-500 opacity-50">
                     <ICONS.Location className="w-4 h-4" />
                   </div>
                   <input 
                     type="text" 
                     placeholder="E.G. GPS-TRACK-2024-X" 
                     className="w-full bg-slate-50 border border-blue-100 rounded-2xl pl-12 pr-6 py-4 text-sm font-black uppercase outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-blue-200" 
                     onChange={e => setNewVehicle({...newVehicle, gpsId: e.target.value})} 
                   />
                 </div>
                 <p className="text-[9px] font-bold text-slate-400 mt-1 ml-1 uppercase">*ID GPS digunakan untuk pelacakan unit secara real-time di Dashboard.</p>
               </div>
               <div className="flex gap-4 pt-10">
                 <button type="button" onClick={() => setShowAddVehicleForm(false)} className="flex-1 px-4 py-5 text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900">Batalkan</button>
                 <button type="submit" className="flex-1 px-4 py-5 bg-blue-600 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl shadow-xl hover:bg-blue-700 transition-all">Daftarkan Unit</button>
               </div>
            </form>
          </div>
        </div>
      )}

      {/* MANIFEST PREVIEW MODAL */}
      {selectedManifest && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/95 backdrop-blur-xl md:p-10 overflow-y-auto">
          <div className="w-full max-w-5xl my-auto animate-in fade-in zoom-in-95 duration-500">
            <div className="flex justify-between items-center mb-6 text-white px-6">
               <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.4em] opacity-60">Manifest Intelligence Report</p>
               <button onClick={() => setSelectedManifest(null)} className="p-2.5 bg-white/10 hover:bg-red-500 rounded-full transition-all">
                  <ICONS.Plus className="w-6 h-6 rotate-45" />
               </button>
            </div>

            <div className="relative overflow-x-auto pb-10">
              <div id="manifest-print-area" className="bg-white mx-auto rounded-[1.5rem] md:rounded-[3rem] shadow-2xl relative overflow-hidden flex flex-col min-h-[1000px] md:min-h-[1100px] w-full md:min-w-[900px] min-w-[320px] border-[10px] md:border-[16px] border-slate-100">
                <div className="absolute left-0 top-0 bottom-0 w-2 md:w-2.5 bg-blue-700" />

                <div className="p-8 md:p-16 pb-8 md:pb-12 border-b-2 border-slate-100">
                    <div className="flex flex-col md:flex-row justify-between items-start gap-8">
                      <div className="flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-8">
                          {companySettings.logo ? (
                            <img src={companySettings.logo} className="w-16 md:w-24 h-16 md:h-24 object-contain" />
                          ) : (
                            <div className="w-16 md:w-24 h-16 md:h-24 bg-blue-700 rounded-2xl md:rounded-3xl flex items-center justify-center text-white"><ICONS.Truck className="w-8 md:w-12 h-8 md:h-12" /></div>
                          )}
                          <div>
                            <h1 className="text-2xl md:text-4xl font-black italic tracking-tighter uppercase text-slate-950 leading-none">{companySettings.name}</h1>
                            <p className="text-[8px] md:text-[10px] font-black text-blue-700 uppercase tracking-[0.3em] mt-2">Logistics Supply Operations</p>
                          </div>
                      </div>
                      <div className="bg-slate-950 text-white p-6 md:p-8 rounded-2xl md:rounded-[2rem] w-full md:w-auto md:min-w-[260px]">
                          <p className="text-[8px] md:text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1 md:mb-3">Manifest ID</p>
                          <h2 className="text-2xl md:text-4xl font-mono font-black">#{selectedManifest.id}</h2>
                      </div>
                    </div>
                </div>

                <div className="p-8 md:p-16 pt-8 md:pt-12 space-y-8 md:space-y-12 flex-1">
                    <div className="grid grid-cols-2 md:grid-cols-4 border-2 border-slate-200 rounded-2xl md:rounded-[2.5rem] overflow-hidden">
                      <InfoBox label="Origin/Dest" value={selectedManifest.route} />
                      <InfoBox label="Payload" value={`${selectedManifest.tonnage}T`} highlight />
                      <InfoBox 
                        label="Fuel Efficiency" 
                        value={efficiencyData.l100km > 0 ? `${efficiencyData.l100km.toFixed(1)} L/100KM` : 'Pending Data'} 
                        highlight 
                        status={efficiencyData.l100km > 45 ? 'KRITIS' : efficiencyData.l100km > 35 ? 'PERINGATAN' : 'AMAN'}
                      />
                      <InfoBox label="Trip Status" value={selectedManifest.endTime ? 'CLOSED' : 'ACTIVE'} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div className="bg-slate-50 p-6 md:p-8 rounded-3xl border border-slate-200">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Analisis Konsumsi BBM</p>
                          <div className="space-y-4">
                             <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-600">Total Liter</span>
                                <span className="text-xs font-black text-slate-900">{efficiencyData.liters.toLocaleString()} L</span>
                             </div>
                             <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-600">Jarak Tempuh</span>
                                <span className="text-xs font-black text-slate-900">{efficiencyData.distance.toLocaleString()} KM</span>
                             </div>
                             <div className="pt-4 border-t border-slate-200">
                                <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                                   <div 
                                      className={`h-full transition-all duration-1000 ${efficiencyData.l100km > 45 ? 'bg-red-500' : efficiencyData.l100km > 35 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                                      style={{ width: `${Math.min((efficiencyData.l100km / 60) * 100, 100)}%` }} 
                                   />
                                </div>
                                <p className="text-[8px] font-black text-slate-400 uppercase mt-2 tracking-widest text-right italic">*Berdasarkan standar operasional armada berat</p>
                             </div>
                          </div>
                       </div>
                       <div className="bg-slate-50 p-6 md:p-8 rounded-3xl border border-slate-200">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Detail Perjalanan</p>
                          <div className="space-y-2">
                             <p className="text-[10px] font-bold text-slate-500 uppercase">KM Awal: <span className="text-slate-900">{selectedManifest.kmStart.toLocaleString()}</span></p>
                             <p className="text-[10px] font-bold text-slate-500 uppercase">KM Akhir: <span className="text-slate-900">{selectedManifest.kmEnd ? selectedManifest.kmEnd.toLocaleString() : '---'}</span></p>
                             <p className="text-[10px] font-bold text-slate-500 uppercase">Tipe Kargo: <span className="text-slate-900">{selectedManifest.cargoType || 'Umum'}</span></p>
                             <p className="text-[10px] font-bold text-slate-500 uppercase">Lokasi Hauling: <span className="text-slate-900">{selectedManifest.haulingLocation || 'Default'}</span></p>
                          </div>
                       </div>
                    </div>

                    <div className="bg-[#020617] rounded-2xl md:rounded-[3rem] p-6 md:p-12 text-white border border-white/5 ring-1 ring-white/10">
                      <div className="flex items-center gap-4 mb-6 md:mb-10 pb-4 md:pb-6 border-b border-white/5">
                        <ICONS.Scan className="w-5 h-5 text-blue-400" />
                        <h4 className="text-[10px] md:text-[11px] font-black uppercase tracking-widest text-blue-400">Gemini Operational Intel</h4>
                      </div>
                      <div className="border-l-2 border-blue-500/30 pl-4 md:pl-10 py-2">
                        {isAnalyzing ? <div className="animate-pulse text-[10px] text-blue-400 uppercase tracking-widest">Synthesizing data...</div> : formatAIText(manifestAnalysis)}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-20 pt-8">
                      <SignatureBlock label="Operasional" name="Audit Sign" date={new Date().toLocaleDateString()} />
                      <SignatureBlock label="Driver" name={currentUser.name} date={new Date().toLocaleDateString()} />
                      <SignatureBlock label="Klien" name="Client Sign" dotted />
                    </div>
                </div>

                <div className="p-8 md:p-16 py-6 md:py-8 bg-slate-50 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center text-[8px] md:text-[9px] font-black uppercase text-slate-400 gap-4 tracking-[0.2em]">
                    <p>Smart Haulage ERP / Secure Ledger System</p>
                    <p>Authenticated: {new Date().toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse md:flex-row justify-end gap-4 px-6 md:px-0 pb-10">
               <button onClick={() => setSelectedManifest(null)} className="px-10 py-5 bg-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-white/20 transition-all">Kembali</button>
               <button onClick={handleDownloadPDF} disabled={isGeneratingPdf} className="px-10 py-5 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-2xl flex items-center justify-center gap-3 hover:bg-blue-700 transition-all">
                  {isGeneratingPdf ? 'Processing...' : 'Download PDF Manifest'}
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const InfoBox = ({ label, value, mono, highlight, status }: any) => {
  let statusClasses = '';
  if (status === 'KRITIS') statusClasses = 'bg-red-50/60 text-red-700 border-red-100';
  else if (status === 'PERINGATAN') statusClasses = 'bg-amber-50/60 text-amber-700 border-amber-100';
  else if (status === 'AMAN') statusClasses = 'bg-emerald-50/60 text-emerald-700 border-emerald-100';

  return (
    <div className={`p-4 md:p-10 border-b md:border-b-0 md:border-r border-slate-200 last:border-0 ${highlight && !status ? 'bg-blue-50/40' : ''} ${statusClasses}`}>
      <p className={`text-[8px] md:text-[9px] font-black uppercase mb-1 md:mb-4 tracking-widest ${status ? '' : 'text-slate-400'}`}>{label}</p>
      <p className={`text-xs md:text-sm font-black uppercase tracking-tight ${mono ? 'font-mono' : ''} ${highlight && !status ? 'text-blue-700' : ''}`}>{value}</p>
    </div>
  );
};

const SignatureBlock = ({ label, name, date, dotted }: any) => (
  <div className="text-center">
    <div className={`h-16 md:h-24 mb-4 md:mb-6 flex items-center justify-center ${dotted ? 'border-2 border-dashed border-slate-100 rounded-xl md:rounded-3xl' : ''}`}>
       {!dotted && <div className="w-12 md:w-16 h-12 md:h-16 border-2 md:border-4 border-blue-100 rounded-full flex items-center justify-center opacity-20"><p className="text-[6px] font-black text-blue-600">HG_CERT</p></div>}
    </div>
    <p className="text-[10px] md:text-xs font-black text-slate-900 uppercase border-b border-slate-900 pb-1 mb-1">{name}</p>
    <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
  </div>
);

export default Operations;
