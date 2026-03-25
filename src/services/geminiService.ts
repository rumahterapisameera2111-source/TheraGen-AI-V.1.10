import { GoogleGenAI, Type } from "@google/genai";
import { logger } from "./logger";

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

export interface ApiSettings {
  provider: 'Gemini' | 'LiteLLM';
  liteLLMKey: string;
  liteLLMBaseUrl: string;
  selectedModel: string;
}

export const LITELLM_DEFAULT_BASE_URL = "https://litellm.koboi2026.biz.id/v1";

export async function fetchLiteLLMModels(apiKey: string, baseUrl: string = LITELLM_DEFAULT_BASE_URL): Promise<string[]> {
  logger.info(`Fetching models from LiteLLM: ${baseUrl}`);
  try {
    const response = await fetch(`${baseUrl}/models`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error(`Failed to fetch LiteLLM models: ${response.status}`, errorData);
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }
    
    const data = await response.json();
    logger.info(`Successfully fetched ${data.data?.length || 0} models from LiteLLM`);
    return data.data?.map((m: any) => m.id) || [];
  } catch (error) {
    logger.error("Error in fetchLiteLLMModels:", error);
    throw error;
  }
}

async function callAI(
  apiSettings: ApiSettings,
  prompt: string,
  config: { temperature?: number; responseMimeType?: string; responseSchema?: any; stream?: boolean },
  onChunk?: (chunk: string) => void
): Promise<string> {
  const { provider, liteLLMKey, liteLLMBaseUrl, selectedModel } = apiSettings;

  if (provider === 'LiteLLM') {
    logger.info(`Calling LiteLLM API: ${selectedModel}`, { prompt: prompt.substring(0, 100) + "..." });
    const baseUrl = liteLLMBaseUrl || LITELLM_DEFAULT_BASE_URL;
    
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${liteLLMKey}`
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [{ role: 'user', content: prompt }],
          temperature: config.temperature ?? 0.5,
          stream: !!onChunk
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        logger.error(`LiteLLM API Error: ${response.status}`, errorData);
        const statusText = response.statusText || (response.status === 429 ? "Too Many Requests" : "Error");
        const errorMessage = `LiteLLM Error ${response.status}: ${statusText}`;
        
        if (response.status === 429) {
          throw new Error(`QUOTA_EXCEEDED: ${errorMessage}`);
        }
        throw new Error(errorMessage);
      }

      if (onChunk && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(line => line.trim() !== '');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.replace('data: ', '').trim();
              if (dataStr === '[DONE]') continue;
              
              try {
                const data = JSON.parse(dataStr);
                const content = data.choices?.[0]?.delta?.content || "";
                if (content) {
                  fullText += content;
                  onChunk(content);
                }
              } catch (e) {
                logger.warn("Failed to parse LiteLLM stream chunk", { line });
              }
            }
          }
        }
        logger.info("LiteLLM stream call completed");
        return fullText;
      } else {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "";
        logger.info("LiteLLM call completed");
        return content;
      }
    } catch (error) {
      logger.error("LiteLLM call failed:", error);
      throw error;
    }
  } else {
    // Gemini
    logger.info(`Calling Gemini API: ${selectedModel}`, { prompt: prompt.substring(0, 100) + "..." });
    const apiKey = (process.env as any).API_KEY || process.env.GEMINI_API_KEY;
    const ai = new GoogleGenAI({ apiKey });
    
    try {
      if (onChunk) {
        const response = await ai.models.generateContentStream({
          model: selectedModel,
          contents: prompt,
          config: {
            temperature: config.temperature ?? 0.5,
            responseMimeType: config.responseMimeType as any,
            responseSchema: config.responseSchema,
          }
        });

        let fullText = "";
        for await (const chunk of response) {
          const text = chunk.text;
          if (text) {
            fullText += text;
            onChunk(text);
          }
        }
        logger.info("Gemini stream call completed");
        return fullText;
      } else {
        const response = await ai.models.generateContent({
          model: selectedModel,
          contents: prompt,
          config: {
            temperature: config.temperature ?? 0.5,
            responseMimeType: config.responseMimeType as any,
            responseSchema: config.responseSchema,
          }
        });
        
        const content = response.text || "";
        logger.info("Gemini call completed");
        return content;
      }
    } catch (error: any) {
      logger.error("Gemini call failed:", error);
      // Preserve the error message if it contains quota info
      const errorMessage = error.message || String(error);
      if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
        throw new Error(`QUOTA_EXCEEDED: ${errorMessage}`);
      }
      throw error;
    }
  }
}

export const DEFAULT_PROMPTS = {
  clinicalReport: `Anda adalah seorang hipnoterapis profesional yang ahli dalam menulis laporan sesi terapi (Clinical Notes).
Tugas Anda adalah membuat laporan sesi yang komprehensif, terstruktur, rapi, dan profesional berdasarkan catatan mentah berikut ini.

GAYA PENULISAN:
{{STYLE_INSTRUCTION}}
Gunakan bahasa Indonesia yang formal, empatik, dan klinis.

INFORMASI TERAPIS & KLINIK:
- Nama Terapis: {{THERAPIST_NAME}}
- Nama Klinik: {{CLINIC_NAME}}

DATA SESI:
- Nama Klien: {{CLIENT_NAME}}
- Umur: {{CLIENT_AGE}}
- Jenis Kelamin: {{CLIENT_GENDER}}
- Tanggal Sesi: {{SESSION_DATE}}
- Sesi Ke: {{SESSION_NUMBER}}
- Pendekatan/Jenis Terapi: {{THERAPY_TYPE}}

ASESMEN AWAL:
- Keluhan Utama: {{PRESENTING_PROBLEM}}
- Observasi Awal (Fisik/Emosi): {{INITIAL_OBSERVATION}}
- Skala SUD Awal (1-10): {{INITIAL_SUD}}

PROSES TERAPI & INTERVENSI:
- Teknik yang Digunakan: {{TECHNIQUES_USED}}
- Kedalaman Trance (jika relevan): {{TRANCE_DEPTH}}
- Dinamika Sesi & Insight: {{SESSION_DYNAMICS}}

Tugas Anda adalah menguraikan poin-poin di atas menjadi narasi yang mengalir, profesional, dan mendalam. Jangan hanya mengulang kata-kata, tetapi interpretasikan secara klinis bagaimana teknik tersebut membantu klien dan apa insight utama yang muncul.

HASIL & TINDAK LANJUT:
- Skala SUD Akhir (1-10): {{FINAL_SUD}}
- Observasi Pasca-Sesi: {{POST_OBSERVATION}}
- Tugas / PR (Homework): {{HOMEWORK}}
- Rencana Sesi Selanjutnya: {{NEXT_PLAN}}

FORMAT LAPORAN YANG DIHARAPKAN (Gunakan Markdown dengan spasi yang konsisten, heading yang tepat, dan bullet points yang rapi):

# Laporan Sesi Klinis
**{{CLINIC_NAME}}**

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
{{THERAPIST_NAME}}

Pastikan laporannya mengalir dengan baik, tidak hanya sekadar menyalin poin-poin di atas, tetapi merangkainya menjadi narasi klinis yang utuh dan profesional. Jika ada data yang kosong (-), abaikan atau sesuaikan narasinya dengan wajar.
{{CHAR_COUNT_INSTRUCTION}}`,
  nextSessionPlan: `Anda adalah seorang hipnoterapis profesional ({{THERAPIST_NAME}}).
Berdasarkan data sesi dan laporan sesi sebelumnya di bawah ini, buatkan Perencanaan Sesi Lanjutan (Treatment Plan) jangka panjang yang komprehensif, terstruktur, dan profesional untuk {{PLAN_SESSIONS_COUNT}} sesi ke depan.

DATA SESI SEBELUMNYA:
- Nama Klien: {{CLIENT_NAME}}
- Keluhan Utama: {{PRESENTING_PROBLEM}}
- Teknik Terakhir: {{TECHNIQUES_USED}}
- Dinamika Sesi: {{SESSION_DYNAMICS}}
- PR/Tugas: {{HOMEWORK}}
- Rencana Awal: {{NEXT_PLAN}}

LAPORAN SESI SEBELUMNYA:
{{PREVIOUS_REPORT}}

Tugas Anda:
Buatlah dokumen "Rencana Sesi Lanjutan ({{PLAN_SESSIONS_COUNT}} Sesi)" yang mencakup perencanaan bertahap untuk setiap sesi.
Untuk masing-masing sesi lanjutan (Sesi 1 dari rencana, Sesi 2 dari rencana, dst.), jabarkan:
1. Tujuan Sesi (Goals)
2. Review & Evaluasi (Apa yang perlu dicek di awal sesi)
3. Rencana Intervensi & Teknik (Teknik spesifik apa yang disarankan)
4. Antisipasi Kendala (Potensi resistensi atau abreaksi dan cara menanganinya)
5. Indikator Keberhasilan Sesi

Berikan juga ringkasan tujuan akhir (Ultimate Goal) dari seluruh rangkaian {{PLAN_SESSIONS_COUNT}} sesi ini di bagian awal dokumen.

Format dalam Markdown yang rapi dengan heading (gunakan ## untuk pemisah antar sesi), bullet points, dan bahasa Indonesia klinis yang profesional.
{{CHAR_COUNT_INSTRUCTION}}`,
  clientReport: `Anda adalah seorang hipnoterapis profesional ({{THERAPIST_NAME}}).
Berdasarkan laporan sesi klinis di bawah ini, buatkan "Ringkasan Sesi untuk Klien" yang akan diberikan langsung kepada klien.

LAPORAN KLINIS (ARSIP TERAPIS):
{{PREVIOUS_REPORT}}

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
{{CHAR_COUNT_INSTRUCTION}}`,
  suggestions: `Anda adalah seorang hipnoterapis profesional ({{THERAPIST_NAME}}).
Berdasarkan data sesi dan laporan sesi di bawah ini, buatkan dokumen "Saran & Tips untuk Klien" yang berisi panduan praktis untuk membantu proses pemulihan atau pengembangan diri klien di luar jam sesi.

DATA SESI:
- Nama Klien: {{CLIENT_NAME}}
- Keluhan Utama: {{PRESENTING_PROBLEM}}
- Teknik Terakhir: {{TECHNIQUES_USED}}

LAPORAN SESI:
{{PREVIOUS_REPORT}}

Tugas Anda:
Buatlah daftar saran dan tips praktis yang mencakup:
1. Tips Harian (Misal: pernapasan, afirmasi, atau kebiasaan kecil)
2. Saran Gaya Hidup (Misal: pola tidur, manajemen stres, atau interaksi sosial)
3. Teknik Self-Help (Teknik sederhana yang bisa dilakukan sendiri jika keluhan muncul kembali)
4. Pesan Motivasi (Kata-kata penguat untuk klien)

Format dalam Markdown yang rapi, menggunakan bullet points, dan bahasa Indonesia yang sangat mendukung (supportive), memberdayakan (empowering), dan mudah dipahami.
{{CHAR_COUNT_INSTRUCTION}}`
};

function buildPrompt(template: string, data: SessionData, therapistName: string, clinicName: string, extra: any = {}) {
  let prompt = template;
  const styleInstruction = 
    data.reportStyle === 'Concise' ? 'Buat laporan yang sangat padat, singkat, dan langsung pada intinya (bullet points dominan).' :
    data.reportStyle === 'Empathy-focused' ? 'Buat laporan yang menonjolkan empati, dinamika emosional klien, dan proses terapeutik yang mendalam.' :
    'Buat laporan yang sangat detail, komprehensif, deskriptif, dan mencakup semua aspek klinis secara menyeluruh. Jangan ragu untuk menjabarkan dinamika sesi secara naratif dan mendalam.';

  const charCountInstruction = (extra.charCountRange && extra.charCountRange !== 'unlimited') 
    ? `PENTING: Batasi panjang teks laporan ini agar berada dalam rentang ${extra.charCountRange} karakter.` 
    : 'Berikan penjelasan yang selengkap mungkin tanpa batasan karakter yang ketat.';

  const replacements: Record<string, string> = {
    '{{THERAPIST_NAME}}': therapistName || '-',
    '{{CLINIC_NAME}}': clinicName || '-',
    '{{CLIENT_NAME}}': data.clientName || '-',
    '{{CLIENT_AGE}}': data.clientAge || '-',
    '{{CLIENT_GENDER}}': data.clientGender || '-',
    '{{SESSION_DATE}}': data.sessionDate || '-',
    '{{SESSION_NUMBER}}': data.sessionNumber || '-',
    '{{THERAPY_TYPE}}': data.therapyType || '-',
    '{{PRESENTING_PROBLEM}}': data.presentingProblem || '-',
    '{{INITIAL_OBSERVATION}}': data.initialObservation || '-',
    '{{INITIAL_SUD}}': data.initialSUD || '-',
    '{{TECHNIQUES_USED}}': data.techniquesUsed || '-',
    '{{TRANCE_DEPTH}}': data.tranceDepth || '-',
    '{{SESSION_DYNAMICS}}': data.sessionDynamics || '-',
    '{{FINAL_SUD}}': data.finalSUD || '-',
    '{{POST_OBSERVATION}}': data.postObservation || '-',
    '{{HOMEWORK}}': data.homework || '-',
    '{{NEXT_PLAN}}': data.nextPlan || '-',
    '{{PREVIOUS_REPORT}}': extra.report || '-',
    '{{PLAN_SESSIONS_COUNT}}': extra.planSessionsCount?.toString() || '1',
    '{{STYLE_INSTRUCTION}}': styleInstruction,
    '{{CHAR_COUNT_INSTRUCTION}}': charCountInstruction
  };

  for (const [key, value] of Object.entries(replacements)) {
    prompt = prompt.split(key).join(value);
  }
  return prompt;
}

export async function analyzeTherapistNotes(file: File, apiSettings?: ApiSettings): Promise<Partial<SessionData>> {
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
  
  // If no apiSettings provided, use default Gemini
  const settings: ApiSettings = apiSettings || {
    provider: 'Gemini',
    liteLLMKey: '',
    liteLLMBaseUrl: LITELLM_DEFAULT_BASE_URL,
    selectedModel: 'gemini-3-flash-preview'
  };

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
    // Note: LiteLLM might not support image analysis in the same way as Gemini SDK
    // For now, we'll use Gemini for image analysis if provider is Gemini
    // If LiteLLM is selected, we might need a different approach or just use Gemini for this specific task
    // But let's try to follow the provider choice if possible.
    // Actually, LiteLLM usually supports vision if the model does.
    
    if (settings.provider === 'LiteLLM') {
      logger.info(`Analyzing notes with LiteLLM: ${settings.selectedModel}`);
      const baseUrl = settings.liteLLMBaseUrl || LITELLM_DEFAULT_BASE_URL;
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.liteLLMKey}`
        },
        body: JSON.stringify({
          model: settings.selectedModel,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: `data:${file.type};base64,${base64Data}` } }
              ]
            }
          ],
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        throw new Error(`LiteLLM Error: ${response.statusText}`);
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content || "";
      if (!text) throw new Error("Gagal mengekstrak data dari gambar.");
      return JSON.parse(text);
    } else {
      logger.info(`Analyzing notes with Gemini: ${settings.selectedModel}`);
      const apiKey = (process.env as any).API_KEY || process.env.GEMINI_API_KEY;
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: settings.selectedModel,
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
    }
  } catch (error) {
    logger.error("Error analyzing notes:", error);
    throw new Error("Terjadi kesalahan saat menganalisis gambar catatan.");
  }
}

