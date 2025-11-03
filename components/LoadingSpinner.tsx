
import React from 'react';

const LoadingSpinner: React.FC = () => (
  <div className="flex justify-center items-center p-4">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
  </div>
);

export const SkeletonLoader: React.FC<{className?: string}> = ({className}) => (
    <div className={`animate-pulse rounded-md bg-white/10 ${className}`}></div>
)

export default LoadingSpinner;