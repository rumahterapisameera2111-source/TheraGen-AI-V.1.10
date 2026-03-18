import React from 'react';

interface FastChoiceProps {
  options: string[];
  onSelect: (value: string) => void;
}

export function FastChoice({ options, onSelect }: FastChoiceProps) {
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {options.map((option, index) => (
        <button
          key={index}
          type="button"
          onClick={() => onSelect(option)}
          className="px-2.5 py-1 text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full hover:bg-primary-100 dark:hover:bg-primary-900/50 hover:text-primary-700 dark:hover:text-primary-300 transition-colors border border-slate-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-500/50"
        >
          + {option}
        </button>
      ))}
    </div>
  );
}