export async function generateNextSessionPlan(data: SessionData, report: string, planSessionsCount: number = 1, therapistName: string, clinicName: string, customPrompt?: string, charCountRange?: string, apiSettings?: ApiSettings): Promise<string> {
  const template = customPrompt || DEFAULT_PROMPTS.nextSessionPlan;
  const prompt = buildPrompt(template, data, therapistName, clinicName, { report, planSessionsCount, charCountRange });

  const settings: ApiSettings = apiSettings || {
    provider: 'Gemini',
    liteLLMKey: '',
    liteLLMBaseUrl: LITELLM_DEFAULT_BASE_URL,
    selectedModel: 'gemini-3-flash-preview'
  };

  try {
    return await callAI(settings, prompt, { temperature: 0.5 });
  } catch (error: any) {
    logger.error("Error generating plan:", error);
    if (error.message?.includes('QUOTA_EXCEEDED')) {
      throw error;
    }
    throw new Error(`Error generating plan: ${error.message || "Terjadi kesalahan saat membuat rencana sesi."}`);
  }
}

export async function generateClinicalReport(data: SessionData, therapistName: string, clinicName: string, customPrompt?: string, customReportFormat?: string, charCountRange?: string, onChunk?: (chunk: string) => void, apiSettings?: ApiSettings): Promise<string> {
  const template = customReportFormat || customPrompt || DEFAULT_PROMPTS.clinicalReport;
  const prompt = buildPrompt(template, data, therapistName, clinicName, { charCountRange });

  const settings: ApiSettings = apiSettings || {
    provider: 'Gemini',
    liteLLMKey: '',
    liteLLMBaseUrl: LITELLM_DEFAULT_BASE_URL,
    selectedModel: 'gemini-3-flash-preview'
  };

  const temperature = 
    data.reportStyle === 'Concise' ? 0.3 :
    data.reportStyle === 'Empathy-focused' ? 0.6 :
    0.5;

  try {
    return await callAI(settings, prompt, { temperature, stream: !!onChunk }, onChunk);
  } catch (error: any) {
    logger.error("Error generating report:", error);
    if (error.message?.includes('QUOTA_EXCEEDED')) {
      throw error;
    }
    throw new Error(`Error generating report: ${error.message || "Terjadi kesalahan saat menghubungi AI."}`);
  }
}

