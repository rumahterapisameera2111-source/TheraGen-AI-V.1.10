import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface SessionData {
  clientName: string;
  clientAge: string;
  clientGender: string;
  sessionDate: string;
  sessionNumber: string;
  therapyType: string;
  reportStyle: string; // 'Concise', 'Detailed', 'Empathy-focused'
  
  presentingProblem: string;
  initialObservation: string;
  initialSUD: string;
  
  techniquesUsed: string;
  tranceDepth: string;
  sessionDynamics: string;
  
  finalSUD: string;
  postObservation: string;
  homework: string;
  nextPlan: string;
}

export async function analyzeTherapistNotes(file: File): Promise<Partial<SessionData>> {
  const base64EncodedDataPromise = new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const base64Data = await base64EncodedDataPromise;

  const prompt = `Anda adalah asisten AI untuk hipnoterapis.
Tugas Anda adalah membaca catatan tulisan tangan atau ketikan dari terapis ini dan mengekstrak informasinya ke dalam format JSON.
Cocokkan informasi dengan field berikut jika ada:
- clientName (Nama Klien)
- clientAge (Usia)
- clientGender (Laki-laki/Perempuan)
- presentingProblem (Keluhan Utama)
- initialObservation (Observasi Awal)
- initialSUD (Skala SUD Awal 1-10)
- techniquesUsed (Teknik yang Digunakan)
- tranceDepth (Kedalaman Trance - jika ada)
- sessionDynamics (Dinamika Sesi)
- finalSUD (Skala SUD Akhir 1-10)
- postObservation (Observasi Pasca-Sesi)
- homework (Tugas/PR)
- nextPlan (Rencana Sesi Selanjutnya)

Jika ada field yang tidak ditemukan di catatan, kosongkan saja string-nya ("").`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: file.type,
            },
          },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            clientName: { type: Type.STRING },
            clientAge: { type: Type.STRING },
            clientGender: { type: Type.STRING },
            presentingProblem: { type: Type.STRING },
            initialObservation: { type: Type.STRING },
            initialSUD: { type: Type.STRING },
            techniquesUsed: { type: Type.STRING },
            tranceDepth: { type: Type.STRING },
            sessionDynamics: { type: Type.STRING },
            finalSUD: { type: Type.STRING },
            postObservation: { type: Type.STRING },
            homework: { type: Type.STRING },
            nextPlan: { type: Type.STRING },
          },
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("Gagal mengekstrak data dari gambar.");
    return JSON.parse(text);
  } catch (error) {
    console.error("Error analyzing notes:", error);
    throw new Error("Terjadi kesalahan saat menganalisis gambar catatan.");
  }
}

