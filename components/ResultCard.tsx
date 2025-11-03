
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
    <div className={`bg-black/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-lg transition-all duration-300 ${className}`}>
      <div className="p-4 border-b border-white/10 flex items-center space-x-3">
        {icon}
        <h2 className="text-lg font-semibold text-cyan-300">{title}</h2>
      </div>
      <div className="p-4 md:p-6">
        {children}
      </div>
    </div>
  );
};

export default ResultCard;