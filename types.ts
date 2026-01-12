
export enum UserRole {
  DEVELOPER = 'DEVELOPER',
  OWNER = 'PEMILIK',
  ADMIN = 'ADMIN',
  OPERATOR = 'OPERATOR'
}

export enum AccountType {
  ASSET = 'ASET',
  LIABILITY = 'KEWAJIBAN',
  EQUITY = 'EKUITAS',
  REVENUE = 'PENDAPATAN',
  EXPENSE = 'BEBAN'
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  email: string;
}

export interface Vehicle {
  id: string;
  plateNumber: string;
  model: string;
  type: 'FLATBED' | 'CONTAINER' | 'WINGBOX';
  status: 'AKTIF' | 'PERBAIKAN' | 'STANDBY';
  gpsId?: string;
}

export interface TripLog {
  id: string;
  vehicleId: string;
  driverId: string;
  route: string;
  tonnage: number;
  startTime: string;
  endTime?: string;
  kmStart: number;
  kmEnd?: number;
  cargoType?: string;
  haulingLocation?: string;
}

export interface FuelLog {
  id: string;
  tripId: string;
  liters: number;
  cost: number;
  date: string;
  receiptUrl?: string;
}

export type FinancialCategory = 
  | 'MAINTENANCE' | 'GAJI' | 'BBM' | 'INVOICE' | 'REVENUE' | 'CASH' | 'BANK'
  | 'PAJAK' | 'ASURANSI' | 'SEWA_KANTOR' | 'LISTRIK_AIR' | 'ATK' | 'PERIZINAN'
  | 'BUNGA_BANK' | 'PENYUSUTAN' | 'BIAYA_LAIN';

export interface LedgerEntry {
  id: string;
  date: string;
  description: string;
  debit: number;
  credit: number;
  accountId: string;
  accountType: AccountType;
  category: FinancialCategory;
  journalId: string;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  checkIn: string;
  checkOut?: string;
  lat: number;
  lng: number;
}

export interface ProjectBudget {
  id: string;
  name: string;
  cap: number;
  targetRevenue: number;
  realizedCost: number;
  realizedRevenue: number;
  startDate: string;
  status: 'PLANNING' | 'ACTIVE' | 'CLOSED';
}

export interface CompanySettings {
  name: string;
  address: string;
  logo: string | null;
  registrationId: string;
}