export async function generateClientReport(data: SessionData, report: string, therapistName: string, clinicName: string, customPrompt?: string, charCountRange?: string, apiSettings?: ApiSettings): Promise<string> {
  const template = customPrompt || DEFAULT_PROMPTS.clientReport;
  const prompt = buildPrompt(template, data, therapistName, clinicName, { report, charCountRange });

  const settings: ApiSettings = apiSettings || {
    provider: 'Gemini',
    liteLLMKey: '',
    liteLLMBaseUrl: LITELLM_DEFAULT_BASE_URL,
    selectedModel: 'gemini-3-flash-preview'
  };

  try {
    return await callAI(settings, prompt, { temperature: 0.6 });
  } catch (error: any) {
    logger.error("Error generating client report:", error);
    if (error.message?.includes('QUOTA_EXCEEDED')) {
      throw error;
    }
    throw new Error(`Error generating client report: ${error.message || "Terjadi kesalahan saat membuat ringkasan untuk klien."}`);
  }
}

export async function generateSuggestionsAndTips(data: SessionData, report: string, therapistName: string, clinicName: string, customPrompt?: string, charCountRange?: string, apiSettings?: ApiSettings): Promise<string> {
  const template = customPrompt || DEFAULT_PROMPTS.suggestions;
  const prompt = buildPrompt(template, data, therapistName, clinicName, { report, charCountRange });

  const settings: ApiSettings = apiSettings || {
    provider: 'Gemini',
    liteLLMKey: '',
    liteLLMBaseUrl: LITELLM_DEFAULT_BASE_URL,
    selectedModel: 'gemini-3-flash-preview'
  };

  try {
    return await callAI(settings, prompt, { temperature: 0.7 });
  } catch (error: any) {
    logger.error("Error generating suggestions:", error);
    if (error.message?.includes('QUOTA_EXCEEDED')) {
      throw error;
    }
    throw new Error(`Error generating suggestions: ${error.message || "Terjadi kesalahan saat membuat saran dan tips."}`);
  }
}
