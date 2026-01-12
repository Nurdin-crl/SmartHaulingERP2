
import React, { useRef } from 'react';
import { CompanySettings, User, UserRole } from '../types';
import { ICONS } from '../constants';

interface SettingsProps {
  companySettings: CompanySettings;
  setCompanySettings: React.Dispatch<React.SetStateAction<CompanySettings>>;
  currentUser: User;
}

const Settings: React.FC<SettingsProps> = ({ companySettings, setCompanySettings, currentUser }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCompanySettings(prev => ({ ...prev, logo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const isAuthorized = currentUser.role === UserRole.OWNER || currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.DEVELOPER;

  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
         <div className="p-6 bg-red-50 text-red-500 rounded-full mb-6">
            <ICONS.Settings className="w-12 h-12" />
         </div>
         <h3 className="text-xl font-black uppercase tracking-tighter text-slate-900">Akses Terbatas</h3>
         <p className="text-sm text-slate-500 mt-2 max-w-xs">Hanya Owner dan Admin yang diizinkan mengelola identitas perusahaan.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-10">
      <section>
        <div className="flex justify-between items-end mb-8 border-b border-slate-200 pb-6">
          <div>
            <h3 className="text-2xl font-black text-slate-950 tracking-tighter uppercase italic">Identitas & Branding</h3>
            <p className="text-[10px] text-blue-600 font-black uppercase tracking-[0.3em] mt-1">Kustomisasi Dokumen & Laporan</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Logo Resmi Perusahaan</p>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-48 h-48 mx-auto bg-slate-50 border-4 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center cursor-pointer hover:border-blue-600 hover:bg-blue-50/30 transition-all group overflow-hidden relative"
              >
                {companySettings.logo ? (
                  <img src={companySettings.logo} alt="Logo" className="w-full h-full object-contain p-4 group-hover:scale-110 transition-transform duration-500" />
                ) : (
                  <>
                    <ICONS.Scan className="w-10 h-10 text-slate-300 group-hover:text-blue-500 transition-colors" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4">Upload PNG/JPG</p>
                  </>
                )}
                <input type="file" ref={fileInputRef} onChange={handleLogoUpload} accept="image/*" className="hidden" />
              </div>
              <button onClick={() => setCompanySettings(prev => ({...prev, logo: null}))} className="mt-6 text-[10px] font-black text-red-500 uppercase tracking-widest hover:underline">Hapus Logo</button>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm space-y-8">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Resmi Perusahaan</label>
                    <input 
                      type="text" 
                      value={companySettings.name}
                      onChange={e => setCompanySettings({...companySettings, name: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">NIB / Registration ID</label>
                    <input 
                      type="text" 
                      value={companySettings.registrationId}
                      onChange={e => setCompanySettings({...companySettings, registrationId: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
               </div>
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Alamat Kantor (Kop Surat)</label>
                  <textarea 
                    rows={4}
                    value={companySettings.address}
                    onChange={e => setCompanySettings({...companySettings, address: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black outline-none focus:ring-2 focus:ring-blue-500 uppercase leading-relaxed"
                  />
               </div>
               <div className="pt-4">
                  <button className="w-full py-5 bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest rounded-3xl shadow-2xl shadow-slate-200 hover:bg-blue-600 transition-all flex items-center justify-center gap-3">
                    <ICONS.Dashboard className="w-5 h-5" /> Simpan Konfigurasi
                  </button>
               </div>
            </div>
          </div>
        </div>
      </section>

      <section>
         <h3 className="text-xl font-black text-slate-950 tracking-tighter uppercase italic mb-8">Service Engine (GCP)</h3>
         <div className="bg-slate-950 rounded-[3rem] p-12 text-white shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-12 opacity-5 group-hover:rotate-45 transition-transform duration-1000">
               <ICONS.Settings className="w-48 h-48" />
            </div>
            <div className="flex items-center justify-between mb-10 border-b border-white/10 pb-10">
               <div className="flex items-center gap-6">
                  <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                     <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                  </div>
                  <div>
                     <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] mb-1">Global Compute Engine</p>
                     <h4 className="text-xl font-black uppercase tracking-tight">Active Instance: Jakarta-Region-A1</h4>
                  </div>
               </div>
               <span className="px-4 py-1.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-black rounded-xl border border-emerald-500/30 uppercase tracking-widest">Health OK</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
               <div className="p-8 bg-white/5 rounded-[2.5rem] border border-white/10 group-hover:border-blue-500/30 transition-all">
                  <p className="text-[9px] font-black text-slate-500 uppercase mb-4 tracking-widest">Microservices Log</p>
                  <ul className="space-y-4">
                     {['Vertex AI Document OCR', 'BigQuery Analytics Sync', 'Cloud SQL PostgreSQL 15'].map((service, i) => (
                        <li key={i} className="flex items-center gap-3 text-xs font-bold text-slate-300">
                           <div className="w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                           {service}
                        </li>
                     ))}
                  </ul>
               </div>
               <div className="flex flex-col justify-center gap-4">
                  <p className="text-[10px] text-slate-400 font-medium leading-relaxed italic">
                    "Sistem sedang berjalan dalam mode Enterprise. Seluruh transaksi finansial dienkripsi menggunakan standar AES-256 dan terverifikasi oleh Vertex AI Audit Trail."
                  </p>
                  <button className="mt-4 px-10 py-4 bg-white text-slate-950 text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-blue-600 hover:text-white transition-all shadow-xl">
                    Verifikasi Koneksi API & Latency
                  </button>
               </div>
            </div>
         </div>
      </section>
    </div>
  );
};

export default Settings;