export async function generateNextSessionPlan(data: SessionData, report: string, planSessionsCount: number = 1): Promise<string> {
  const prompt = `
Anda adalah seorang hipnoterapis profesional (Satria Siddik S.Psi, C.T, C.PHt, C.NLP).
Berdasarkan data sesi dan laporan sesi sebelumnya di bawah ini, buatkan Perencanaan Sesi Lanjutan (Treatment Plan) jangka panjang yang komprehensif, terstruktur, dan profesional untuk ${planSessionsCount} sesi ke depan.

DATA SESI SEBELUMNYA:
- Nama Klien: ${data.clientName || '-'}
- Keluhan Utama: ${data.presentingProblem || '-'}
- Teknik Terakhir: ${data.techniquesUsed || '-'}
- Dinamika Sesi: ${data.sessionDynamics || '-'}
- PR/Tugas: ${data.homework || '-'}
- Rencana Awal: ${data.nextPlan || '-'}

LAPORAN SESI SEBELUMNYA:
${report}

Tugas Anda:
Buatlah dokumen "Rencana Sesi Lanjutan (${planSessionsCount} Sesi)" yang mencakup perencanaan bertahap untuk setiap sesi.
Untuk masing-masing sesi lanjutan (Sesi 1 dari rencana, Sesi 2 dari rencana, dst.), jabarkan:
1. Tujuan Sesi (Goals)
2. Review & Evaluasi (Apa yang perlu dicek di awal sesi)
3. Rencana Intervensi & Teknik (Teknik spesifik apa yang disarankan)
4. Antisipasi Kendala (Potensi resistensi atau abreaksi dan cara menanganinya)
5. Indikator Keberhasilan Sesi

Berikan juga ringkasan tujuan akhir (Ultimate Goal) dari seluruh rangkaian ${planSessionsCount} sesi ini di bagian awal dokumen.

Format dalam Markdown yang rapi dengan heading (gunakan ## untuk pemisah antar sesi), bullet points, dan bahasa Indonesia klinis yang profesional.
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        temperature: 0.5,
      }
    });
    
    return response.text || "Gagal menghasilkan rencana sesi.";
  } catch (error) {
    console.error("Error generating plan:", error);
    throw new Error("Terjadi kesalahan saat membuat rencana sesi selanjutnya.");
  }
}

export async function generateClinicalReport(data: SessionData): Promise<string> {
  const styleInstruction = 
    data.reportStyle === 'Concise' ? 'Buat laporan yang sangat padat, singkat, dan langsung pada intinya (bullet points dominan).' :
    data.reportStyle === 'Empathy-focused' ? 'Buat laporan yang menonjolkan empati, dinamika emosional klien, dan proses terapeutik yang mendalam.' :
    'Buat laporan yang detail, komprehensif, dan mencakup semua aspek klinis secara menyeluruh.';

  const prompt = `
Anda adalah seorang hipnoterapis profesional yang ahli dalam menulis laporan sesi terapi (Clinical Notes).
Tugas Anda adalah membuat laporan sesi yang komprehensif, terstruktur, rapi, dan profesional berdasarkan catatan mentah berikut ini.

GAYA PENULISAN:
${styleInstruction}
Gunakan bahasa Indonesia yang formal, empatik, dan klinis.

INFORMASI TERAPIS & KLINIK:
- Nama Terapis: Satria Siddik S.Psi, C.T, C.PHt, C.NLP
- Nama Klinik: Rumah Terapi Sameera

DATA SESI:
- Nama Klien: ${data.clientName || '-'}
- Umur: ${data.clientAge || '-'}
- Jenis Kelamin: ${data.clientGender || '-'}
- Tanggal Sesi: ${data.sessionDate || '-'}
- Sesi Ke: ${data.sessionNumber || '-'}
- Pendekatan/Jenis Terapi: ${data.therapyType || '-'}

ASESMEN AWAL:
- Keluhan Utama: ${data.presentingProblem || '-'}
- Observasi Awal (Fisik/Emosi): ${data.initialObservation || '-'}
- Skala SUD Awal (1-10): ${data.initialSUD || '-'}

PROSES TERAPI & INTERVENSI:
- Teknik yang Digunakan: ${data.techniquesUsed || '-'}
- Kedalaman Trance (jika relevan): ${data.tranceDepth || '-'}
- Dinamika Sesi & Insight: ${data.sessionDynamics || '-'}

HASIL & TINDAK LANJUT:
- Skala SUD Akhir (1-10): ${data.finalSUD || '-'}
- Observasi Pasca-Sesi: ${data.postObservation || '-'}
- Tugas / PR (Homework): ${data.homework || '-'}
- Rencana Sesi Selanjutnya: ${data.nextPlan || '-'}

FORMAT LAPORAN YANG DIHARAPKAN (Gunakan Markdown dengan spasi yang konsisten, heading yang tepat, dan bullet points yang rapi):

# Laporan Sesi Klinis
**Rumah Terapi Sameera**

---

## 1. Informasi Klien & Sesi
* **Nama Klien:** [Nama]
* **Umur / Gender:** [Umur] / [Gender]
* **Tanggal Sesi:** [Tanggal]
* **Sesi Ke:** [Nomor]
* **Pendekatan Terapi:** [Jenis Terapi]

## 2. Asesmen & Keluhan Awal
[Uraikan keluhan utama dan observasi awal menjadi paragraf klinis yang baik. Sebutkan Skala SUD Awal.]

## 3. Proses Terapi & Intervensi
[Jelaskan jalannya terapi, teknik yang dipakai, kedalaman trance (jika ada), dan respons klien selama sesi. Gunakan bullet points jika perlu untuk merinci teknik atau insight.]

## 4. Hasil & Evaluasi
[Bandingkan kondisi awal dan akhir, termasuk penurunan SUD. Deskripsikan observasi pasca-sesi.]

## 5. Rekomendasi & Rencana Tindak Lanjut
* **Tugas / PR:** [Tugas]
* **Rencana Sesi Berikutnya:** [Rencana]

---
**Terapis:**
Satria Siddik S.Psi, C.T, C.PHt, C.NLP

Pastikan laporannya mengalir dengan baik, tidak hanya sekadar menyalin poin-poin di atas, tetapi merangkainya menjadi narasi klinis yang utuh dan profesional. Jika ada data yang kosong (-), abaikan atau sesuaikan narasinya dengan wajar.
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        temperature: 0.4,
      }
    });
    
    return response.text || "Gagal menghasilkan laporan.";
  } catch (error) {
    console.error("Error generating report:", error);
    throw new Error("Terjadi kesalahan saat menghubungi AI. Pastikan API Key valid.");
  }
}

