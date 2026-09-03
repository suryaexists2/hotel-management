'use client';
import React from 'react';

interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export function Tabs({ tabs, activeTab, onTabChange }: TabsProps) {
  return (
    <div className="flex gap-1 border-b border-neutral-800">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === tab.id
              ? 'border-brand-500 text-brand-400'
              : 'border-transparent text-neutral-500 hover:text-neutral-300'
          }`}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs">{tab.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
