
import React, { useState, useEffect } from 'react';
import { 
  UserRole, 
  User, 
  Vehicle, 
  TripLog, 
  LedgerEntry, 
  ProjectBudget, 
  AttendanceRecord,
  FuelLog,
  AccountType,
  CompanySettings
} from './types';
import { ICONS, COMPANY_NAME } from './constants';
import DashboardView from './components/Dashboard';
import OperationsView from './components/Operations';
import FinanceView from './components/Finance';
import HRView from './components/HR';
import SettingsView from './components/Settings';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('dasbor');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Initializing with a single primary admin user instead of demo list
  const [users, setUsers] = useState<User[]>([
    { id: 'admin-01', name: 'ADMIN UTAMA', role: UserRole.OWNER, email: 'admin@perusahaan.id' },
  ]);

  const [currentUser, setCurrentUser] = useState<User>(users[0]);

  const [companySettings, setCompanySettings] = useState<CompanySettings>({
    name: "NAMA PERUSAHAAN ANDA",
    address: "ALAMAT LENGKAP KANTOR",
    logo: null,
    registrationId: "NIB-BELUM-DIATUR"
  });

  // All operational and financial data initialized as empty arrays
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [tripLogs, setTripLogs] = useState<TripLog[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
  const [projects, setProjects] = useState<ProjectBudget[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);

  const navItems = [
    { id: 'dasbor', label: 'Dasbor', icon: ICONS.Dashboard, roles: [UserRole.OWNER, UserRole.ADMIN, UserRole.DEVELOPER] },
    { id: 'operasional', label: 'Operasional', icon: ICONS.Truck, roles: [UserRole.OWNER, UserRole.ADMIN, UserRole.OPERATOR, UserRole.DEVELOPER] },
    { id: 'keuangan', label: 'Keuangan', icon: ICONS.Finance, roles: [UserRole.OWNER, UserRole.ADMIN, UserRole.DEVELOPER] },
    { id: 'sdm', label: 'SDM & Absensi', icon: ICONS.HR, roles: [UserRole.OWNER, UserRole.ADMIN, UserRole.OPERATOR, UserRole.DEVELOPER] },
    { id: 'pengaturan', label: 'Pengaturan', icon: ICONS.Settings, roles: [UserRole.OWNER, UserRole.ADMIN, UserRole.DEVELOPER] },
  ];

  const filteredNav = navItems.filter(item => item.roles.includes(currentUser.role));

  const handleRoleChange = (role: UserRole) => {
    const matchedUser = users.find(u => u.role === role) || users[0];
    setCurrentUser(matchedUser);
    setActiveTab(role === UserRole.OPERATOR ? 'operasional' : 'dasbor');
    setIsSidebarOpen(false);
  };

  const handleTabClick = (id: string) => {
    setActiveTab(id);
    setIsSidebarOpen(false);
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans relative">
      {/* MOBILE SIDEBAR OVERLAY */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR NAVIGATION */}
      <aside className={`fixed inset-y-0 left-0 w-72 bg-white border-r border-slate-200 flex flex-col shadow-2xl z-50 transition-transform duration-300 md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {companySettings.logo ? (
              <img src={companySettings.logo} alt="Logo" className="w-10 h-10 rounded-xl object-contain shadow-sm border border-slate-100" />
            ) : (
              <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-lg">
                <ICONS.Truck className="w-6 h-6" />
              </div>
            )}
            <h1 className="text-lg font-black tracking-tighter text-slate-900 leading-none">
              {companySettings.name.split(' ')[0]}<br/>
              <span className="text-blue-600 opacity-80">{companySettings.name.split(' ').slice(1).join(' ')}</span>
            </h1>
          </div>
          <button className="md:hidden p-2 text-slate-400" onClick={() => setIsSidebarOpen(false)}>
            <ICONS.Plus className="w-6 h-6 rotate-45" />
          </button>
        </div>
        
        <nav className="flex-1 px-6 py-4 space-y-2 overflow-y-auto">
          {filteredNav.map(item => (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              className={`w-full flex items-center gap-4 px-5 py-3.5 text-xs font-black uppercase tracking-widest rounded-2xl transition-all ${
                activeTab === item.id 
                  ? 'bg-blue-600 text-white shadow-xl shadow-blue-200 translate-x-1' 
                  : 'text-slate-400 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white font-black text-lg shadow-lg uppercase">
              {currentUser.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-slate-900 truncate uppercase tracking-tighter">{currentUser.name}</p>
              <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{currentUser.role}</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Simulasi Peran</p>
            <div className="grid grid-cols-2 gap-2">
              {Object.values(UserRole).map(role => (
                <button 
                  key={role}
                  onClick={() => handleRoleChange(role)}
                  className={`text-[8px] font-black uppercase px-2 py-2 rounded-lg border transition-all ${
                    currentUser.role === role ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  {role.substring(0, 5)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto relative flex flex-col h-full">
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-slate-200 px-4 md:px-10 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              className="p-2 -ml-2 text-slate-600 md:hidden bg-slate-50 rounded-xl"
              onClick={() => setIsSidebarOpen(true)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
            </button>
            <h2 className="text-lg md:text-xl font-black text-slate-900 uppercase tracking-tighter italic">{activeTab}</h2>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col text-right">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Waktu Sistem</p>
              <p className="text-[11px] font-black text-slate-900">{new Date().toLocaleDateString('id-ID', { dateStyle: 'medium' })}</p>
            </div>
            <div className="px-3 py-1.5 bg-emerald-50 text-emerald-600 text-[9px] font-black rounded-xl border border-emerald-100 flex items-center gap-1.5 uppercase tracking-widest">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              Live
            </div>
          </div>
        </header>

        <div className="p-4 md:p-10 max-w-7xl mx-auto w-full flex-1">
          {activeTab === 'dasbor' && <DashboardView projects={projects} ledger={ledger} tripLogs={tripLogs} />}
          {activeTab === 'operasional' && (
            <OperationsView 
              tripLogs={tripLogs} 
              setTripLogs={setTripLogs} 
              vehicles={vehicles} 
              setVehicles={setVehicles}
              currentUser={currentUser}
              companySettings={companySettings}
              fuelLogs={fuelLogs}
            />
          )}
          {activeTab === 'keuangan' && (
            <FinanceView 
              ledger={ledger} 
              setLedger={setLedger} 
              tripLogs={tripLogs} 
              setFuelLogs={setFuelLogs} 
              fuelLogs={fuelLogs} 
              attendance={attendance} 
              currentUser={currentUser}
              projects={projects}
              setProjects={setProjects}
              companySettings={companySettings}
            />
          )}
          {activeTab === 'sdm' && (
            <HRView 
              attendance={attendance} 
              setAttendance={setAttendance} 
              currentUser={currentUser} 
              users={users}
              setUsers={setUsers}
            />
          )}
          {activeTab === 'pengaturan' && (
            <SettingsView 
              companySettings={companySettings} 
              setCompanySettings={setCompanySettings} 
              currentUser={currentUser}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
