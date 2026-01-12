
import React, { useState } from 'react';
import { AttendanceRecord, User, UserRole } from '../types';
import { ICONS } from '../constants';

interface HRProps {
  attendance: AttendanceRecord[];
  setAttendance: React.Dispatch<React.SetStateAction<AttendanceRecord[]>>;
  currentUser: User;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
}

const HR: React.FC<HRProps> = ({ attendance, setAttendance, currentUser, users, setUsers }) => {
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [showManualAbsen, setShowManualAbsen] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'absen' | 'karyawan'>('absen');

  const [manualAbsen, setManualAbsen] = useState({
    date: new Date().toISOString().split('T')[0],
    time: "08:00"
  });

  const [newUser, setNewUser] = useState<Partial<User>>({
    name: '',
    email: '',
    role: UserRole.OPERATOR
  });

  const handleCheckIn = () => {
    setIsCheckingIn(true);
    if (!navigator.geolocation) {
      alert("Geolocation tidak didukung browser ini.");
      setIsCheckingIn(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newRecord: AttendanceRecord = {
          id: `att-gps-${Date.now()}`,
          userId: currentUser.id,
          checkIn: new Date().toISOString(),
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setAttendance(prev => [newRecord, ...prev]);
        setIsCheckingIn(false);
      },
      (error) => {
        setIsCheckingIn(false);
        alert("Gagal mengambil lokasi. Gunakan input manual.");
      }
    );
  };

  const handleManualAbsen = (e: React.FormEvent) => {
    e.preventDefault();
    const newRecord: AttendanceRecord = {
      id: `att-man-${Date.now()}`,
      userId: currentUser.id,
      checkIn: `${manualAbsen.date}T${manualAbsen.time}:00`,
      lat: 0,
      lng: 0
    };
    setAttendance(prev => [newRecord, ...prev]);
    setShowManualAbsen(false);
  };

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    const user: User = {
      ...newUser as User,
      id: `u-${Date.now()}`
    };
    setUsers(prev => [...prev, user]);
    setShowAddUserModal(false);
    setNewUser({ name: '', email: '', role: UserRole.OPERATOR });
  };

  const handleDeleteUser = (id: string) => {
    if (id === currentUser.id) {
      alert("Anda tidak dapat menghapus akun Anda sendiri.");
      return;
    }
    if (confirm("Apakah Anda yakin ingin menghapus karyawan ini dari sistem?")) {
      setUsers(prev => prev.filter(u => u.id !== id));
    }
  };

  const myAttendance = attendance.filter(a => a.userId === currentUser.id);
  const isOwner = currentUser.role === UserRole.OWNER || currentUser.role === UserRole.DEVELOPER;

  return (
    <div className="space-y-6">
      {/* Tab Navigation for HR */}
      {isOwner && (
        <div className="flex gap-4 p-1 bg-slate-100 rounded-2xl w-fit mb-6">
          <button 
            onClick={() => setActiveTab('absen')}
            className={`px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
              activeTab === 'absen' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Absensi & Lokasi
          </button>
          <button 
            onClick={() => setActiveTab('karyawan')}
            className={`px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
              activeTab === 'karyawan' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Manajemen Karyawan
          </button>
        </div>
      )}

      {activeTab === 'absen' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm text-center">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 mx-auto mb-4">
                <ICONS.Location className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-bold text-slate-900 mb-1">Check-in Live GPS</h4>
              <p className="text-sm text-slate-500 mb-6">Verifikasi lokasi otomatis untuk pengemudi & operasional.</p>
              <button 
                onClick={handleCheckIn}
                disabled={isCheckingIn}
                className={`w-full py-3 rounded-xl font-bold transition-all ${
                  isCheckingIn ? 'bg-slate-100 text-slate-400' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg'
                }`}
              >
                {isCheckingIn ? 'Memproses...' : 'Absen Sekarang'}
              </button>
              <button 
                onClick={() => setShowManualAbsen(true)}
                className="w-full mt-3 py-2 text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors"
              >
                Masukkan Manual
              </button>
            </div>
          </div>

          <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h4 className="font-bold text-slate-800">Riwayat Kehadiran Saya</h4>
              <span className="text-xs text-slate-400">Terbaru</span>
            </div>
            <div className="divide-y divide-slate-50">
              {myAttendance.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <p className="text-sm">Belum ada data absensi hari ini.</p>
                </div>
              ) : (
                myAttendance.map(record => (
                  <div key={record.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${record.lat === 0 ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'}`}>
                        <ICONS.Location className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          {new Date(record.checkIn).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </p>
                        <p className="text-xs text-slate-500">
                          Pukul {new Date(record.checkIn).toLocaleTimeString('id-ID')} {record.lat === 0 ? '(Manual)' : `(GPS: ${record.lat.toFixed(4)}, ${record.lng.toFixed(4)})`}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-500">
          <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase italic">Direktori Karyawan</h3>
              <p className="text-[10px] text-blue-600 font-black uppercase tracking-[0.3em]">Otoritas Pemilik & Manajemen</p>
            </div>
            <button 
              onClick={() => setShowAddUserModal(true)}
              className="px-6 py-3 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-blue-600 transition-all flex items-center gap-2 shadow-xl"
            >
              <ICONS.Plus className="w-4 h-4" /> Tambah Karyawan
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nama & Email</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Peran Akses</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-lg uppercase shadow-md">
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-900 uppercase tracking-tighter">{user.name}</p>
                          <p className="text-xs text-slate-400 font-medium lowercase">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`px-4 py-1 text-[9px] font-black rounded-full border uppercase tracking-widest ${
                        user.role === UserRole.OWNER ? 'bg-blue-50 text-blue-600 border-blue-100' :
                        user.role === UserRole.ADMIN ? 'bg-purple-50 text-purple-600 border-purple-100' :
                        'bg-slate-50 text-slate-500 border-slate-200'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      {user.id !== currentUser.id && (
                        <button 
                          onClick={() => handleDeleteUser(user.id)}
                          className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                          title="Hapus Karyawan"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Absensi Manual */}
      {showManualAbsen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <h4 className="text-lg font-black mb-6 text-center uppercase tracking-tighter italic">Input Absensi Manual</h4>
            <form onSubmit={handleManualAbsen} className="space-y-4">
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Tanggal</label>
                <input type="date" value={manualAbsen.date} onChange={e => setManualAbsen({...manualAbsen, date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-black outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Waktu Check-in</label>
                <input type="time" value={manualAbsen.time} onChange={e => setManualAbsen({...manualAbsen, time: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-black outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div className="flex gap-3 pt-6">
                <button type="button" onClick={() => setShowManualAbsen(false)} className="flex-1 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Batal</button>
                <button type="submit" className="flex-1 px-4 py-3 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg">Simpan Absen</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tambah Karyawan */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-6">
               <h4 className="text-2xl font-black uppercase tracking-tighter text-slate-950 italic">Inisiasi Akun Karyawan</h4>
               <button onClick={() => setShowAddUserModal(false)} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                  <ICONS.Plus className="w-6 h-6 rotate-45" />
               </button>
            </div>
            
            <form onSubmit={handleAddUser} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Lengkap</label>
                <input 
                  type="text" 
                  placeholder="e.g. Andi Perkasa" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black outline-none focus:ring-2 focus:ring-blue-500 uppercase" 
                  required 
                  onChange={e => setNewUser({...newUser, name: e.target.value})} 
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Perusahaan</label>
                <input 
                  type="email" 
                  placeholder="e.g. andi@smarthaul.id" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black outline-none focus:ring-2 focus:ring-blue-500" 
                  required 
                  onChange={e => setNewUser({...newUser, email: e.target.value})} 
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Peran & Hak Akses</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}
                >
                  <option value={UserRole.OPERATOR}>OPERATOR (DRIVER/LAPANGAN)</option>
                  <option value={UserRole.ADMIN}>ADMIN (KANTOR/KEUANGAN)</option>
                  <option value={UserRole.OWNER}>PEMILIK (AKSES PENUH)</option>
                </select>
              </div>

              <div className="flex gap-4 pt-10">
                <button type="button" onClick={() => setShowAddUserModal(false)} className="flex-1 px-4 py-5 text-[11px] font-black uppercase tracking-widest text-slate-400">Batalkan</button>
                <button type="submit" className="flex-1 px-4 py-5 bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl shadow-xl hover:bg-blue-600 transition-all">Daftarkan Karyawan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HR;
