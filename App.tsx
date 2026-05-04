/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useRef } from 'react';
import { Hero } from './components/Hero';
import { InputArea } from './components/InputArea';
import { LivePreview } from './components/LivePreview';
import { CreationHistory, Creation } from './components/CreationHistory';
import { bringToLife } from './services/gemini';
import { ArrowUpTrayIcon } from '@heroicons/react/24/solid';
import { playSound } from './lib/sounds';

const App: React.FC = () => {
  const [activeCreation, setActiveCreation] = useState<Creation | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [history, setHistory] = useState<Creation[]>([]);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Load history from local storage or fetch examples on mount
  useEffect(() => {
    const initHistory = async () => {
      const saved = localStorage.getItem('gemini_app_history');
      let loadedHistory: Creation[] = [];

      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          loadedHistory = parsed.map((item: any) => ({
              ...item,
              timestamp: new Date(item.timestamp)
          }));
        } catch (e) {
          console.error("Failed to load history", e);
        }
      }

      const loadExamples = async () => {
        try {
           const exampleUrls: string[] = [
           ];

           const examples = await Promise.all(exampleUrls.map(async (url) => {
               const res = await fetch(url);
               if (!res.ok) throw new Error('Load failed');
               const data = await res.json();
               return {
                   ...data,
                   timestamp: new Date(data.timestamp || Date.now()),
                   id: data.id || crypto.randomUUID()
               };
           }));
           
           return examples;
        } catch (e) {
            console.error("Failed to load examples", e);
            return [];
        }
      };

      if (loadedHistory.length === 0) {
        loadedHistory = await loadExamples();
      }

      setHistory(loadedHistory);

      // Handle deep linking from URL Hash
      if (window.location.hash.startsWith('#creation/')) {
        const id = window.location.hash.split('/')[1];
        const deepLinkedCreation = loadedHistory.find(c => c.id === id);
        if (deepLinkedCreation) {
            setActiveCreation(deepLinkedCreation);
        } else {
            // Might be an example not in local storage yet
            const examples = await loadExamples();
            const exampleMatch = examples.find(c => c.id === id);
            if (exampleMatch) {
                setActiveCreation(exampleMatch);
                setHistory(prev => {
                    if (!prev.find(p => p.id === exampleMatch.id)) {
                        return [exampleMatch, ...prev];
                    }
                    return prev;
                });
            }
        }
      }
    };

    initHistory();
  }, []);

  // Save history when it changes
  useEffect(() => {
    if (history.length > 0) {
        try {
            localStorage.setItem('gemini_app_history', JSON.stringify(history));
        } catch (e) {
            console.warn("Local storage full or error saving history", e);
        }
    }
  }, [history]);

  const [uploadProgress, setUploadProgress] = useState(0);

  // Helper to convert file to base64 with progress
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onprogress = (event) => {
        if (event.lengthComputable) {
          setUploadProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
      
      reader.readAsDataURL(file);
      reader.onload = () => {
        setUploadProgress(100);
        if (typeof reader.result === 'string') {
          // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        } else {
          reject(new Error('Failed to convert file to base64'));
        }
      };
      reader.onerror = (error) => {
        setUploadProgress(0);
        reject(error);
      };
    });
  };

  const handleGenerate = async (promptText: string, file?: File) => {
    setIsGenerating(true);
    setUploadProgress(0);
    playSound('generate');
    // Clear active creation to show loading state
    setActiveCreation(null);
    window.history.pushState(null, '', window.location.pathname);

    try {
      let imageBase64: string | undefined;
      let mimeType: string | undefined;

      if (file) {
        imageBase64 = await fileToBase64(file);
        mimeType = file.type.toLowerCase();
      }
      
      setUploadProgress(0); // Reset for generation phase if needed

      const html = await bringToLife(promptText, imageBase64, mimeType);
      
      if (html) {
        playSound('success');
        const newCreation: Creation = {
          id: crypto.randomUUID(),
          name: file ? file.name : 'New Creation',
          html: html,
          // Store the full data URL for easy display
          originalImage: imageBase64 && mimeType ? `data:${mimeType};base64,${imageBase64}` : undefined,
          timestamp: new Date(),
        };
        setActiveCreation(newCreation);
        setHistory(prev => [newCreation, ...prev]);
        window.history.pushState(null, '', `${window.location.pathname}#creation/${newCreation.id}`);
      }

    } catch (error) {
      console.error("Failed to generate:", error);
      alert("Something went wrong while bringing your file to life. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReset = () => {
    playSound('hover');
    setActiveCreation(null);
    setIsGenerating(false);
    window.history.pushState(null, '', window.location.pathname);
  };

  const handleSelectCreation = (creation: Creation) => {
    playSound('click');
    setActiveCreation(creation);
    window.history.pushState(null, '', `${window.location.pathname}#creation/${creation.id}`);
  };

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const json = event.target?.result as string;
            const parsed = JSON.parse(json);
            
            // Basic validation
            if (parsed.html && parsed.name) {
                const importedCreation: Creation = {
                    ...parsed,
                    timestamp: new Date(parsed.timestamp || Date.now()),
                    id: parsed.id || crypto.randomUUID()
                };
                
                // Add to history if not already there (by ID check)
                setHistory(prev => {
                    const exists = prev.some(c => c.id === importedCreation.id);
                    return exists ? prev : [importedCreation, ...prev];
                });

                // Set as active immediately
                setActiveCreation(importedCreation);
            } else {
                alert("Invalid creation file format.");
            }
        } catch (err) {
            console.error("Import error", err);
            alert("Failed to import creation.");
        }
        // Reset input
        if (importInputRef.current) importInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleExportAll = (history: Creation[]) => {
      const dataStr = JSON.stringify(history, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `creations_archive_${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  const handleUpdateCreation = (updatedHtml: string) => {
      if (!activeCreation) return;
      const updatedCreation: Creation = { ...activeCreation, html: updatedHtml };
      setActiveCreation(updatedCreation);
      setHistory(prev => prev.map(c => c.id === updatedCreation.id ? updatedCreation : c));
  };

  const isFocused = !!activeCreation || isGenerating;

  return (
    <div className="h-[100dvh] bg-bg text-txt font-sans selection:bg-acc/30 overflow-y-auto overflow-x-hidden relative flex flex-col animate-[fadeIn_1s_ease-out]">
      {/* Animated Vector Background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.15]"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00d8ff" stopOpacity="0.2" />
              <stop offset="50%" stopColor="#7c4dff" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#00e676" stopOpacity="0.2" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          <path
            fill="none"
            stroke="url(#grad1)"
            strokeWidth="0.5"
            filter="url(#glow)"
            className="animate-[wave_15s_ease-in-out_infinite_alternate]"
            d="M 0,50 C 20,60 40,40 60,50 C 80,60 100,40 100,50"
          />
          <path
            fill="none"
            stroke="url(#grad1)"
            strokeWidth="0.3"
            filter="url(#glow)"
            className="animate-[wave_20s_ease-in-out_infinite_alternate-reverse]"
            d="M 0,30 C 30,50 70,10 100,30"
          />
          <path
            fill="none"
            stroke="url(#grad1)"
            strokeWidth="0.4"
            filter="url(#glow)"
            className="animate-[wave_25s_ease-in-out_infinite_alternate]"
            d="M 0,70 C 40,80 60,60 100,80"
          />
        </svg>
      </div>
      
      {/* Background Orbs */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-acc/10 blur-[120px] pointer-events-none mix-blend-screen animate-[float_10s_ease-in-out_infinite]" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-pur/10 blur-[120px] pointer-events-none mix-blend-screen animate-[float_12s_ease-in-out_infinite_reverse]" />
      <div className="fixed top-[40%] left-[60%] w-[30%] h-[30%] rounded-full bg-grn/5 blur-[120px] pointer-events-none mix-blend-screen animate-[float_8s_ease-in-out_infinite]" />
      <div className="fixed inset-0 bg-dot-grid pointer-events-none z-0" />
      
      {/* Centered Content Container */}
      <div 
        className={`
          min-h-full flex flex-col w-full max-w-7xl mx-auto px-4 sm:px-6 relative z-10 
          transition-all duration-700 cubic-bezier(0.4, 0, 0.2, 1)
          ${isFocused 
            ? 'opacity-0 scale-95 blur-sm pointer-events-none h-[100dvh] overflow-hidden' 
            : 'opacity-100 scale-100 blur-0'
          }
        `}
      >
        {/* Main Vertical Centering Wrapper */}
        <div className="flex-1 flex flex-col justify-center items-center w-full py-12 md:py-20">
          
          {/* 1. Hero Section */}
          <div className="w-full mb-8 md:mb-16">
              <Hero />
          </div>

          {/* 2. Input Section */}
          <div className="w-full flex justify-center mb-8">
              <InputArea onGenerate={handleGenerate} isGenerating={isGenerating} disabled={isFocused} />
          </div>

        </div>
        
        {/* 3. History Section & Footer - Stays at bottom */}
        <div className="flex-shrink-0 pb-6 w-full mt-auto flex flex-col items-center gap-6">
            <div className="w-full px-2 md:px-0">
                <CreationHistory history={history} onSelect={handleSelectCreation} onExportAll={handleExportAll} />
            </div>
            
            <a 
              href="https://x.com/ammaar" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-dim hover:text-muted text-xs font-mono transition-colors pb-2"
            >
              Created by @ammaar
            </a>
        </div>
      </div>

      {/* Live Preview - Always mounted for smooth transition */}
      <LivePreview
        creation={activeCreation}
        isLoading={isGenerating}
        uploadProgress={isGenerating ? uploadProgress : 0}
        isFocused={isFocused}
        onReset={handleReset}
        onUpdateCreation={handleUpdateCreation}
      />

      {/* Subtle Import Button (Bottom Right) */}
      <div className="fixed bottom-4 right-4 z-50">
        <button 
            onClick={handleImportClick}
            className="flex items-center space-x-2 p-3 bg-bg2/40 backdrop-blur-md border border-bdr rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.5)] text-dim hover:text-txt hover:border-acc/50 hover:bg-bg2/80 transition-all duration-300 opacity-80 hover:opacity-100 group"
            title="Import Artifact"
        >
            <span className="text-xs font-semibold uppercase tracking-wider hidden sm:inline ml-2 transition-all duration-300 w-0 overflow-hidden group-hover:w-auto group-hover:mr-2">Upload Artifact</span>
            <ArrowUpTrayIcon className="w-5 h-5 transition-transform duration-300 group-hover:-translate-y-1 group-hover:text-acc" />
        </button>
        <input 
            type="file" 
            ref={importInputRef} 
            onChange={handleImportFile} 
            accept=".json" 
            className="hidden" 
        />
      </div>
    </div>
  );
};

export default App;