import React, { useState, useEffect } from 'react';
import { FormInput, FormTextarea, FormSelect } from './components/FormInput';
import { generateClinicalReport, analyzeTherapistNotes, generateNextSessionPlan, generateClientReport, generateSuggestionsAndTips, SessionData, DEFAULT_PROMPTS, ApiSettings, fetchLiteLLMModels, LITELLM_DEFAULT_BASE_URL } from './services/geminiService';
import { logger } from './services/logger';
import Markdown from 'react-markdown';
import { marked } from 'marked';
import { useUndo } from './hooks/useUndo';
import { FastChoice } from './components/FastChoice';
import { Tour } from './components/Tour';
import { Copy, Download, Loader2, Sparkles, User as UserIcon, Activity, BrainCircuit, FileCheck, Save, History, LogOut, LogIn, Edit3, Check, Undo2, Redo2, ImagePlus, CalendarPlus, Upload, MessageSquareHeart, FileText, Lightbulb, Moon, Sun, Trash2, Settings, Key, CreditCard, XCircle, RotateCcw, HelpCircle, AlertTriangle } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { saveAs } from 'file-saver';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

const STORAGE_KEY = 'theragen_autosave';
const HISTORY_KEY = 'theragen_history';
const SETTINGS_KEY = 'theragen_settings';

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

type ThemeColor = 'indigo' | 'slate' | 'blue' | 'emerald' | 'rose' | 'amber';

interface SettingsData {
  therapistName: string;
  clinicName: string;
  charCountRange: '500-800' | '800-1500' | '1500-2000' | 'unlimited';
  modelPreference: 'Pro' | 'Flash';
  themeColor: ThemeColor;
  apiSettings: ApiSettings;
  prompts: {
    clinicalReport: string;
    nextSessionPlan: string;
    clientReport: string;
    suggestions: string;
  };
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
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('theragen_theme');
    return savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Settings State
  const [settings, setSettings] = useState<SettingsData>({
    therapistName: '',
    clinicName: '',
    charCountRange: '500-800',
    modelPreference: 'Pro',
    themeColor: 'indigo',
    apiSettings: {
      provider: 'Gemini',
      liteLLMKey: '',
      liteLLMBaseUrl: LITELLM_DEFAULT_BASE_URL,
      selectedModel: 'gemini-3-flash-preview'
    },
    prompts: DEFAULT_PROMPTS
  });
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [liteLLMModels, setLiteLLMModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);

  // Cancellation State
  const cancelRef = React.useRef(false);

  // Confirmation Modal State
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const [showTour, setShowTour] = useState(false);

