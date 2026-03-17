import React, { useState, useEffect } from 'react';
import { FormInput, FormTextarea, FormSelect } from './components/FormInput';
import { generateClinicalReport, analyzeTherapistNotes, generateNextSessionPlan, generateClientReport, generateSuggestionsAndTips, SessionData } from './services/geminiService';
import Markdown from 'react-markdown';
import { marked } from 'marked';
import { useUndo } from './hooks/useUndo';
import { FastChoice } from './components/FastChoice';
import { Copy, Download, Loader2, Sparkles, User as UserIcon, Activity, BrainCircuit, FileCheck, Save, History, LogOut, LogIn, Edit3, Check, Undo2, Redo2, ImagePlus, CalendarPlus, Upload, MessageSquareHeart, FileText, Lightbulb, Moon, Sun, Trash2 } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { saveAs } from 'file-saver';

const STORAGE_KEY = 'theragen_autosave';
const HISTORY_KEY = 'theragen_history';

interface HistoryItem {
  id: string;
  date: string;
  clientName: string;
  therapyType: string;
  sessionNumber: string;
  report: string;
  plan: string;
  clientReport: string;
  suggestions: string;
  formData: SessionData;
}

const initialObservationOptions = [
  "Tampak tegang", "Napas pendek/dangkal", "Sering menunduk", "Kontak mata kurang",
  "Menangis", "Gelisah (Fidgeting)", "Suara bergetar", "Tampak lelah/lesu",
  "Ekspresi datar", "Tampak cemas", "Berkeringat dingin", "Postur tubuh kaku"
];

const techniquesUsedOptions = [
  "Age Regression", "Forgiveness Therapy", "Future Pacing", "Parts Therapy",
  "Ego State Therapy", "Fast Phobia Cure", "Anchoring", "Reframing",
  "Systematic Desensitization", "Empty Chair", "Inner Child Healing",
  "Progressive Muscle Relaxation", "EMDR / Bilateral Stimulation",
  "Cognitive Restructuring", "Direct Suggestion"
];

const postObservationOptions = [
  "Wajah tampak lebih cerah", "Napas lebih teratur & dalam", "Merasa lega",
  "Postur tubuh lebih rileks", "Tersenyum", "Kontak mata membaik",
  "Berhenti menangis", "Lebih tenang", "Mengantuk (efek relaksasi)",
  "Insightful / Paham akar masalah", "Beban emosi berkurang signifikan"
];

