'use client';

import { Map, Package, GitBranch } from 'lucide-react';

export type ActiveView = 'map' | 'registry' | 'onboarding';

interface ViewTabsProps {
  activeView: ActiveView;
  onViewChange: (view: ActiveView) => void;
}

const tabs: { id: ActiveView; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'map', label: 'Blueprint Map', icon: Map },
  { id: 'registry', label: 'Connector Registry', icon: Package },
  { id: 'onboarding', label: 'Onboarding Pipeline', icon: GitBranch },
];

export default function ViewTabs({ activeView, onViewChange }: ViewTabsProps) {
  return (
    <div className="flex gap-1 mb-6 bg-slate-900/80 border border-slate-700 rounded-xl p-1.5">
      {tabs.map(tab => {
        const Icon = tab.icon;
        const isActive = activeView === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onViewChange(tab.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
              isActive
                ? 'bg-gradient-to-br from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/20'
                : 'text-gray-400 hover:text-gray-200 hover:bg-slate-800'
            }`}
          >
            <Icon className="w-4 h-4" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
