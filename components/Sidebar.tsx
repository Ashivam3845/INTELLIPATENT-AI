import React from 'react';
import { LightBulbIcon, SearchIcon, GlobeIcon, BrainCircuitIcon, DashboardIcon, ClaimMapIcon } from './icons';

export type Page = 'dashboard' | 'summary' | 'similar' | 'geo' | 'trends' | 'claimAnalysis';

interface SidebarProps {
  activePage: Page;
  onPageChange: (page: Page) => void;
}

const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: DashboardIcon, tooltip: 'View all analysis sections at a glance' },
    { id: 'summary', label: 'Summary', icon: LightBulbIcon, tooltip: 'Focus on the invention summary: problem, novelty, and solution' },
    { id: 'similar', label: 'Similar Patents', icon: SearchIcon, tooltip: 'Explore similar patents, prior art, and related technologies' },
    { id: 'geo', label: 'Geo Insights', icon: GlobeIcon, tooltip: 'Visualize geographic hotspots for innovation in this domain' },
    { id: 'trends', label: 'Deep Trends', icon: BrainCircuitIcon, tooltip: 'Read an in-depth analysis of innovation trends and market opportunities' },
    { id: 'claimAnalysis', label: 'Claim Analysis', icon: ClaimMapIcon, tooltip: 'Compare subject patent claims against a reference patent' },
];

const Sidebar: React.FC<SidebarProps> = ({ activePage, onPageChange }) => {
    return (
        <nav className="bg-black/20 backdrop-blur-xl border border-white/10 rounded-2xl p-4 sticky top-8 h-auto">
            <ul className="space-y-2">
                {navItems.map(item => (
                    <li key={item.id}>
                        <button
                            title={item.tooltip}
                            onClick={() => onPageChange(item.id as Page)}
                            className={`w-full flex items-center p-3 rounded-lg transition-all duration-200 ${activePage === item.id ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}
                        >
                            <item.icon className="w-5 h-5 mr-3 flex-shrink-0" />
                            <span className="font-medium text-sm text-left">{item.label}</span>
                        </button>
                    </li>
                ))}
            </ul>
        </nav>
    );
};

export default Sidebar;