  // Apply theme color
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.themeColor);
  }, [settings.themeColor]);

  const askConfirmation = (title: string, message: string, onConfirm: () => void) => {
    setConfirmConfig({ title, message, onConfirm });
    setShowConfirmModal(true);
  };

  const handleReset = () => {
    askConfirmation(
      'Reset Form',
      'Apakah Anda yakin ingin menghapus semua data input dan hasil laporan ini? Tindakan ini tidak dapat dibatalkan.',
      () => {
        setFormData({
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
        resetReport('');
        resetPlan('');
        resetClientReport('');
        resetSuggestions('');
        setError('');
        setActiveTab('report');
        localStorage.removeItem(STORAGE_KEY);
      }
    );
  };

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

    const hasSeenTour = localStorage.getItem('theragen_tour_seen');
    if (!hasSeenTour) {
      setShowTour(true);
    }

    const savedHistory = localStorage.getItem(HISTORY_KEY);
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse history data");
      }
    }

    const savedSettings = localStorage.getItem(SETTINGS_KEY);
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings({
          ...parsed,
          charCountRange: parsed.charCountRange || '500-800',
          modelPreference: parsed.modelPreference || 'Pro',
          themeColor: parsed.themeColor || 'indigo',
          apiSettings: parsed.apiSettings || {
            provider: 'Gemini',
            liteLLMKey: '',
            liteLLMBaseUrl: LITELLM_DEFAULT_BASE_URL,
            selectedModel: 'gemini-3-flash-preview'
          },
          prompts: parsed.prompts || DEFAULT_PROMPTS
        });
      } catch (e) {
        console.error("Failed to parse settings data");
      }
    }
  }, []);

  // Save settings to LocalStorage
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (settings.apiSettings.provider === 'LiteLLM' && settings.apiSettings.liteLLMKey) {
      const fetchModels = async () => {
        setIsFetchingModels(true);
        try {
          const models = await fetchLiteLLMModels(settings.apiSettings.liteLLMKey, settings.apiSettings.liteLLMBaseUrl);
          setLiteLLMModels(models);
          
          // If current selected model is not in the list, select the first one
          if (models.length > 0 && !models.includes(settings.apiSettings.selectedModel)) {
            setSettings(prev => ({
              ...prev,
              apiSettings: {
                ...prev.apiSettings,
                selectedModel: models[0]
              }
            }));
          }
        } catch (err) {
          logger.error("Failed to fetch LiteLLM models in App.tsx", err);
        } finally {
          setIsFetchingModels(false);
        }
      };
      fetchModels();
    }
  }, [settings.apiSettings.provider, settings.apiSettings.liteLLMKey, settings.apiSettings.liteLLMBaseUrl]);

  // Sync Dark Mode with DOM
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theragen_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theragen_theme', 'light');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode(prev => !prev);
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

  const handleCancel = () => {
    cancelRef.current = true;
    setIsGenerating(false);
    setIsGeneratingAll(false);
    setIsGeneratingPlan(false);
    setIsGeneratingClientReport(false);
    setIsGeneratingSuggestions(false);
    setError('Proses dibatalkan oleh pengguna.');
  };

  const handleGenerate = async () => {
    cancelRef.current = false;
    setIsGenerating(true);
    setError('');
    setIsEditing(false);
    setActiveTab('report');
    resetReport(''); // Clear previous report
    
    // Update selected model based on preference if using Gemini
    const apiSettings = { ...settings.apiSettings };
    if (apiSettings.provider === 'Gemini') {
      apiSettings.selectedModel = settings.modelPreference === 'Flash' ? "gemini-3-flash-preview" : "gemini-3.1-pro-preview";
    }

    try {
      let fullText = '';
      const generatedReport = await generateClinicalReport(
        formData, 
        settings.therapistName, 
        settings.clinicName, 
        settings.prompts.clinicalReport, 
        settings.charCountRange,
        (chunk) => {
          if (cancelRef.current) return;
          fullText += chunk;
          resetReport(fullText);
        },
        apiSettings
      );
      if (cancelRef.current) return;
      resetReport(generatedReport);
      resetPlan(''); // Clear previous plan when generating new report
      resetClientReport(''); // Clear previous client report
    } catch (err: any) {
      if (!cancelRef.current) {
        setError(err.message || 'Terjadi kesalahan saat membuat laporan.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGeneratePlan = async () => {
    if (!report) return;
    cancelRef.current = false;
    setIsGeneratingPlan(true);
    setError('');
    setIsEditingPlan(false);

    const apiSettings = { ...settings.apiSettings };
    if (apiSettings.provider === 'Gemini') {
      apiSettings.selectedModel = settings.modelPreference === 'Flash' ? "gemini-3-flash-preview" : "gemini-3.1-pro-preview";
    }

    try {
      const generatedPlan = await generateNextSessionPlan(formData, report, planSessionsCount, settings.therapistName, settings.clinicName, settings.prompts.nextSessionPlan, settings.charCountRange, apiSettings);
      if (cancelRef.current) return;
      resetPlan(generatedPlan);
      setActiveTab('plan');
    } catch (err: any) {
      if (!cancelRef.current) {
        setError(err.message || 'Terjadi kesalahan saat membuat rencana sesi.');
      }
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleGenerateClientReport = async () => {
    if (!report) return;
    cancelRef.current = false;
    setIsGeneratingClientReport(true);
    setError('');
    setIsEditingClientReport(false);

    const apiSettings = { ...settings.apiSettings };
    if (apiSettings.provider === 'Gemini') {
      apiSettings.selectedModel = settings.modelPreference === 'Flash' ? "gemini-3-flash-preview" : "gemini-3.1-pro-preview";
    }

    try {
      const generatedClientReport = await generateClientReport(formData, report, settings.therapistName, settings.clinicName, settings.prompts.clientReport, settings.charCountRange, apiSettings);
      if (cancelRef.current) return;
      resetClientReport(generatedClientReport);
      setActiveTab('client');
    } catch (err: any) {
      if (!cancelRef.current) {
        setError(err.message || 'Terjadi kesalahan saat membuat ringkasan untuk klien.');
      }
    } finally {
      setIsGeneratingClientReport(false);
    }
  };

  const handleGenerateSuggestions = async () => {
    if (!report) return;
    cancelRef.current = false;
    setIsGeneratingSuggestions(true);
    setError('');
    setIsEditingSuggestions(false);

    const apiSettings = { ...settings.apiSettings };
    if (apiSettings.provider === 'Gemini') {
      apiSettings.selectedModel = settings.modelPreference === 'Flash' ? "gemini-3-flash-preview" : "gemini-3.1-pro-preview";
    }

    try {
      const generatedSuggestions = await generateSuggestionsAndTips(formData, report, settings.therapistName, settings.clinicName, settings.prompts.suggestions, settings.charCountRange, apiSettings);
      if (cancelRef.current) return;
      resetSuggestions(generatedSuggestions);
      setActiveTab('suggestions');
    } catch (err: any) {
      if (!cancelRef.current) {
        setError(err.message || 'Terjadi kesalahan saat membuat saran dan tips.');
      }
    } finally {
      setIsGeneratingSuggestions(false);
    }
  };

  const handleGenerateAll = async () => {
    const startGeneration = async () => {
      cancelRef.current = false;
      setIsGeneratingAll(true);
      setError('');
      setIsEditing(false);
      setIsEditingPlan(false);
      setIsEditingClientReport(false);
      setIsEditingSuggestions(false);
      setActiveTab('report');
      
      const apiSettings = { ...settings.apiSettings };
      if (apiSettings.provider === 'Gemini') {
        apiSettings.selectedModel = settings.modelPreference === 'Flash' ? "gemini-3-flash-preview" : "gemini-3.1-pro-preview";
      }

      try {
        setIsGenerating(true);
        resetReport('');
        let fullText = '';
        const generatedReport = await generateClinicalReport(
          formData, 
          settings.therapistName, 
          settings.clinicName, 
          settings.prompts.clinicalReport, 
          settings.charCountRange,
          (chunk) => {
            if (cancelRef.current) return;
            fullText += chunk;
            resetReport(fullText);
          },
          apiSettings
        );
        if (cancelRef.current) return;
        resetReport(generatedReport);
        setIsGenerating(false);

        // Run the rest in parallel as they all depend on generatedReport
        setIsGeneratingPlan(true);
        setIsGeneratingClientReport(true);
        setIsGeneratingSuggestions(true);

        const [generatedPlan, generatedClientReport, generatedSuggestions] = await Promise.all([
          generateNextSessionPlan(formData, generatedReport, planSessionsCount, settings.therapistName, settings.clinicName, settings.prompts.nextSessionPlan, settings.charCountRange, apiSettings),
          generateClientReport(formData, generatedReport, settings.therapistName, settings.clinicName, settings.prompts.clientReport, settings.charCountRange, apiSettings),
          generateSuggestionsAndTips(formData, generatedReport, settings.therapistName, settings.clinicName, settings.prompts.suggestions, settings.charCountRange, apiSettings)
        ]);

        if (cancelRef.current) return;

        resetPlan(generatedPlan);
        setIsGeneratingPlan(false);

        resetClientReport(generatedClientReport);
        setIsGeneratingClientReport(false);

        resetSuggestions(generatedSuggestions);
        setIsGeneratingSuggestions(false);

      } catch (err: any) {
        if (!cancelRef.current) {
          setError(err.message || 'Terjadi kesalahan saat membuat laporan.');
        }
        setIsGenerating(false);
        setIsGeneratingPlan(false);
        setIsGeneratingClientReport(false);
        setIsGeneratingSuggestions(false);
      } finally {
        setIsGeneratingAll(false);
      }
    };

    if (settings.charCountRange === 'unlimited') {
      askConfirmation(
        "Konfirmasi Laporan Sangat Detail",
        "Opsi 'Tanpa Batasan' akan menghasilkan laporan yang sangat panjang. Ini akan mempercepat konsumsi kuota API Gemini Anda. Lanjutkan?",
        startGeneration
      );
    } else {
      startGeneration();
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const startAnalysis = async () => {
      setIsAnalyzingImage(true);
      
      const apiSettings = { ...settings.apiSettings };
      if (apiSettings.provider === 'Gemini') {
        apiSettings.selectedModel = "gemini-3-flash-preview"; // Use flash for analysis
      }

      try {
        const extractedData = await analyzeTherapistNotes(file, apiSettings);
        
        setFormData(prev => {
          const updatedData = { ...prev };
          const textareaFields = [
            'presentingProblem', 
            'initialObservation', 
            'techniquesUsed', 
            'sessionDynamics', 
            'postObservation', 
            'homework', 
            'nextPlan'
          ];

          Object.entries(extractedData).forEach(([key, value]) => {
            const k = key as keyof SessionData;
            const newValue = String(value || "").trim();
            
            if (!newValue) return;

            const currentValue = String(updatedData[k] || "").trim();

            if (textareaFields.includes(k)) {
              // Untuk field teks panjang, tambahkan jika belum ada informasi yang sama
              if (!currentValue) {
                updatedData[k] = newValue;
              } else if (!currentValue.toLowerCase().includes(newValue.toLowerCase())) {
                // Tambahkan dengan pemisah jika informasi baru unik
                updatedData[k] = `${currentValue}\n\n[Hasil Scan]: ${newValue}`;
              }
            } else {
              // Untuk field input pendek (nama, umur, gender, SUD), isi hanya jika masih kosong
              if (!currentValue) {
                updatedData[k] = newValue;
              }
            }
          });
          
          return updatedData;
        });

        alert(`Catatan berhasil dianalisis dan dimasukkan ke dalam form!`);
      } catch (err: any) {
        alert(err.message || "Gagal menganalisis gambar.");
      } finally {
        setIsAnalyzingImage(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    if (settings.charCountRange === 'unlimited') {
      askConfirmation(
        "Konfirmasi Analisis Gambar",
        "Opsi 'Tanpa Batasan' aktif. Proses ini mungkin menggunakan lebih banyak kuota API. Lanjutkan?",
        startAnalysis
      );
    } else {
      startAnalysis();
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
          <h1 style="font-size: 24px; color: #1e1b4b; margin: 0 0 5px 0; font-weight: 700;">${settings.clinicName || 'Klinik Hipnoterapi'}</h1>
          <p style="font-size: 16px; color: #334155; margin: 0 0 5px 0; font-weight: 500;">Layanan Hipnoterapi dan Konsultasi Psikologi</p>
          <div style="display: inline-block; background-color: #e0e7ff; color: #4f46e5; padding: 4px 12px; border-radius: 9999px; font-size: 14px; font-weight: 600; margin-top: 15px;">
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
          <h1>${settings.clinicName || 'Klinik Hipnoterapi'}</h1>
          <p>Layanan Hipnoterapi dan Konsultasi Psikologi</p>
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

  const handleCompleteTour = () => {
    setShowTour(false);
    localStorage.setItem('theragen_tour_seen', 'true');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans text-slate-900 dark:text-slate-100 flex flex-col md:flex-row">
      {showTour && <Tour onComplete={handleCompleteTour} />}
      {/* Left Panel: Form */}
      <div className="w-full md:w-1/2 lg:w-[45%] h-screen overflow-y-auto border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 md:p-8 print:hidden">
        <div className="mb-8 flex justify-between items-start">
          <div id="tour-logo">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[9px] font-bold rounded uppercase tracking-widest border border-slate-200 dark:border-slate-700">
                Hanya digunakan oleh Kalangan Profesional
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-primary-600 dark:text-primary-400" />
              TheraGen
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Generator Laporan Konseling & Hipnoterapi Klinis
            </p>
          </div>
          <div id="tour-utilities" className="flex items-center gap-2">
            <button
              onClick={() => setShowTour(true)}
              className="p-2 text-slate-500 hover:text-primary-600 hover:bg-primary-50 dark:text-slate-400 dark:hover:text-primary-400 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title="Panduan Pengguna"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            <button
              onClick={handleReset}
              className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:text-slate-400 dark:hover:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              title="Reset Form"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowHistoryModal(true)}
              className="p-2 text-slate-500 hover:text-primary-600 hover:bg-primary-50 dark:text-slate-400 dark:hover:text-primary-400 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title="Riwayat Laporan"
            >
              <History className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowSettingsModal(true)}
              className="p-2 text-slate-500 hover:text-primary-600 hover:bg-primary-50 dark:text-slate-400 dark:hover:text-primary-400 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title="Pengaturan"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={toggleDarkMode}
              className="p-2 text-slate-500 hover:text-primary-600 hover:bg-primary-50 dark:text-slate-400 dark:hover:text-primary-400 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title={isDarkMode ? "Mode Terang" : "Mode Gelap"}
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div id="tour-upload" className="relative mb-6 p-4 bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800/30 rounded-xl flex items-center justify-between print:hidden overflow-hidden">
          <div className="absolute top-0 right-0">
            <div className="bg-amber-500 text-white text-[9px] font-bold px-3 py-1 rounded-bl-lg shadow-sm uppercase tracking-wider">PRO</div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-primary-900 dark:text-primary-300 flex items-center gap-1.5">
              <ImagePlus className="w-4 h-4" /> Upload Catatan Terapis
            </h3>
            <p className="text-xs text-primary-700 dark:text-primary-400/80 mt-1">AI akan membaca foto catatan Anda dan mengisi form otomatis.</p>
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
            className="px-3 py-1.5 bg-white dark:bg-slate-800 text-primary-600 dark:text-primary-400 text-sm font-medium rounded-lg shadow-sm border border-primary-200 dark:border-slate-700 hover:bg-primary-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
          >
            {isAnalyzingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {isAnalyzingImage ? 'Menganalisis...' : 'Upload Foto'}
          </button>
        </div>

        <div id="tour-form" className="space-y-8 pb-24">
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
                  <div id="tour-fastchoice">
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
        <div id="tour-generate" className="fixed bottom-0 left-0 w-full md:w-1/2 lg:w-[45%] bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10 print:hidden flex gap-3">
            {(isGenerating || isGeneratingAll || isGeneratingPlan || isGeneratingClientReport || isGeneratingSuggestions) ? (
              <button
                onClick={handleCancel}
                className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400 font-medium py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <XCircle className="w-5 h-5" />
                Batal Generate
              </button>
            ) : (
              <>
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || isGeneratingAll}
                  className="flex-1 bg-primary-50 hover:bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:hover:bg-primary-900/50 dark:text-primary-300 font-medium py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                  title="Hanya generate Laporan Sesi"
                >
                  <FileCheck className="w-5 h-5" />
                  Laporan Saja
                </button>
                <button
                  onClick={handleGenerateAll}
                  disabled={isGeneratingAll || isGenerating}
                  className="flex-[2] bg-primary-600 hover:bg-primary-700 text-white font-medium py-3 px-4 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                  title="Generate Laporan, Rencana, Laporan Klien, dan Saran sekaligus"
                >
                  <Sparkles className="w-5 h-5" />
                  Generate Semua
                </button>
              </>
            )}
          </div>
      </div>

      {/* Right Panel: Preview */}
      <div id="tour-preview" className="w-full md:w-1/2 lg:w-[55%] h-screen overflow-y-auto bg-slate-50 dark:bg-slate-900 p-6 md:p-8 print:w-full print:h-auto print:bg-white print:p-0">
        <div className="max-w-3xl mx-auto">
          {error && (
            <div className="mb-6 p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-2xl text-red-700 dark:text-red-400 text-sm print:hidden shadow-sm">
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold mb-1">Terjadi Kesalahan</p>
                  <p className="opacity-90 leading-relaxed">{error}</p>
                  {(error.includes('RESOURCE_EXHAUSTED') || error.includes('429')) && (
                    <div className="mt-4 p-4 bg-white/50 dark:bg-black/20 rounded-xl border border-red-200/50 dark:border-red-800/30">
                      <p className="font-medium mb-2 text-red-800 dark:text-red-300">Kuota AI Habis</p>
                      <p className="mb-4 text-xs opacity-80">Anda telah mencapai batas penggunaan gratis. Silakan gunakan API Key Anda sendiri (dari Google AI Studio) untuk melanjutkan tanpa batasan.</p>
                      <button
                        onClick={async () => {
                          try {
                            await window.aistudio.openSelectKey();
                            setError(''); // Clear error after selecting key
                          } catch (e) {
                            console.error("Failed to open key selector", e);
                          }
                        }}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium text-xs flex items-center gap-2 shadow-sm"
                      >
                        <Key className="w-3.5 h-3.5" /> Pilih / Ganti API Key
                      </button>
                    </div>
                  )}
                </div>
              </div>
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
            <div className="h-full min-h-[60vh] flex flex-col items-center justify-center text-primary-500 dark:text-primary-400 print:hidden">
              <Loader2 className="w-12 h-12 animate-spin mb-4" />
              <p className="animate-pulse font-medium mb-6">AI sedang menganalisis dan menyusun laporan...</p>
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400 font-medium rounded-lg transition-all flex items-center gap-2"
              >
                <XCircle className="w-4 h-4" /> Batal Generate
              </button>
            </div>
          )}

          {report && !isGenerating && (
            <div className="bg-white dark:bg-slate-950 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden print:border-none print:shadow-none">
              
              {/* TABS */}
              <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 print:hidden overflow-x-auto">
                <button
                  onClick={() => setActiveTab('report')}
                  className={`flex-1 py-3 px-4 text-sm font-medium text-center border-b-2 transition-colors whitespace-nowrap ${activeTab === 'report' ? 'border-primary-600 dark:border-primary-500 text-primary-600 dark:text-primary-400 bg-white dark:bg-slate-950' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                  <FileCheck className="w-4 h-4 inline-block mr-1.5 mb-0.5" /> Laporan Sesi
                </button>
                <button
                  onClick={() => setActiveTab('plan')}
                  className={`flex-1 py-3 px-4 text-sm font-medium text-center border-b-2 transition-colors whitespace-nowrap ${activeTab === 'plan' ? 'border-primary-600 dark:border-primary-500 text-primary-600 dark:text-primary-400 bg-white dark:bg-slate-950' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                  <CalendarPlus className="w-4 h-4 inline-block mr-1.5 mb-0.5" /> Rencana Sesi
                </button>
                <button
                  onClick={() => setActiveTab('client')}
                  className={`flex-1 py-3 px-4 text-sm font-medium text-center border-b-2 transition-colors whitespace-nowrap ${activeTab === 'client' ? 'border-primary-600 dark:border-primary-500 text-primary-600 dark:text-primary-400 bg-white dark:bg-slate-950' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                  <MessageSquareHeart className="w-4 h-4 inline-block mr-1.5 mb-0.5" /> Laporan Klien
                </button>
                <button
                  onClick={() => setActiveTab('suggestions')}
                  className={`flex-1 py-3 px-4 text-sm font-medium text-center border-b-2 transition-colors whitespace-nowrap ${activeTab === 'suggestions' ? 'border-primary-600 dark:border-primary-500 text-primary-600 dark:text-primary-400 bg-white dark:bg-slate-950' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
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
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${isEditing ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300' : 'text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20'}`}
                      >
                        {isEditing ? <><Check className="w-4 h-4" /> Selesai Edit</> : <><Edit3 className="w-4 h-4" /> Edit</>}
                      </button>
                      {isEditing && (
                        <>
                          <button
                            onClick={undoReport}
                            disabled={!canUndoReport}
                            className="flex items-center gap-1.5 px-2 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Undo"
                          >
                            <Undo2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={redoReport}
                            disabled={!canRedoReport}
                            className="flex items-center gap-1.5 px-2 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Redo"
                          >
                            <Redo2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={saveToHistory}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 rounded-lg transition-colors"
                      >
                        <Save className="w-4 h-4" /> Simpan
                      </button>
                      <button
                        onClick={() => handleCopy(report)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                        {copied ? 'Tersalin!' : 'Salin'}
                      </button>
                      <button
                        onClick={() => handleDownloadPDF(report, `Laporan_Sesi_${formData.clientName.replace(/\s+/g, '_') || 'Klien'}`, 'Laporan Sesi Hipnoterapi')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                      >
                        <FileText className="w-4 h-4" /> PDF
                      </button>
                      <button
                        onClick={() => handleDownloadDOCX(report, `Laporan_Sesi_${formData.clientName.replace(/\s+/g, '_') || 'Klien'}`, 'Laporan Sesi Hipnoterapi')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
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
                        className="w-full min-h-[60vh] p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm text-slate-800 dark:text-slate-200 resize-y"
                      />
                    ) : (
                      <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-a:text-primary-600 dark:prose-a:text-primary-400 prose-li:my-0.5">
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
                          className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-slate-200"
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
                        className="px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 transition-colors flex items-center gap-2"
                      >
                        <Sparkles className="w-4 h-4" /> Generate Rencana Sesi
                      </button>
                    </div>
                  ) : isGeneratingPlan ? (
                    <div className="p-12 flex flex-col items-center justify-center text-primary-500">
                      <Loader2 className="w-10 h-10 animate-spin mb-4" />
                      <p className="animate-pulse font-medium mb-6">Menyusun rencana sesi selanjutnya...</p>
                      <button
                        onClick={handleCancel}
                        className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400 font-medium rounded-lg transition-all flex items-center gap-2"
                      >
                        <XCircle className="w-4 h-4" /> Batal
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-2 print:hidden">
                        <h3 className="font-semibold text-slate-800 dark:text-slate-200">Rencana Sesi</h3>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            onClick={() => setIsEditingPlan(!isEditingPlan)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${isEditingPlan ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300' : 'text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20'}`}
                          >
                            {isEditingPlan ? <><Check className="w-4 h-4" /> Selesai Edit</> : <><Edit3 className="w-4 h-4" /> Edit</>}
                          </button>
                          {isEditingPlan && (
                            <>
                              <button onClick={undoPlan} disabled={!canUndoPlan} className="flex items-center gap-1.5 px-2 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Undo"><Undo2 className="w-4 h-4" /></button>
                              <button onClick={redoPlan} disabled={!canRedoPlan} className="flex items-center gap-1.5 px-2 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Redo"><Redo2 className="w-4 h-4" /></button>
                            </>
                          )}
                          <button
                            onClick={() => handleCopy(plan)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                          >
                            <Copy className="w-4 h-4" /> {copied ? 'Tersalin!' : 'Salin'}
                          </button>
                          <button
                            onClick={() => handleDownloadPDF(plan, `Rencana_Sesi_${formData.clientName.replace(/\s+/g, '_') || 'Klien'}`, 'Rencana Sesi Selanjutnya')}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                          >
                            <FileText className="w-4 h-4" /> PDF
                          </button>
                          <button
                            onClick={() => handleDownloadDOCX(plan, `Rencana_Sesi_${formData.clientName.replace(/\s+/g, '_') || 'Klien'}`, 'Rencana Sesi Selanjutnya')}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
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
                            className="w-full min-h-[60vh] p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm text-slate-800 dark:text-slate-200 resize-y"
                          />
                        ) : (
                          <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-a:text-primary-600 dark:prose-a:text-primary-400 prose-li:my-0.5">
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
                        className="px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 transition-colors flex items-center gap-2"
                      >
                        <Sparkles className="w-4 h-4" /> Generate Laporan Klien
                      </button>
                    </div>
                  ) : isGeneratingClientReport ? (
                    <div className="p-12 flex flex-col items-center justify-center text-primary-500">
                      <Loader2 className="w-10 h-10 animate-spin mb-4" />
                      <p className="animate-pulse font-medium mb-6">Menyusun ringkasan untuk klien...</p>
                      <button
                        onClick={handleCancel}
                        className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400 font-medium rounded-lg transition-all flex items-center gap-2"
                      >
                        <XCircle className="w-4 h-4" /> Batal
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-2 print:hidden">
                        <h3 className="font-semibold text-slate-800 dark:text-slate-200">Laporan Klien</h3>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            onClick={() => setIsEditingClientReport(!isEditingClientReport)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${isEditingClientReport ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300' : 'text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20'}`}
                          >
                            {isEditingClientReport ? <><Check className="w-4 h-4" /> Selesai Edit</> : <><Edit3 className="w-4 h-4" /> Edit</>}
                          </button>
                          {isEditingClientReport && (
                            <>
                              <button onClick={undoClientReport} disabled={!canUndoClientReport} className="flex items-center gap-1.5 px-2 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Undo"><Undo2 className="w-4 h-4" /></button>
                              <button onClick={redoClientReport} disabled={!canRedoClientReport} className="flex items-center gap-1.5 px-2 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Redo"><Redo2 className="w-4 h-4" /></button>
                            </>
                          )}
                          <button
                            onClick={() => handleCopy(clientReport)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                          >
                            <Copy className="w-4 h-4" /> {copied ? 'Tersalin!' : 'Salin'}
                          </button>
                          <button
                            onClick={() => handleDownloadPDF(clientReport, `Ringkasan_Sesi_${formData.clientName.replace(/\s+/g, '_') || 'Klien'}`, 'Ringkasan Sesi untuk Klien')}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                          >
                            <FileText className="w-4 h-4" /> PDF
                          </button>
                          <button
                            onClick={() => handleDownloadDOCX(clientReport, `Ringkasan_Sesi_${formData.clientName.replace(/\s+/g, '_') || 'Klien'}`, 'Ringkasan Sesi untuk Klien')}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
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
                            className="w-full min-h-[60vh] p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm text-slate-800 dark:text-slate-200 resize-y"
                          />
                        ) : (
                          <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-a:text-primary-600 dark:prose-a:text-primary-400 prose-li:my-0.5">
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
                        className="px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 transition-colors flex items-center gap-2"
                      >
                        <Sparkles className="w-4 h-4" /> Generate Saran & Tips
                      </button>
                    </div>
                  ) : isGeneratingSuggestions ? (
                    <div className="p-12 flex flex-col items-center justify-center text-primary-500">
                      <Loader2 className="w-10 h-10 animate-spin mb-4" />
                      <p className="animate-pulse font-medium mb-6">Menyusun saran dan tips...</p>
                      <button
                        onClick={handleCancel}
                        className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400 font-medium rounded-lg transition-all flex items-center gap-2"
                      >
                        <XCircle className="w-4 h-4" /> Batal
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-2 print:hidden">
                        <h3 className="font-semibold text-slate-800 dark:text-slate-200">Saran & Tips</h3>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            onClick={() => setIsEditingSuggestions(!isEditingSuggestions)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${isEditingSuggestions ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300' : 'text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20'}`}
                          >
                            {isEditingSuggestions ? <><Check className="w-4 h-4" /> Selesai Edit</> : <><Edit3 className="w-4 h-4" /> Edit</>}
                          </button>
                          {isEditingSuggestions && (
                            <>
                              <button onClick={undoSuggestions} disabled={!canUndoSuggestions} className="flex items-center gap-1.5 px-2 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Undo"><Undo2 className="w-4 h-4" /></button>
                              <button onClick={redoSuggestions} disabled={!canRedoSuggestions} className="flex items-center gap-1.5 px-2 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Redo"><Redo2 className="w-4 h-4" /></button>
                            </>
                          )}
                          <button
                            onClick={() => handleCopy(suggestions)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                          >
                            <Copy className="w-4 h-4" /> {copied ? 'Tersalin!' : 'Salin'}
                          </button>
                          <button
                            onClick={() => handleDownloadPDF(suggestions, `Saran_Tips_${formData.clientName.replace(/\s+/g, '_') || 'Klien'}`, 'Saran & Tips untuk Klien')}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                          >
                            <FileText className="w-4 h-4" /> PDF
                          </button>
                          <button
                            onClick={() => handleDownloadDOCX(suggestions, `Saran_Tips_${formData.clientName.replace(/\s+/g, '_') || 'Klien'}`, 'Saran & Tips untuk Klien')}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
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
                            className="w-full min-h-[60vh] p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm text-slate-800 dark:text-slate-200 resize-y"
                          />
                        ) : (
                          <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-a:text-primary-600 dark:prose-a:text-primary-400 prose-li:my-0.5">
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

          {/* AI Disclaimer */}
          {report && !isGenerating && (
            <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl flex items-start gap-3 print:hidden shadow-sm">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                  <span className="font-bold">Penting:</span> Hasil yang dihasilkan oleh AI dapat mengandung kesalahan atau ketidakakuratan. Harap tinjau dan edit kembali laporan ini sebelum digunakan secara profesional.
                </p>
              </div>
            </div>
          )}
          
          <footer className="mt-12 py-6 border-t border-slate-200 dark:border-slate-800 text-center print:hidden">
            <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4 text-primary-500" />
              Aplikasi ini dikembangkan oleh <span className="font-bold text-primary-600 dark:text-primary-400">Soultiva AI Dev</span>
            </p>
          </footer>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && confirmConfig && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-primary-600 dark:text-primary-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                {confirmConfig.title}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {confirmConfig.message}
              </p>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-950 flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  confirmConfig.onConfirm();
                }}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-sm transition-colors"
              >
                Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-800">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary-600 dark:text-primary-400" /> Pengaturan
              </h2>
              <button 
                onClick={() => setShowSettingsModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                Tutup
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              <div className="space-y-4">
                <FormInput 
                  label="Nama Terapis" 
                  id="therapistName" 
                  placeholder="Contoh: Nama Lengkap & Gelar Anda" 
                  value={settings.therapistName} 
                  onChange={(e) => setSettings(prev => ({ ...prev, therapistName: e.target.value }))} 
                />
                <FormInput 
                  label="Nama Lembaga / Klinik" 
                  id="clinicName" 
                  placeholder="Contoh: Nama Klinik atau Praktik Mandiri" 
                  value={settings.clinicName} 
                  onChange={(e) => setSettings(prev => ({ ...prev, clinicName: e.target.value }))} 
                />
                <FormSelect
                  label="Batasan Jumlah Karakter Laporan"
                  id="charCountRange"
                  value={settings.charCountRange}
                  onChange={(e) => setSettings(prev => ({ ...prev, charCountRange: e.target.value as any }))}
                  options={[
                    { value: '500-800', label: '500 - 800 Karakter (Hemat)' },
                    { value: '800-1500', label: '800 - 1500 Karakter (Standar)' },
                    { value: '1500-2000', label: '1500 - 2000 Karakter (Lengkap)' },
                    { value: 'unlimited', label: 'Tanpa Batasan (Sangat Detail)' }
                  ]}
                />
                <FormSelect
                  label="Preferensi Model AI (Kecepatan vs Kualitas)"
                  id="modelPreference"
                  value={settings.modelPreference}
                  onChange={(e) => setSettings(prev => ({ ...prev, modelPreference: e.target.value as any }))}
                  options={[
                    { value: 'Flash', label: 'Gemini Flash (Sangat Cepat, Kualitas Standar)' },
                    { value: 'Pro', label: 'Gemini Pro (Lebih Lambat, Kualitas Klinis Tinggi)' }
                  ]}
                />

                <div className="space-y-2">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-2">
                    <Sparkles size={14} className="text-primary-600" /> Tema Warna Aplikasi
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {(['indigo', 'slate', 'blue', 'emerald', 'rose', 'amber'] as ThemeColor[]).map((color) => (
                      <button
                        key={color}
                        onClick={() => setSettings(prev => ({ ...prev, themeColor: color }))}
                        className={`h-10 rounded-lg border-2 transition-all flex items-center justify-center ${
                          settings.themeColor === color 
                            ? 'border-primary-600 ring-2 ring-primary-500/20' 
                            : 'border-transparent hover:border-slate-200 dark:hover:border-slate-700'
                        }`}
                        title={color.charAt(0).toUpperCase() + color.slice(1)}
                      >
                        <div className={`w-6 h-6 rounded-full shadow-sm ${
                          color === 'indigo' ? 'bg-primary-600' :
                          color === 'slate' ? 'bg-slate-800' :
                          color === 'blue' ? 'bg-blue-600' :
                          color === 'emerald' ? 'bg-emerald-600' :
                          color === 'rose' ? 'bg-rose-600' :
                          'bg-amber-600'
                        }`} />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => setShowLogsModal(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-all font-medium text-xs border border-slate-200 dark:border-slate-700"
                  >
                    <FileText className="w-4 h-4" /> Lihat Application Logs
                  </button>
                </div>

                <div className="pt-4 space-y-4">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Key size={16} className="text-primary-600 dark:text-primary-400" />
                    Setting API Key & Endpoint
                  </h3>
                  <div className="space-y-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSettings(prev => ({ ...prev, apiSettings: { ...prev.apiSettings, provider: 'Gemini' } }))}
                        className={`flex-1 py-2 px-3 rounded-lg border text-xs font-medium transition-all relative ${
                          settings.apiSettings.provider === 'Gemini'
                            ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:border-primary-600'
                        }`}
                      >
                        Google Gen AI
                        <span className={`absolute -top-2 -right-1 px-1.5 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-tighter ${
                          settings.apiSettings.provider === 'Gemini' ? 'bg-white text-primary-600' : 'bg-primary-600 text-white'
                        }`}>Bawaan</span>
                      </button>
                      <button
                        onClick={() => setSettings(prev => ({ ...prev, apiSettings: { ...prev.apiSettings, provider: 'LiteLLM' } }))}
                        className={`flex-1 py-2 px-3 rounded-lg border text-xs font-medium transition-all ${
                          settings.apiSettings.provider === 'LiteLLM'
                            ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:border-primary-600'
                        }`}
                      >
                        LiteLLM Proxy
                      </button>
                    </div>

                    {settings.apiSettings.provider === 'Gemini' ? (
                      <div className="space-y-3">
                        <div className="p-3 bg-primary-50/50 dark:bg-primary-900/10 border border-primary-100/50 dark:border-primary-800/20 rounded-lg">
                          <p className="text-[10px] text-primary-800 dark:text-primary-300 leading-relaxed">
                            <span className="font-bold">Mode Bawaan:</span> Aplikasi sudah dikonfigurasi menggunakan Google Gemini secara otomatis. Anda tidak perlu melakukan pengaturan API Key tambahan untuk mulai menggunakan aplikasi.
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 italic">
                            Gunakan tombol di bawah jika Anda ingin menggunakan API Key pribadi Anda (misal: jika kuota bawaan habis).
                          </p>
                        </div>
                        <button
                          onClick={async () => {
                            try {
                              await window.aistudio.openSelectKey();
                            } catch (e) {
                              console.error("Failed to open key selector", e);
                            }
                          }}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg transition-all font-medium text-xs border border-slate-200 dark:border-slate-700"
                        >
                          <Key className="w-4 h-4" /> Pilih / Ganti API Key Pribadi
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="p-3 bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100/50 dark:border-amber-800/20 rounded-lg">
                          <p className="text-[10px] text-amber-800 dark:text-amber-300 leading-relaxed">
                            <span className="font-bold">Mode Alternatif:</span> Gunakan LiteLLM jika Anda ingin menghubungkan ke model lain atau jika kuota Gemini bawaan telah habis.
                          </p>
                        </div>
                        <FormInput
                          label="LiteLLM Base URL"
                          value={settings.apiSettings.liteLLMBaseUrl}
                          onChange={(e: any) => {
                            const val = e.target.value;
                            setSettings(prev => ({ ...prev, apiSettings: { ...prev.apiSettings, liteLLMBaseUrl: val } }));
                          }}
                          placeholder="https://litellm.koboi2026.biz.id/v1"
                        />
                        <FormInput
                          label="LiteLLM API Key"
                          type="password"
                          value={settings.apiSettings.liteLLMKey}
                          onChange={(e: any) => {
                            const val = e.target.value;
                            setSettings(prev => ({ ...prev, apiSettings: { ...prev.apiSettings, liteLLMKey: val } }));
                          }}
                          placeholder="Masukkan LiteLLM API Key Anda"
                        />
                        <div>
                          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Pilih Model</label>
                          <div className="relative">
                            <select
                              value={settings.apiSettings.selectedModel}
                              onChange={(e) => setSettings(prev => ({ ...prev, apiSettings: { ...prev.apiSettings, selectedModel: e.target.value } }))}
                              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all appearance-none text-xs text-slate-900 dark:text-slate-100"
                              disabled={isFetchingModels || liteLLMModels.length === 0}
                            >
                              {isFetchingModels ? (
                                <option>Fetching models...</option>
                              ) : liteLLMModels.length > 0 ? (
                                liteLLMModels.map(model => (
                                  <option key={model} value={model}>{model}</option>
                                ))
                              ) : (
                                <option>Masukkan API Key untuk melihat model</option>
                              )}
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  Informasi ini akan disinkronkan dan digunakan secara otomatis pada setiap laporan yang di-generate.
                </p>
                
                <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
                  <button
                    onClick={() => setShowLogsModal(true)}
                    className="flex items-center justify-center gap-2 w-full px-4 py-2 text-slate-500 hover:text-primary-600 hover:bg-primary-50 dark:text-slate-400 dark:hover:text-primary-400 dark:hover:bg-slate-800 rounded-lg transition-colors text-xs font-medium border border-slate-200 dark:border-slate-800 mb-4"
                  >
                    <FileText className="w-4 h-4" />
                    Buka Application Logs
                  </button>
                  <p className="text-[10px] font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wider">
                    Developed by Soultiva AI Dev
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-end">
              <button 
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-medium text-sm"
              >
                Simpan & Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <History className="w-6 h-6 text-primary-600 dark:text-primary-400" />
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
                      className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-primary-300 dark:hover:border-primary-500/50 hover:bg-primary-50/50 dark:hover:bg-primary-900/10 cursor-pointer transition-all group"
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
      {/* Logs Modal */}
      {showLogsModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-100 dark:bg-primary-900/40 rounded-lg text-primary-600 dark:text-primary-400">
                  <FileText size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Application Logs</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Monitor aktivitas dan error aplikasi</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    logger.clear();
                    setSettings(prev => ({ ...prev })); // Force re-render
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  Clear Logs
                </button>
                <button 
                  onClick={() => setShowLogsModal(false)}
                  className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"
                >
                  <XCircle size={20} className="text-slate-400" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 bg-slate-950 font-mono text-xs">
              {logger.getLogs().length === 0 ? (
                <div className="text-slate-600 italic text-center py-10">No logs available.</div>
              ) : (
                <div className="space-y-1">
                  {logger.getLogs().map((log, index) => (
                    <div key={index} className="border-b border-slate-900 pb-1">
                      <div className="flex gap-2">
                        <span className="text-slate-600">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                        <span className={`font-bold ${
                          log.level === 'error' ? 'text-red-400' :
                          log.level === 'warn' ? 'text-yellow-400' :
                          log.level === 'info' ? 'text-blue-400' :
                          'text-slate-500'
                        }`}>
                          {log.level.toUpperCase()}
                        </span>
                        <span className="text-slate-300">{log.message}</span>
                      </div>
                      {log.data && (
                        <pre className="mt-1 ml-20 text-slate-500 text-[10px] overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify(log.data, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-right">
              <button
                onClick={() => setShowLogsModal(false)}
                className="px-6 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-all font-medium text-sm"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
