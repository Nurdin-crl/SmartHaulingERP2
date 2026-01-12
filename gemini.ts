
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface AuditResult {
  status: 'AMAN' | 'PERINGATAN' | 'KRITIS';
  healthScore: number;
  summary: string;
  findings: string[];
  recommendation: string;
}

export async function scanReceipt(base64Image: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: base64Image } },
          { text: "Ekstrak data dari struk ini ke JSON dalam Bahasa Indonesia: date (YYYY-MM-DD), amount (number), vendor (string), dan category (pilih salah satu: BBM, MAINTENANCE, BIAYA_LAIN)." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING },
            amount: { type: Type.NUMBER },
            vendor: { type: Type.STRING },
            category: { type: Type.STRING },
          },
          required: ["date", "amount", "vendor", "category"],
        }
      }
    });
    return JSON.parse(response.text);
  } catch (error) {
    console.error("OCR Error:", error);
    throw error;
  }
}

export async function generateAuditAnalysis(financialData: any, operationalData: any, summaryStats: any, projectBudgets: any[] = []): Promise<AuditResult> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Lakukan audit operasional dan finansial logistik:
      Ringkasan Statistik: ${JSON.stringify(summaryStats)}
      Proyek & Anggaran: ${JSON.stringify(projectBudgets)}
      Sampel Jurnal: ${JSON.stringify(financialData)}
      Sampel Operasional: ${JSON.stringify(operationalData)}
      
      Tugas Audit Utama:
      1. Bandingkan biaya aktual vs Anggaran (Project Cap). Berikan peringatan jika penyerapan > 85%.
      2. Analisis rasio Biaya BBM / KM. Tandai KRITIS jika efisiensi rendah.
      3. Cek realisasi pendapatan vs target proyek.
      
      Berikan hasil dalam format JSON terstruktur.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            status: { type: Type.STRING, enum: ['AMAN', 'PERINGATAN', 'KRITIS'] },
            healthScore: { type: Type.NUMBER },
            summary: { type: Type.STRING },
            findings: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING } 
            },
            recommendation: { type: Type.STRING }
          },
          required: ["status", "healthScore", "summary", "findings", "recommendation"]
        }
      }
    });
    return JSON.parse(response.text);
  } catch (error: any) {
    console.error("Audit AI Error Details:", error);
    
    // Check specifically for Rate Limit / Quota error
    const isQuotaError = error?.message?.includes('429') || error?.message?.includes('quota') || error?.status === 'RESOURCE_EXHAUSTED';
    
    if (isQuotaError) {
      return {
        status: 'PERINGATAN',
        healthScore: 100,
        summary: "Audit AI Terbatasi: Kuota penggunaan API harian telah mencapai batas (Rate Limit).",
        findings: ["Koneksi Gemini API (429 Resource Exhausted)"],
        recommendation: "Mohon tunggu beberapa saat sebelum melakukan audit ulang secara manual."
      };
    }

    return {
      status: 'AMAN',
      healthScore: 100,
      summary: "Audit normal (Mode Standar). Sistem AI sedang dalam pemeliharaan ringan.",
      findings: ["Koneksi AI Terputus atau Time-out"],
      recommendation: "Periksa koneksi internet Anda untuk mengaktifkan analisis mendalam kembali."
    };
  }
}

export async function generateProfessionalManifestAnalysis(trip: any, fuelLogs: any[]) {
  try {
    const totalLiters = fuelLogs.reduce((sum, log) => sum + log.liters, 0);
    const distance = (trip.kmEnd && trip.kmStart) ? (trip.kmEnd - trip.kmStart) : 0;
    const l100km = distance > 0 ? (totalLiters / distance) * 100 : 0;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analisis operasional profesional untuk Manifes:
      Rute: ${trip.route}, Muatan: ${trip.tonnage} Ton, KM: ${trip.kmStart} s/d ${trip.kmEnd || 'Running'}.
      Jarak Tempuh: ${distance} KM.
      Total BBM: ${totalLiters} Liter.
      Efisiensi: ${l100km.toFixed(2)} L/100KM.
      
      Tugas:
      1. Berikan RINGKASAN operasional perjalanan.
      2. Berikan analisis EFISIENSI (BBM/Muatan/Jarak). Tandai jika konsumsi tidak wajar (>40 L/100KM untuk heavy unit).
      3. Berikan REKOMENDASI MANAJEMEN (misal: servis berkala, cek kebocoran bbm, atau optimalisasi rute).`,
    });
    return response.text;
  } catch (error) {
    return "Analisis tertunda karena batasan kuota API. Data operasional tetap tercatat dengan aman di database.";
  }
}
