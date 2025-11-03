import React from 'react';

interface ResultCardProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  isLoading?: boolean;
  className?: string;
}

const ResultCard: React.FC<ResultCardProps> = ({ title, icon, children, isLoading = false, className = '' }) => {
  return (
    <div className={`bg-white/60 dark:bg-black/20 backdrop-blur-xl border border-slate-300 dark:border-white/10 rounded-2xl shadow-lg dark:shadow-2xl transition-all duration-300 ${className}`}>
      <div className="p-4 border-b border-slate-300 dark:border-white/10 flex items-center space-x-3">
        {icon}
        <h2 className="text-lg font-semibold text-cyan-700 dark:text-cyan-300">{title}</h2>
      </div>
      <div className="p-4 md:p-6">
        {children}
      </div>
    </div>
  );
};

export default ResultCard;