export async function generateClientReport(data: SessionData, report: string): Promise<string> {
  const prompt = `
Anda adalah seorang hipnoterapis profesional (Satria Siddik S.Psi, C.T, C.PHt, C.NLP).
Berdasarkan laporan sesi klinis di bawah ini, buatkan "Ringkasan Sesi untuk Klien" yang akan diberikan langsung kepada klien.

LAPORAN KLINIS (ARSIP TERAPIS):
${report}

Tugas Anda:
Buat ringkasan sesi dengan kriteria berikut:
1. Gunakan bahasa yang awam, sederhana, empatik, ramah, dan mudah dipahami oleh klien (hindari jargon klinis yang rumit).
2. Saring informasi: JANGAN sertakan analisis psikologis yang terlalu dalam, istilah teknis (seperti abreaksi, somnambulism, SUD), atau catatan sensitif yang hanya untuk arsip terapis.
3. Fokus pada:
   - Apresiasi atas kehadiran dan kerja keras klien di sesi ini.
   - Ringkasan singkat tentang apa yang telah dicapai atau dipelajari hari ini (secara positif).
   - Perubahan positif yang dirasakan (misal: merasa lebih lega, tenang).
   - Pengingat Tugas/PR (Homework) yang harus dilakukan klien di rumah.
   - Harapan atau pesan positif untuk sesi selanjutnya.

Format dalam Markdown yang rapi, ramah, dan profesional.
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        temperature: 0.6,
      }
    });
    
    return response.text || "Gagal menghasilkan ringkasan untuk klien.";
  } catch (error) {
    console.error("Error generating client report:", error);
    throw new Error("Terjadi kesalahan saat membuat ringkasan untuk klien.");
  }
}

export async function generateSuggestionsAndTips(data: SessionData, report: string): Promise<string> {
  const prompt = `
Anda adalah seorang hipnoterapis profesional (Satria Siddik S.Psi, C.T, C.PHt, C.NLP).
Berdasarkan data sesi dan laporan sesi di bawah ini, buatkan dokumen "Saran & Tips untuk Klien" yang berisi panduan praktis untuk membantu proses pemulihan atau pengembangan diri klien di luar jam sesi.

DATA SESI:
- Nama Klien: ${data.clientName || '-'}
- Keluhan Utama: ${data.presentingProblem || '-'}
- Teknik Terakhir: ${data.techniquesUsed || '-'}

LAPORAN SESI:
${report}

Tugas Anda:
Buatlah daftar saran dan tips praktis yang mencakup:
1. Tips Harian (Misal: pernapasan, afirmasi, atau kebiasaan kecil)
2. Saran Gaya Hidup (Misal: pola tidur, manajemen stres, atau interaksi sosial)
3. Teknik Self-Help (Teknik sederhana yang bisa dilakukan sendiri jika keluhan muncul kembali)
4. Pesan Motivasi (Kata-kata penguat untuk klien)

Format dalam Markdown yang rapi, menggunakan bullet points, dan bahasa Indonesia yang sangat mendukung (supportive), memberdayakan (empowering), dan mudah dipahami.
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        temperature: 0.7,
      }
    });
    
    return response.text || "Gagal menghasilkan saran dan tips.";
  } catch (error) {
    console.error("Error generating suggestions:", error);
    throw new Error("Terjadi kesalahan saat membuat saran dan tips.");
  }
}
