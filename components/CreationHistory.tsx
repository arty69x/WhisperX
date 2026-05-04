/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useMemo } from 'react';
import { ClockIcon, ArrowRightIcon, DocumentIcon, PhotoIcon, ChevronUpDownIcon } from '@heroicons/react/24/outline';

export interface Creation {
  id: string;
  name: string;
  html: string;
  originalImage?: string; // Base64 data URL
  timestamp: Date;
}

interface CreationHistoryProps {
  history: Creation[];
  activeCreation?: Creation | null;
  onSelect: (creation: Creation) => void;
  onExportAll: (history: Creation[]) => void;
}

export const CreationHistory: React.FC<CreationHistoryProps> = ({ history, activeCreation, onSelect, onExportAll }) => {
  const [sortBy, setSortBy] = useState<'name' | 'newest' | 'oldest'>('newest');
  const [searchTerm, setSearchTerm] = useState('');

  const sortedHistory = useMemo(() => {
    let result = [...history];
    if (searchTerm) {
      result = result.filter(item => 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.html && item.html.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    return result.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'newest') return b.timestamp.getTime() - a.timestamp.getTime();
      if (sortBy === 'oldest') return a.timestamp.getTime() - b.timestamp.getTime();
      return 0;
    });
  }, [history, sortBy, searchTerm]);

  if (history.length === 0) return null;

  return (
    <div className="w-full animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="flex items-center space-x-3 mb-3 px-2 justify-between">
        <div className="flex items-center space-x-3">
            <ClockIcon className="w-4 h-4 text-dim" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-dim">Archive</h2>
            <div className="h-px w-20 bg-bdr"></div>
        </div>
        <div className="flex items-center space-x-3">
            <input 
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="text-xs bg-bg2 text-txt border border-bdr rounded-md px-3 py-1.5 placeholder-muted focus:border-acc focus:ring-1 focus:ring-acc/50 focus:outline-none transition-all duration-300"
            />
            <div className="relative">
                <select 
                    value={sortBy} 
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="text-xs bg-bg2 text-muted border border-bdr rounded-md px-3 py-1.5 appearance-none cursor-pointer hover:text-white hover:border-bdr transition-all duration-300 pr-8"
                >
                    <option value="newest">Newest</option>
                    <option value="oldest">Oldest</option>
                    <option value="name">Name</option>
                </select>
                <ChevronUpDownIcon className="w-3 h-3 text-muted absolute right-1 top-1.5 pointer-events-none" />
            </div>
            {activeCreation && (
              <button 
                onClick={() => {
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText(activeCreation.html)
                      .then(() => alert('HTML copied to clipboard!'))
                      .catch((err) => console.error('Failed to copy html: ', err));
                  } else {
                    alert('Clipboard access not available');
                  }
                }} 
                className="text-[10px] text-muted hover:text-white transition-colors uppercase tracking-wider whitespace-nowrap"
              >
                Copy HTML
              </button>
            )}
            <button onClick={() => onExportAll(history)} className="text-[10px] text-muted hover:text-white transition-colors uppercase tracking-wider whitespace-nowrap">Export All</button>
        </div>
      </div>
      
      {/* Horizontal Scroll Container for Compact Layout */}
      <div className="flex overflow-x-auto space-x-4 pb-2 px-2 scrollbar-hide">
        {sortedHistory.map((item) => {
          const isPdf = item.originalImage?.startsWith('data:application/pdf');
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item)}
              aria-label={`Restore creation: ${item.name}`}
              className="group flex-shrink-0 relative flex flex-col text-left w-44 h-28 bg-bg2/60 backdrop-blur-md hover:bg-bg2 border border-bdr hover:border-acc/70 hover:-translate-y-1 hover:shadow-[0_8px_20px_rgba(0,242,255,0.15)] rounded-2xl transition-all duration-300 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 skeleton"></div>
              <div className="p-4 flex flex-col h-full relative z-10">
                <div className="flex items-start justify-between mb-2">
                  <div className="p-1.5 bg-bg3/80 rounded-lg group-hover:bg-bg3 transition-colors border border-bdr shadow-inner">
                      {isPdf ? (
                          <DocumentIcon className="w-4 h-4 text-muted" />
                      ) : item.originalImage ? (
                          <PhotoIcon className="w-4 h-4 text-muted" />
                      ) : (
                          <DocumentIcon className="w-4 h-4 text-muted" />
                      )}
                  </div>
                  <span className="text-[10px] font-mono text-dim group-hover:text-muted">
                    {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                
                <div className="mt-auto">
                  <h3 className="text-sm font-medium text-txt group-hover:text-white truncate">
                    {item.name}
                  </h3>
                  <div className="flex items-center space-x-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[10px] text-acc">Restore</span>
                    <ArrowRightIcon className="w-3 h-3 text-acc" />
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
            display: none;
        }
        .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};