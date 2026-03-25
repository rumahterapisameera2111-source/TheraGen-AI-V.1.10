import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Sparkles, 
  Upload, 
  MousePointer2, 
  Zap, 
  FileText, 
  History, 
  ChevronRight, 
  CheckCircle2 
} from 'lucide-react';

interface TourStep {
  icon: React.ElementType;
  color: string;
  title: string;
  description: string;
}

const steps: TourStep[] = [
  {
    icon: Upload,
    color: 'text-primary-500',
    title: 'Upload Catatan Terapis',
    description: 'Punya catatan tangan? Upload foto catatan Anda, AI akan otomatis menganalisis dan mengisi form untuk Anda.'
  },
  {
    icon: MousePointer2,
    color: 'text-emerald-500',
    title: 'Input Cepat (FastChoice)',
    description: 'Gunakan tombol-tombol cepat di bawah text area untuk memasukkan observasi klinis umum hanya dengan satu klik.'
  },
  {
    icon: Zap,
    color: 'text-amber-500',
    title: 'Generate Laporan Otomatis',
    description: 'Klik "Generate Semua" untuk mendapatkan Laporan Klinis, Rencana Sesi, Laporan Klien, dan Saran sekaligus.'
  },
  {
    icon: FileText,
    color: 'text-blue-500',
    title: 'Review & Download',
    description: 'Hasil laporan muncul di panel kanan. Anda bisa langsung mengedit, menyalin, atau mendownload sebagai PDF/Word.'
  },
  {
    icon: History,
    color: 'text-purple-500',
    title: 'Riwayat & Pengaturan',
    description: 'Semua laporan tersimpan otomatis di Riwayat. Atur nama terapis & klinik Anda di menu Pengaturan.'
  }
];

export function Tour({ onComplete }: { onComplete: () => void }) {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-2xl bg-white dark:bg-slate-950 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-600 rounded-xl shadow-lg shadow-primary-200 dark:shadow-none">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Panduan Cepat TheraGen</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Pahami alur kerja aplikasi dalam 1 menit</p>
            </div>
          </div>
          <button 
            onClick={onComplete}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col md:flex-row h-auto max-h-[80vh]">
          {/* Sidebar Steps */}
          <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800 p-4 flex md:flex-col gap-2 overflow-x-auto md:overflow-y-auto bg-slate-50/30 dark:bg-slate-900/30">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <button
                  key={index}
                  onClick={() => setActiveStep(index)}
                  className={`flex-shrink-0 md:w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                    activeStep === index 
                      ? 'bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700' 
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800/50 opacity-60 hover:opacity-100'
                  }`}
                >
                  <div className={`p-1.5 rounded-lg ${activeStep === index ? 'bg-primary-50 dark:bg-primary-900/30' : 'bg-slate-100 dark:bg-slate-800'}`}>
                    <Icon className={`w-5 h-5 ${activeStep === index ? 'text-primary-600 dark:text-primary-400' : step.color}`} />
                  </div>
                  <span className={`text-xs font-semibold whitespace-nowrap ${activeStep === index ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                    Langkah {index + 1}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Content Area */}
          <div className="flex-1 p-6 md:p-8 flex flex-col justify-center relative overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div className="inline-flex p-4 bg-primary-50 dark:bg-primary-900/20 rounded-2xl mb-2">
                  {React.createElement(steps[activeStep].icon, { className: 'w-10 h-10 text-primary-600 dark:text-primary-400' })}
                </div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {steps[activeStep].title}
                </h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  {steps[activeStep].description}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* Pagination Dots */}
            <div className="absolute bottom-4 left-6 md:bottom-8 md:left-8 flex gap-1.5">
              {steps.map((_, i) => (
                <div 
                  key={i} 
                  className={`h-1.5 rounded-full transition-all ${i === activeStep ? 'w-6 bg-primary-600' : 'w-1.5 bg-slate-200 dark:bg-slate-800'}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <button 
            onClick={onComplete}
            className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
          >
            Lewati Panduan
          </button>
          
          <div className="flex gap-3">
            {activeStep < steps.length - 1 ? (
              <button
                onClick={() => setActiveStep(prev => prev + 1)}
                className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl shadow-lg shadow-primary-200 dark:shadow-none transition-all flex items-center gap-2"
              >
                Lanjut
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={onComplete}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-lg shadow-emerald-200 dark:shadow-none transition-all flex items-center gap-2"
              >
                Mulai Sekarang
                <CheckCircle2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
