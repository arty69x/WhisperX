/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useRef } from 'react';
import { Hero } from './components/Hero';
import { InputArea } from './components/InputArea';
import { LivePreview } from './components/LivePreview';
import { CreationHistory, Creation } from './components/CreationHistory';
import { Onboarding } from './components/Onboarding';
import { bringToLife } from './services/gemini';
import { ArrowUpTrayIcon, PlusIcon } from '@heroicons/react/24/solid';
import { SunIcon, MoonIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import { playSound } from './lib/sounds';

const App: React.FC = () => {
  const [activeCreation, setActiveCreation] = useState<Creation | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [history, setHistory] = useState<Creation[]>([]);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
     const saved = localStorage.getItem('whisperx_theme') as 'light' | 'dark' | null;
     if (saved) {
        setTheme(saved);
        document.body.className = saved === 'light' ? 'light-theme' : 'dark-theme';
     } else {
        document.body.className = 'dark-theme';
     }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.body.className = newTheme === 'light' ? 'light-theme' : 'dark-theme';
    localStorage.setItem('whisperx_theme', newTheme);
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('whisperx_onboarding_completed');
    if (!hasSeenOnboarding) {
        setShowOnboarding(true);
    }
  }, []);

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
      if (window.location.hash.startsWith('#shared/')) {
        try {
            const payload = window.location.hash.slice(8);
            const base64Str = decodeURIComponent(payload); // Base64 strings can have url-encoded chars from the browser
            const encodedJson = atob(base64Str);
            const jsonStr = decodeURIComponent(encodedJson);
            const sharedCreation = JSON.parse(jsonStr);
            if (sharedCreation && sharedCreation.html) {
                // Ensure it has an ID, or generate a new one so it saves
                if (!sharedCreation.id) sharedCreation.id = Date.now().toString(36);
                sharedCreation.name = `${sharedCreation.name || 'Shared'} (Imported)`;
                
                setActiveCreation(sharedCreation);
                setHistory(prev => {
                    const exists = prev.find(p => p.id === sharedCreation.id);
                    if (!exists) {
                        const newHistory = [sharedCreation, ...prev];
                        localStorage.setItem('whisperx_history', JSON.stringify(newHistory));
                        return newHistory;
                    }
                    return prev;
                });
            }
        } catch (e) {
            console.error("Failed to parse shared creation", e);
        }
      } else if (window.location.hash.startsWith('#creation/')) {
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

    } catch (error: any) {
      console.error({ message: "Failed to generate", error, response: error?.message });
      setErrorDetails(error?.message || "Something went wrong while bringing your file to life. Please try again.");
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
                setErrorDetails("Invalid creation file format. It must contain 'name' and 'html' fields.");
            }
        } catch (err: any) {
            console.error({ message: "Import error", error: err, response: err?.message });
            setErrorDetails("Failed to import creation: " + (err.message || "Invalid JSON"));
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

  const handleNewBlankPage = () => {
    playSound('click');
    const newCreation: Creation = {
        id: crypto.randomUUID(),
        name: 'Blank Project',
        html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Blank Project</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { font-family: sans-serif; background: #ffffff; color: #111111; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    </style>
</head>
<body>
    <div class="text-center p-8 border border-gray-200 rounded-lg shadow-sm">
        <h1 class="text-2xl font-bold mb-4">New Project</h1>
        <p class="text-gray-500">Start building your next idea.</p>
    </div>
</body>
</html>`,
        timestamp: new Date()
    };
    setActiveCreation(newCreation);
    setHistory(prev => [newCreation, ...prev]);
    window.history.pushState(null, '', `${window.location.pathname}#creation/${newCreation.id}`);
  };

  const isFocused = !!activeCreation || isGenerating;

  return (
    <div className="min-h-[100dvh] bg-bg text-txt font-sans selection:bg-acc/30 overflow-y-auto overflow-x-hidden relative flex flex-col animate-[fadeIn_1s_ease-out]">
      
      {/* Header Utilities */}
      <div className="fixed top-4 right-4 z-30 flex items-center gap-3">
         <button 
           onClick={() => setShowOnboarding(true)}
           className="w-10 h-10 rounded-full bg-bg3/80 border border-bdr text-dim hover:text-txt hover:bg-bg2 hover:border-acc flex items-center justify-center transition-all backdrop-blur-md"
           title="Onboarding Tutorial"
         >
           <QuestionMarkCircleIcon className="w-5 h-5" />
         </button>
         <button 
           onClick={toggleTheme}
           className="w-10 h-10 rounded-full bg-bg3/80 border border-bdr text-dim hover:text-txt hover:bg-bg2 hover:border-acc flex items-center justify-center transition-all backdrop-blur-md"
           title="Toggle Theme"
         >
           {theme === 'dark' ? <SunIcon className="w-5 h-5 text-acc" /> : <MoonIcon className="w-5 h-5 text-pur" />}
         </button>
      </div>

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
      
      {/* Background Orbs with Parallax */}
      <div 
        className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-acc/10 blur-[120px] pointer-events-none mix-blend-screen animate-[float_10s_ease-in-out_infinite]" 
        style={{ transform: `translateY(${scrollY * 0.15}px)` }}
      />
      <div 
        className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-pur/10 blur-[120px] pointer-events-none mix-blend-screen animate-[float_12s_ease-in-out_infinite_reverse]" 
        style={{ transform: `translateY(${scrollY * -0.1}px)` }}
      />
      <div 
        className="fixed top-[40%] left-[60%] w-[30%] h-[30%] rounded-full bg-grn/5 blur-[120px] pointer-events-none mix-blend-screen animate-[float_8s_ease-in-out_infinite]" 
        style={{ transform: `translateY(${scrollY * 0.05}px)` }}
      />
      <div className="fixed inset-0 bg-dot-grid pointer-events-none z-0" />
      
      {/* Onboarding Modal */}
      {showOnboarding && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-bg2 border border-bdr p-8 rounded-2xl shadow-2xl max-w-md w-full text-center space-y-6">
                  <h2 className="text-2xl font-bold text-acc tracking-wider font-mono uppercase">Welcome to WhisperX</h2>
                  <p className="text-sm text-dim">
                      WhisperX brings your ideas to life. Upload sketches, photos of whiteboards, or describe what you want, and watch it turn into a fully functional interactive web app in seconds.
                  </p>
                  <div className="text-left bg-bg/50 p-4 rounded-xl border border-bdr space-y-3">
                      <div className="flex items-start space-x-3 text-xs">
                          <span className="text-acc flex-shrink-0">1.</span>
                          <span><strong>Prompt or Upload:</strong> Describe your idea or upload a visual reference.</span>
                      </div>
                      <div className="flex items-start space-x-3 text-xs">
                          <span className="text-acc flex-shrink-0">2.</span>
                          <span><strong>Live Preview:</strong> View the generated HTML/js/css app instantly.</span>
                      </div>
                      <div className="flex items-start space-x-3 text-xs">
                          <span className="text-acc flex-shrink-0">3.</span>
                          <span><strong>Code Editor & AI Refinement:</strong> Edit code directly or ask the AI to refine selections for you.</span>
                      </div>
                  </div>
                  <button 
                      onClick={() => {
                          localStorage.setItem('whisperx_onboarding_completed', 'true');
                          setShowOnboarding(false);
                      }}
                      className="w-full btn-primary"
                  >
                      Get Started
                  </button>
              </div>
          </div>
      )}

      {/* Error Modal */}
      {errorDetails && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-bg2 border border-red-500/50 p-8 rounded-2xl shadow-[0_0_40px_rgba(255,0,0,0.1)] max-w-lg w-full space-y-4">
                  <h3 className="text-xl font-bold text-red-400 flex items-center gap-2">
                       Error Occurred
                  </h3>
                  <div className="bg-red-500/10 p-4 rounded border border-red-500/20 text-red-300 font-mono text-xs overflow-auto max-h-48 whitespace-pre-wrap">
                      {errorDetails}
                  </div>
                  <div className="flex justify-end pt-2">
                      <button 
                          onClick={() => setErrorDetails(null)}
                          className="px-6 py-2 bg-bg hover:bg-bg3 border border-bdr rounded-lg text-sm transition-colors hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                      >
                          Dismiss
                      </button>
                  </div>
              </div>
          </div>
      )}

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
                <CreationHistory history={history} activeCreation={activeCreation} onSelect={handleSelectCreation} onExportAll={handleExportAll} />
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

      {/* Floating Actions (Bottom Right) */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end space-y-3">
        <button 
            onClick={handleNewBlankPage}
            className="flex items-center justify-center w-12 h-12 bg-acc/10 backdrop-blur-md border border-acc/30 rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.3)] text-acc hover:border-acc/80 hover:bg-acc/20 transition-all duration-300 group"
            title="Start Blank Project"
        >
            <PlusIcon className="w-6 h-6 transition-transform duration-300 group-hover:scale-110" />
            <span className="absolute right-14 whitespace-nowrap bg-bg2 px-2 py-1 text-xs rounded border border-bdr opacity-0 group-hover:opacity-100 transition-opacity">Blank Project</span>
        </button>

        <div className="relative group/import">
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
      {showOnboarding && (
        <Onboarding onClose={() => {
            setShowOnboarding(false);
            localStorage.setItem('whisperx_onboarding_completed', 'true');
        }} />
      )}
    </div>
  );
};

export default App;