export default function App() {
  const [formData, setFormData] = useState<SessionData>({
    clientName: '',
    clientAge: '',
    clientGender: '',
    sessionDate: new Date().toISOString().split('T')[0],
    sessionNumber: '1',
    therapyType: 'Hipnoterapi',
    reportStyle: 'Detailed',
    presentingProblem: '',
    initialObservation: '',
    initialSUD: '',
    techniquesUsed: '',
    tranceDepth: '',
    sessionDynamics: '',
    finalSUD: '',
    postObservation: '',
    homework: '',
    nextPlan: '',
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const {
    state: report,
    set: setReport,
    undo: undoReport,
    redo: redoReport,
    reset: resetReport,
    canUndo: canUndoReport,
    canRedo: canRedoReport
  } = useUndo<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string>('');
  const [copied, setCopied] = useState(false);
  
  // Next Session Plan State
  const [activeTab, setActiveTab] = useState<'report' | 'plan' | 'client' | 'suggestions'>('report');
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [planSessionsCount, setPlanSessionsCount] = useState<number>(1);
  const {
    state: plan,
    set: setPlan,
    undo: undoPlan,
    redo: redoPlan,
    reset: resetPlan,
    canUndo: canUndoPlan,
    canRedo: canRedoPlan
  } = useUndo<string>('');
  const [isEditingPlan, setIsEditingPlan] = useState(false);

  // Client Report State
  const [isGeneratingClientReport, setIsGeneratingClientReport] = useState(false);
  const {
    state: clientReport,
    set: setClientReport,
    undo: undoClientReport,
    redo: redoClientReport,
    reset: resetClientReport,
    canUndo: canUndoClientReport,
    canRedo: canRedoClientReport
  } = useUndo<string>('');
  const [isEditingClientReport, setIsEditingClientReport] = useState(false);

  // Suggestions & Tips State
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const {
    state: suggestions,
    set: setSuggestions,
    undo: undoSuggestions,
    redo: redoSuggestions,
    reset: resetSuggestions,
    canUndo: canUndoSuggestions,
    canRedo: canRedoSuggestions
  } = useUndo<string>('');
  const [isEditingSuggestions, setIsEditingSuggestions] = useState(false);

  // Generate All State
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);

  // File Upload State
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);

  // Dark Mode & History State
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Load from LocalStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setFormData(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse autosave data");
      }
    }

    const savedHistory = localStorage.getItem(HISTORY_KEY);
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse history data");
      }
    }

    const savedTheme = localStorage.getItem('theragen_theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    setIsDarkMode(prev => {
      const newMode = !prev;
      if (newMode) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theragen_theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theragen_theme', 'light');
      }
      return newMode;
    });
  };

  const saveToHistory = () => {
    if (!report) return;
    
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      clientName: formData.clientName || 'Klien Tanpa Nama',
      therapyType: formData.therapyType,
      sessionNumber: formData.sessionNumber,
      report,
      plan,
      clientReport,
      suggestions,
      formData: { ...formData }
    };

    setHistory(prev => {
      const newHistory = [newItem, ...prev];
      localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
      return newHistory;
    });
    
    alert('Laporan berhasil disimpan ke riwayat!');
  };

  const loadFromHistory = (item: HistoryItem) => {
    setFormData(item.formData);
    resetReport(item.report || '');
    resetPlan(item.plan || '');
    resetClientReport(item.clientReport || '');
    resetSuggestions(item.suggestions || '');
    setActiveTab('report');
    setShowHistoryModal(false);
  };

  const deleteFromHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Apakah Anda yakin ingin menghapus laporan ini dari riwayat?')) {
      setHistory(prev => {
        const newHistory = prev.filter(item => item.id !== id);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
        return newHistory;
      });
    }
  };

  // Autosave to LocalStorage on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
  }, [formData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const appendToField = (field: keyof SessionData, text: string) => {
    setFormData((prev) => {
      const currentValue = prev[field] as string;
      const newValue = currentValue ? `${currentValue}, ${text}` : text;
      return { ...prev, [field]: newValue };
    });
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError('');
    setIsEditing(false);
    setActiveTab('report');
    try {
      const generatedReport = await generateClinicalReport(formData);
      resetReport(generatedReport);
      resetPlan(''); // Clear previous plan when generating new report
      resetClientReport(''); // Clear previous client report
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat membuat laporan.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGeneratePlan = async () => {
    if (!report) return;
    setIsGeneratingPlan(true);
    setError('');
    setIsEditingPlan(false);
    try {
      const generatedPlan = await generateNextSessionPlan(formData, report, planSessionsCount);
      resetPlan(generatedPlan);
      setActiveTab('plan');
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat membuat rencana sesi.');
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleGenerateClientReport = async () => {
    if (!report) return;
    setIsGeneratingClientReport(true);
    setError('');
    setIsEditingClientReport(false);
    try {
      const generatedClientReport = await generateClientReport(formData, report);
      resetClientReport(generatedClientReport);
      setActiveTab('client');
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat membuat ringkasan untuk klien.');
    } finally {
      setIsGeneratingClientReport(false);
    }
  };

  const handleGenerateSuggestions = async () => {
    if (!report) return;
    setIsGeneratingSuggestions(true);
    setError('');
    setIsEditingSuggestions(false);
    try {
      const generatedSuggestions = await generateSuggestionsAndTips(formData, report);
      resetSuggestions(generatedSuggestions);
      setActiveTab('suggestions');
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat membuat saran dan tips.');
    } finally {
      setIsGeneratingSuggestions(false);
    }
  };

  const handleGenerateAll = async () => {
    setIsGeneratingAll(true);
    setError('');
    setIsEditing(false);
    setIsEditingPlan(false);
    setIsEditingClientReport(false);
    setIsEditingSuggestions(false);
    setActiveTab('report');
    
    try {
      setIsGenerating(true);
      const generatedReport = await generateClinicalReport(formData);
      resetReport(generatedReport);
      setIsGenerating(false);

      setIsGeneratingPlan(true);
      const generatedPlan = await generateNextSessionPlan(formData, generatedReport, planSessionsCount);
      resetPlan(generatedPlan);
      setIsGeneratingPlan(false);

      setIsGeneratingClientReport(true);
      const generatedClientReport = await generateClientReport(formData, generatedReport);
      resetClientReport(generatedClientReport);
      setIsGeneratingClientReport(false);

      setIsGeneratingSuggestions(true);
      const generatedSuggestions = await generateSuggestionsAndTips(formData, generatedReport);
      resetSuggestions(generatedSuggestions);
      setIsGeneratingSuggestions(false);

      alert('Semua laporan berhasil di-generate!');
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat membuat laporan.');
      setIsGenerating(false);
      setIsGeneratingPlan(false);
      setIsGeneratingClientReport(false);
      setIsGeneratingSuggestions(false);
    } finally {
      setIsGeneratingAll(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzingImage(true);
    try {
      const extractedData = await analyzeTherapistNotes(file);
      setFormData(prev => ({
        ...prev,
        ...Object.fromEntries(Object.entries(extractedData).filter(([_, v]) => v !== ""))
      }));
      alert("Catatan berhasil dianalisis dan dimasukkan ke dalam form!");
    } catch (err: any) {
      alert(err.message || "Gagal menganalisis gambar.");
    } finally {
      setIsAnalyzingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCopy = (textToCopy: string) => {
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadPDF = async (content: string, filename: string, title: string) => {
    if (!content) return;
    
    // Convert Markdown to HTML
    const rawHtml = await marked.parse(content);
    
    // Split by <h2
    const parts = rawHtml.split('<h2');
    let boxedHtml = `<div style="margin-bottom: 20px;">${parts[0]}</div>`;
    
    for (let i = 1; i < parts.length; i++) {
      const part = '<h2' + parts[i];
      const h2EndIndex = part.indexOf('</h2>') + 5;
      const h2 = part.substring(0, h2EndIndex);
      const sectionContent = part.substring(h2EndIndex);
      
      boxedHtml += `
        <div style="border: 1px solid #cbd5e1; border-radius: 8px; margin-bottom: 20px; overflow: hidden; page-break-inside: avoid; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <div style="background-color: #f8fafc; border-bottom: 1px solid #cbd5e1; padding: 12px 16px;">
            <h2 style="margin: 0; font-size: 16px; color: #1e293b; font-weight: 600;">${h2.replace(/<h2[^>]*>|<\/h2>/g, '')}</h2>
          </div>
          <div style="padding: 16px; font-size: 14px; line-height: 1.6; color: #334155;">
            ${sectionContent}
          </div>
        </div>
      `;
    }

    const element = document.createElement('div');
    element.innerHTML = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto;">
        <div style="text-align: center; margin-bottom: 30px; padding-bottom: 15px; border-bottom: 2px solid #4f46e5;">
          <h1 style="font-size: 24px; color: #1e1b4b; margin: 0 0 5px 0; font-weight: 700;">Rumah Terapi Sameera</h1>
          <p style="font-size: 16px; color: #334155; margin: 0 0 5px 0; font-weight: 500;">Layanan Hipnoterapi dan Konsultasi Psikologi</p>
          <p style="font-size: 11px; color: #64748b; margin: 0 0 15px 0;">Jl. Ahmad Karim No 18, RT 011 Koto Panjang, Kota Padang Panjang, Sumbar | No HP: 08992666096</p>
          <div style="display: inline-block; background-color: #e0e7ff; color: #4f46e5; padding: 4px 12px; border-radius: 9999px; font-size: 14px; font-weight: 600;">
            ${title}
          </div>
        </div>
        ${boxedHtml}
        <div style="margin-top: 40px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 15px;">
          Dihasilkan secara otomatis oleh TheraGen AI pada ${new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>
    `;

    const style = document.createElement('style');
    style.innerHTML = `
      p { margin-top: 0; margin-bottom: 10px; }
      p:last-child { margin-bottom: 0; }
      ul, ol { margin-top: 0; margin-bottom: 10px; padding-left: 20px; }
      ul:last-child, ol:last-child { margin-bottom: 0; }
      li { margin-bottom: 4px; }
      strong { color: #0f172a; }
      hr { border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0; }
    `;
    element.appendChild(style);

    const opt = {
      margin:       10,
      filename:     `${filename}.pdf`,
      image:        { type: 'jpeg' as const, quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
    };

    html2pdf().set(opt).from(element).save();
  };

  const handleDownloadDOCX = async (content: string, filename: string, title: string) => {
    if (!content) return;

    // Convert Markdown to HTML
    const rawHtml = await marked.parse(content);
    
    // Create a basic HTML document for Word
    const html = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          body { font-family: 'Calibri', 'Arial', sans-serif; line-height: 1.5; }
          h1 { color: #1e1b4b; text-align: center; border-bottom: 2px solid #4f46e5; padding-bottom: 10px; }
          h2 { color: #1e293b; background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 10px; margin-top: 20px; }
          p { margin-bottom: 10px; }
          ul, ol { margin-bottom: 10px; }
          li { margin-bottom: 5px; }
          .header { text-align: center; margin-bottom: 30px; }
          .footer { margin-top: 40px; text-align: center; font-size: 10pt; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 15px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Rumah Terapi Sameera</h1>
          <p>Layanan Hipnoterapi dan Konsultasi Psikologi</p>
          <p style="font-size: 9pt;">Jl. Ahmad Karim No 18, RT 011 Koto Panjang, Kota Padang Panjang, Sumbar | No HP: 08992666096</p>
          <p><strong>${title}</strong></p>
        </div>
        ${rawHtml}
        <div class="footer">
          Dihasilkan secara otomatis oleh TheraGen AI pada ${new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', html], {
      type: 'application/msword'
    });
    
    saveAs(blob, `${filename}.doc`);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans text-slate-900 dark:text-slate-100 flex flex-col md:flex-row">
      {/* Left Panel: Form */}
      <div className="w-full md:w-1/2 lg:w-[45%] h-screen overflow-y-auto border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 md:p-8 print:hidden">
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              TheraGen
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Generator Laporan Konseling & Hipnoterapi Klinis
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHistoryModal(true)}
              className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:text-slate-400 dark:hover:text-indigo-400 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title="Riwayat Laporan"
            >
              <History className="w-5 h-5" />
            </button>
            <button
              onClick={toggleDarkMode}
              className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:text-slate-400 dark:hover:text-indigo-400 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title={isDarkMode ? "Mode Terang" : "Mode Gelap"}
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div className="mb-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30 rounded-xl flex items-center justify-between print:hidden">
          <div>
            <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
              <ImagePlus className="w-4 h-4" /> Upload Catatan Terapis
            </h3>
            <p className="text-xs text-indigo-700 dark:text-indigo-400/80 mt-1">AI akan membaca foto catatan Anda dan mengisi form otomatis.</p>
          </div>
          <input 
            type="file" 
            accept="image/*" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleImageUpload}
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isAnalyzingImage}
            className="px-3 py-1.5 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 text-sm font-medium rounded-lg shadow-sm border border-indigo-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
          >
            {isAnalyzingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {isAnalyzingImage ? 'Menganalisis...' : 'Upload Foto'}
          </button>
        </div>

        <div className="space-y-8 pb-24">
            {/* Section 1: Klien & Sesi */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                <UserIcon className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Data Klien & Sesi</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormInput label="Nama Klien" id="clientName" placeholder="Contoh: Budi Santoso" value={formData.clientName} onChange={handleChange} />
                <div className="grid grid-cols-2 gap-4">
                  <FormInput label="Umur" id="clientAge" type="number" placeholder="30" value={formData.clientAge} onChange={handleChange} />
                  <FormSelect 
                    label="Gender" 
                    id="clientGender" 
                    value={formData.clientGender} 
                    onChange={handleChange}
                    options={[
                      { value: 'Laki-laki', label: 'Laki-laki' },
                      { value: 'Perempuan', label: 'Perempuan' }
                    ]}
                  />
                </div>
                <FormInput label="Tanggal Sesi" id="sessionDate" type="date" value={formData.sessionDate} onChange={handleChange} />
                <div className="grid grid-cols-2 gap-4">
                  <FormInput label="Sesi Ke-" id="sessionNumber" type="number" min="1" value={formData.sessionNumber} onChange={handleChange} />
                  <FormSelect 
                    label="Jenis Terapi" 
                    id="therapyType" 
                    value={formData.therapyType} 
                    onChange={handleChange}
                    options={[
                      { value: 'Hipnoterapi', label: 'Hipnoterapi' },
                      { value: 'Konseling', label: 'Konseling Psikologis' },
                      { value: 'NLP', label: 'NLP' },
                      { value: 'EFT', label: 'EFT' },
                      { value: 'Lainnya', label: 'Lainnya' }
                    ]}
                  />
                </div>
              </div>
            </section>

            {/* Section 2: Asesmen Awal */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                <Activity className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Asesmen & Keluhan Awal</h2>
              </div>
              <div className="space-y-4">
                <FormTextarea 
                  label="Keluhan Utama (Presenting Problem)" 
                  id="presentingProblem" 
                  placeholder="Contoh: Klien merasa cemas berlebihan saat presentasi di depan umum..."
                  value={formData.presentingProblem} 
                  onChange={handleChange} 
                />
                <div>
                  <FormTextarea 
                    label="Observasi Awal (Fisik & Emosi)" 
                    id="initialObservation" 
                    placeholder="Contoh: Klien tampak tegang, napas pendek, sering menunduk..."
                    value={formData.initialObservation} 
                    onChange={handleChange} 
                  />
                  <FastChoice 
                    options={initialObservationOptions} 
                    onSelect={(val) => appendToField('initialObservation', val)} 
                  />
                </div>
                <div className="w-1/2">
                  <FormInput 
                    label="Skala SUD Awal (1-10)" 
                    id="initialSUD" 
                    type="number" 
                    min="1" max="10" 
                    placeholder="Contoh: 8"
                    value={formData.initialSUD} 
                    onChange={handleChange} 
                  />
                </div>
              </div>
            </section>

            {/* Section 3: Proses Terapi */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                <BrainCircuit className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Proses Terapi & Intervensi</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <FormTextarea 
                    label="Teknik yang Digunakan" 
                    id="techniquesUsed" 
                    placeholder="Contoh: Age Regression, Forgiveness Therapy, Future Pacing..."
                    value={formData.techniquesUsed} 
                    onChange={handleChange} 
                  />
                  <FastChoice 
                    options={techniquesUsedOptions} 
                    onSelect={(val) => appendToField('techniquesUsed', val)} 
                  />
                </div>
                {formData.therapyType === 'Hipnoterapi' && (
                  <div className="w-1/2">
                    <FormSelect 
                      label="Kedalaman Trance" 
                      id="tranceDepth" 
                      value={formData.tranceDepth} 
                      onChange={handleChange}
                      options={[
                        { value: 'Light Trance', label: 'Light Trance' },
                        { value: 'Medium Trance', label: 'Medium Trance' },
                        { value: 'Somnambulism', label: 'Somnambulism' },
                        { value: 'Profound', label: 'Profound / Esdaile' }
                      ]}
                    />
                  </div>
                )}
                <FormTextarea 
                  label="Dinamika Sesi & Insight Penting" 
                  id="sessionDynamics" 
                  placeholder="Contoh: Klien menemukan akar masalah pada usia 7 tahun saat dibentak ayahnya. Terjadi abreaksi ringan, namun berhasil direlease..."
                  value={formData.sessionDynamics} 
                  onChange={handleChange} 
                />
              </div>
            </section>

            {/* Section 4: Hasil & Tindak Lanjut */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                <FileCheck className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Hasil & Tindak Lanjut</h2>
              </div>
              <div className="space-y-4">
                <div className="w-1/2">
                  <FormInput 
                    label="Skala SUD Akhir (1-10)" 
                    id="finalSUD" 
                    type="number" 
                    min="0" max="10" 
                    placeholder="Contoh: 2"
                    value={formData.finalSUD} 
                    onChange={handleChange} 
                  />
                </div>
                <div>
                  <FormTextarea 
                    label="Observasi Pasca-Sesi" 
                    id="postObservation" 
                    placeholder="Contoh: Wajah klien tampak lebih cerah, napas teratur, merasa lega..."
                    value={formData.postObservation} 
                    onChange={handleChange} 
                  />
                  <FastChoice 
                    options={postObservationOptions} 
                    onSelect={(val) => appendToField('postObservation', val)} 
                  />
                </div>
                <FormTextarea 
                  label="Tugas / PR (Homework)" 
                  id="homework" 
                  placeholder="Contoh: Melakukan self-hypnosis setiap malam sebelum tidur..."
                  value={formData.homework} 
                  onChange={handleChange} 
                />
                <FormTextarea 
                  label="Rencana Sesi Selanjutnya" 
                  id="nextPlan" 
                  placeholder="Contoh: Evaluasi PR dan memperkuat anchor positif..."
                  value={formData.nextPlan} 
                  onChange={handleChange} 
                />
              </div>
            </section>

            {/* Section 5: Pengaturan Laporan */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                <Sparkles className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Pengaturan Laporan</h2>
              </div>
              <div className="w-full sm:w-1/2">
                <FormSelect 
                  label="Gaya Penulisan Laporan" 
                  id="reportStyle" 
                  value={formData.reportStyle} 
                  onChange={handleChange}
                  options={[
                    { value: 'Concise', label: 'Singkat & Padat (Concise)' },
                    { value: 'Detailed', label: 'Detail & Komprehensif' },
                    { value: 'Empathy-focused', label: 'Fokus Empati & Emosi' }
                  ]}
                />
              </div>
            </section>
          </div>

        {/* Floating Action Button for Generate */}
        <div className="fixed bottom-0 left-0 w-full md:w-1/2 lg:w-[45%] bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10 print:hidden flex gap-3">
            <button
              onClick={handleGenerate}
              disabled={isGenerating || isGeneratingAll}
              className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 dark:text-indigo-300 font-medium py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              title="Hanya generate Laporan Sesi"
            >
              {isGenerating && !isGeneratingAll ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Menyusun...
                </>
              ) : (
                <>
                  <FileCheck className="w-5 h-5" />
                  Laporan Saja
                </>
              )}
            </button>
            <button
              onClick={handleGenerateAll}
              disabled={isGeneratingAll || isGenerating}
              className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-4 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              title="Generate Laporan, Rencana, Laporan Klien, dan Saran sekaligus"
            >
              {isGeneratingAll ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Menyusun Semua...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate Semua
                </>
              )}
            </button>
          </div>
      </div>

      {/* Right Panel: Preview */}
      <div className="w-full md:w-1/2 lg:w-[55%] h-screen overflow-y-auto bg-slate-50 dark:bg-slate-900 p-6 md:p-8 print:w-full print:h-auto print:bg-white print:p-0">
        <div className="max-w-3xl mx-auto">
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl text-red-700 dark:text-red-400 text-sm print:hidden">
              {error}
            </div>
          )}

          {!report && !isGenerating && !error && (
            <div className="h-full min-h-[60vh] flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 print:hidden">
              <FileCheck className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-center max-w-sm">
                Isi form di sebelah kiri dan klik "Generate Laporan" untuk melihat hasil laporan klinis Anda di sini.
              </p>
              <p className="text-xs mt-4 text-slate-400 dark:text-slate-500">Data Anda otomatis tersimpan di perangkat (Autosave).</p>
            </div>
          )}

          {isGenerating && (
            <div className="h-full min-h-[60vh] flex flex-col items-center justify-center text-indigo-500 dark:text-indigo-400 print:hidden">
              <Loader2 className="w-12 h-12 animate-spin mb-4" />
              <p className="animate-pulse font-medium">AI sedang menganalisis dan menyusun laporan...</p>
            </div>
          )}

          {report && !isGenerating && (
            <div className="bg-white dark:bg-slate-950 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden print:border-none print:shadow-none">
              
              {/* TABS */}
              <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 print:hidden overflow-x-auto">
                <button
                  onClick={() => setActiveTab('report')}
                  className={`flex-1 py-3 px-4 text-sm font-medium text-center border-b-2 transition-colors whitespace-nowrap ${activeTab === 'report' ? 'border-indigo-600 dark:border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-950' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                  <FileCheck className="w-4 h-4 inline-block mr-1.5 mb-0.5" /> Laporan Sesi
                </button>
                <button
                  onClick={() => setActiveTab('plan')}
                  className={`flex-1 py-3 px-4 text-sm font-medium text-center border-b-2 transition-colors whitespace-nowrap ${activeTab === 'plan' ? 'border-indigo-600 dark:border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-950' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                  <CalendarPlus className="w-4 h-4 inline-block mr-1.5 mb-0.5" /> Rencana Sesi
                </button>
                <button
                  onClick={() => setActiveTab('client')}
                  className={`flex-1 py-3 px-4 text-sm font-medium text-center border-b-2 transition-colors whitespace-nowrap ${activeTab === 'client' ? 'border-indigo-600 dark:border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-950' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                  <MessageSquareHeart className="w-4 h-4 inline-block mr-1.5 mb-0.5" /> Laporan Klien
                </button>
                <button
                  onClick={() => setActiveTab('suggestions')}
                  className={`flex-1 py-3 px-4 text-sm font-medium text-center border-b-2 transition-colors whitespace-nowrap ${activeTab === 'suggestions' ? 'border-indigo-600 dark:border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-950' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                  <Lightbulb className="w-4 h-4 inline-block mr-1.5 mb-0.5" /> Saran & Tips
                </button>
              </div>

              {activeTab === 'report' && (
                <>
                  <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-2 print:hidden">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-200">Hasil Laporan</h3>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        onClick={() => setIsEditing(!isEditing)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${isEditing ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'}`}
                      >
                        {isEditing ? <><Check className="w-4 h-4" /> Selesai Edit</> : <><Edit3 className="w-4 h-4" /> Edit</>}
                      </button>
                      {isEditing && (
                        <>
                          <button
                            onClick={undoReport}
                            disabled={!canUndoReport}
                            className="flex items-center gap-1.5 px-2 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Undo"
                          >
                            <Undo2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={redoReport}
                            disabled={!canRedoReport}
                            className="flex items-center gap-1.5 px-2 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Redo"
                          >
                            <Redo2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={saveToHistory}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 rounded-lg transition-colors"
                      >
                        <Save className="w-4 h-4" /> Simpan
                      </button>
                      <button
                        onClick={() => handleCopy(report)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                        {copied ? 'Tersalin!' : 'Salin'}
                      </button>
                      <button
                        onClick={() => handleDownloadPDF(report, `Laporan_Sesi_${formData.clientName.replace(/\s+/g, '_') || 'Klien'}`, 'Laporan Sesi Hipnoterapi')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                      >
                        <FileText className="w-4 h-4" /> PDF
                      </button>
                      <button
                        onClick={() => handleDownloadDOCX(report, `Laporan_Sesi_${formData.clientName.replace(/\s+/g, '_') || 'Klien'}`, 'Laporan Sesi Hipnoterapi')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                      >
                        <Download className="w-4 h-4" /> DOCX
                      </button>
                    </div>
                  </div>
                  
                  <div className="p-8 md:p-10 print:p-0">
                    {isEditing ? (
                      <textarea
                        value={report}
                        onChange={(e) => setReport(e.target.value)}
                        className="w-full min-h-[60vh] p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm text-slate-800 dark:text-slate-200 resize-y"
                      />
                    ) : (
                      <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-a:text-indigo-600 dark:prose-a:text-indigo-400 prose-li:my-0.5">
                        <div className="markdown-body">
                          <Markdown>{report}</Markdown>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {activeTab === 'plan' && (
                <>
                  {!plan && !isGeneratingPlan ? (
                    <div className="p-12 flex flex-col items-center justify-center text-center">
                      <CalendarPlus className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-4" />
                      <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-2">Buat Rencana Sesi Lanjutan</h3>
                      <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md mb-6">
                        AI akan menganalisis laporan sesi ini dan menyusun rencana treatment (Treatment Plan) yang komprehensif untuk sesi berikutnya.
                      </p>
                      
                      <div className="flex items-center gap-4 mb-6">
                        <label htmlFor="sessionsCount" className="text-sm font-medium text-slate-700 dark:text-slate-300">Jumlah Sesi Lanjutan:</label>
                        <select
                          id="sessionsCount"
                          value={planSessionsCount}
                          onChange={(e) => setPlanSessionsCount(Number(e.target.value))}
                          className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-slate-200"
                        >
                          <option value={1}>1 Sesi</option>
                          <option value={2}>2 Sesi</option>
                          <option value={3}>3 Sesi</option>
                          <option value={4}>4 Sesi</option>
                          <option value={5}>5 Sesi</option>
                        </select>
                      </div>

                      <button
                        onClick={handleGeneratePlan}
                        className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 transition-colors flex items-center gap-2"
                      >
                        <Sparkles className="w-4 h-4" /> Generate Rencana Sesi
                      </button>
                    </div>
                  ) : isGeneratingPlan ? (
                    <div className="p-12 flex flex-col items-center justify-center text-indigo-500">
                      <Loader2 className="w-10 h-10 animate-spin mb-4" />
                      <p className="animate-pulse font-medium">Menyusun rencana sesi selanjutnya...</p>
                    </div>
                  ) : (
                    <>
                      <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-2 print:hidden">
                        <h3 className="font-semibold text-slate-800 dark:text-slate-200">Rencana Sesi</h3>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            onClick={() => setIsEditingPlan(!isEditingPlan)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${isEditingPlan ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'}`}
                          >
                            {isEditingPlan ? <><Check className="w-4 h-4" /> Selesai Edit</> : <><Edit3 className="w-4 h-4" /> Edit</>}
                          </button>
                          {isEditingPlan && (
                            <>
                              <button onClick={undoPlan} disabled={!canUndoPlan} className="flex items-center gap-1.5 px-2 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Undo"><Undo2 className="w-4 h-4" /></button>
                              <button onClick={redoPlan} disabled={!canRedoPlan} className="flex items-center gap-1.5 px-2 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Redo"><Redo2 className="w-4 h-4" /></button>
                            </>
                          )}
                          <button
                            onClick={() => handleCopy(plan)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                          >
                            <Copy className="w-4 h-4" /> {copied ? 'Tersalin!' : 'Salin'}
                          </button>
                          <button
                            onClick={() => handleDownloadPDF(plan, `Rencana_Sesi_${formData.clientName.replace(/\s+/g, '_') || 'Klien'}`, 'Rencana Sesi Selanjutnya')}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                          >
                            <FileText className="w-4 h-4" /> PDF
                          </button>
                          <button
                            onClick={() => handleDownloadDOCX(plan, `Rencana_Sesi_${formData.clientName.replace(/\s+/g, '_') || 'Klien'}`, 'Rencana Sesi Selanjutnya')}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                          >
                            <Download className="w-4 h-4" /> DOCX
                          </button>
                        </div>
                      </div>
                      <div className="p-8 md:p-10 print:p-0">
                        {isEditingPlan ? (
                          <textarea
                            value={plan}
                            onChange={(e) => setPlan(e.target.value)}
                            className="w-full min-h-[60vh] p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm text-slate-800 dark:text-slate-200 resize-y"
                          />
                        ) : (
                          <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-a:text-indigo-600 dark:prose-a:text-indigo-400 prose-li:my-0.5">
                            <div className="markdown-body">
                              <Markdown>{plan}</Markdown>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}

              {activeTab === 'client' && (
                <>
                  {!clientReport && !isGeneratingClientReport ? (
                    <div className="p-12 flex flex-col items-center justify-center text-center">
                      <MessageSquareHeart className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-4" />
                      <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-2">Buat Ringkasan untuk Klien</h3>
                      <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md mb-6">
                        AI akan menyusun ringkasan sesi dengan bahasa yang awam, empatik, dan mudah dipahami klien. Informasi klinis yang sensitif akan disaring secara otomatis.
                      </p>
                      <button
                        onClick={handleGenerateClientReport}
                        className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 transition-colors flex items-center gap-2"
                      >
                        <Sparkles className="w-4 h-4" /> Generate Laporan Klien
                      </button>
                    </div>
                  ) : isGeneratingClientReport ? (
                    <div className="p-12 flex flex-col items-center justify-center text-indigo-500">
                      <Loader2 className="w-10 h-10 animate-spin mb-4" />
                      <p className="animate-pulse font-medium">Menyusun ringkasan untuk klien...</p>
                    </div>
                  ) : (
                    <>
                      <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-2 print:hidden">
                        <h3 className="font-semibold text-slate-800 dark:text-slate-200">Laporan Klien</h3>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            onClick={() => setIsEditingClientReport(!isEditingClientReport)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${isEditingClientReport ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'}`}
                          >
                            {isEditingClientReport ? <><Check className="w-4 h-4" /> Selesai Edit</> : <><Edit3 className="w-4 h-4" /> Edit</>}
                          </button>
                          {isEditingClientReport && (
                            <>
                              <button onClick={undoClientReport} disabled={!canUndoClientReport} className="flex items-center gap-1.5 px-2 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Undo"><Undo2 className="w-4 h-4" /></button>
                              <button onClick={redoClientReport} disabled={!canRedoClientReport} className="flex items-center gap-1.5 px-2 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Redo"><Redo2 className="w-4 h-4" /></button>
                            </>
                          )}
                          <button
                            onClick={() => handleCopy(clientReport)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                          >
                            <Copy className="w-4 h-4" /> {copied ? 'Tersalin!' : 'Salin'}
                          </button>
                          <button
                            onClick={() => handleDownloadPDF(clientReport, `Ringkasan_Sesi_${formData.clientName.replace(/\s+/g, '_') || 'Klien'}`, 'Ringkasan Sesi untuk Klien')}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                          >
                            <FileText className="w-4 h-4" /> PDF
                          </button>
                          <button
                            onClick={() => handleDownloadDOCX(clientReport, `Ringkasan_Sesi_${formData.clientName.replace(/\s+/g, '_') || 'Klien'}`, 'Ringkasan Sesi untuk Klien')}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                          >
                            <Download className="w-4 h-4" /> DOCX
                          </button>
                        </div>
                      </div>
                      <div className="p-8 md:p-10 print:p-0">
                        {isEditingClientReport ? (
                          <textarea
                            value={clientReport}
                            onChange={(e) => setClientReport(e.target.value)}
                            className="w-full min-h-[60vh] p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm text-slate-800 dark:text-slate-200 resize-y"
                          />
                        ) : (
                          <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-a:text-indigo-600 dark:prose-a:text-indigo-400 prose-li:my-0.5">
                            <div className="markdown-body">
                              <Markdown>{clientReport}</Markdown>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}

              {activeTab === 'suggestions' && (
                <>
                  {!suggestions && !isGeneratingSuggestions ? (
                    <div className="p-12 flex flex-col items-center justify-center text-center">
                      <Lightbulb className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-4" />
                      <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-2">Buat Saran & Tips untuk Klien</h3>
                      <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md mb-6">
                        AI akan menyusun panduan praktis, tips harian, dan teknik mandiri yang bisa dilakukan klien di rumah untuk mempercepat proses pemulihan.
                      </p>
                      <button
                        onClick={handleGenerateSuggestions}
                        className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 transition-colors flex items-center gap-2"
                      >
                        <Sparkles className="w-4 h-4" /> Generate Saran & Tips
                      </button>
                    </div>
                  ) : isGeneratingSuggestions ? (
                    <div className="p-12 flex flex-col items-center justify-center text-indigo-500">
                      <Loader2 className="w-10 h-10 animate-spin mb-4" />
                      <p className="animate-pulse font-medium">Menyusun saran dan tips...</p>
                    </div>
                  ) : (
                    <>
                      <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-2 print:hidden">
                        <h3 className="font-semibold text-slate-800 dark:text-slate-200">Saran & Tips</h3>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            onClick={() => setIsEditingSuggestions(!isEditingSuggestions)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${isEditingSuggestions ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'}`}
                          >
                            {isEditingSuggestions ? <><Check className="w-4 h-4" /> Selesai Edit</> : <><Edit3 className="w-4 h-4" /> Edit</>}
                          </button>
                          {isEditingSuggestions && (
                            <>
                              <button onClick={undoSuggestions} disabled={!canUndoSuggestions} className="flex items-center gap-1.5 px-2 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Undo"><Undo2 className="w-4 h-4" /></button>
                              <button onClick={redoSuggestions} disabled={!canRedoSuggestions} className="flex items-center gap-1.5 px-2 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Redo"><Redo2 className="w-4 h-4" /></button>
                            </>
                          )}
                          <button
                            onClick={() => handleCopy(suggestions)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                          >
                            <Copy className="w-4 h-4" /> {copied ? 'Tersalin!' : 'Salin'}
                          </button>
                          <button
                            onClick={() => handleDownloadPDF(suggestions, `Saran_Tips_${formData.clientName.replace(/\s+/g, '_') || 'Klien'}`, 'Saran & Tips untuk Klien')}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                          >
                            <FileText className="w-4 h-4" /> PDF
                          </button>
                          <button
                            onClick={() => handleDownloadDOCX(suggestions, `Saran_Tips_${formData.clientName.replace(/\s+/g, '_') || 'Klien'}`, 'Saran & Tips untuk Klien')}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                          >
                            <Download className="w-4 h-4" /> DOCX
                          </button>
                        </div>
                      </div>
                      <div className="p-8 md:p-10 print:p-0">
                        {isEditingSuggestions ? (
                          <textarea
                            value={suggestions}
                            onChange={(e) => setSuggestions(e.target.value)}
                            className="w-full min-h-[60vh] p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm text-slate-800 dark:text-slate-200 resize-y"
                          />
                        ) : (
                          <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-a:text-indigo-600 dark:prose-a:text-indigo-400 prose-li:my-0.5">
                            <div className="markdown-body">
                              <Markdown>{suggestions}</Markdown>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <History className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                Riwayat Laporan
              </h2>
              <button 
                onClick={() => setShowHistoryModal(false)}
                className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 p-2"
              >
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {history.length === 0 ? (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                  <History className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>Belum ada riwayat laporan yang tersimpan.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {history.map((item) => (
                    <div 
                      key={item.id} 
                      onClick={() => loadFromHistory(item)}
                      className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 cursor-pointer transition-all group"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-slate-900 dark:text-white text-lg">
                          {item.clientName}
                        </h3>
                        <button 
                          onClick={(e) => deleteFromHistory(item.id, e)}
                          className="text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                          title="Hapus dari riwayat"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <CalendarPlus className="w-4 h-4" />
                          {new Date(item.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="flex items-center gap-1">
                          <BrainCircuit className="w-4 h-4" />
                          {item.therapyType} (Sesi {item.sessionNumber})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
