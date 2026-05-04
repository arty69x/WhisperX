/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect, useState, useRef } from 'react';
import { ArrowDownTrayIcon, PlusIcon, ViewColumnsIcon, DocumentIcon, CodeBracketIcon, XMarkIcon, ShareIcon, CommandLineIcon } from '@heroicons/react/24/outline';
import { Creation } from './CreationHistory';
import Editor from '@monaco-editor/react';

interface LivePreviewProps {
  creation: Creation | null;
  isLoading: boolean;
  uploadProgress: number;
  isFocused: boolean;
  onReset: () => void;
  onUpdateCreation?: (html: string) => void;
}

declare global { interface Window { pdfjsLib?: any; } }

const LoadingStep = ({ text, active, completed }: { text: string, active: boolean, completed: boolean }) => (
    <div className={`flex items-center space-x-3 transition-all duration-500 ${active || completed ? 'opacity-100 translate-x-0' : 'opacity-30 translate-x-4'}`}>
        <div className={`w-4 h-4 flex items-center justify-center ${completed ? 'text-grn' : active ? 'text-acc' : 'text-dim'}`}>
            {completed ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            ) : active ? (
                <div className="w-1.5 h-1.5 bg-acc rounded-full animate-pulse"></div>
            ) : (
                <div className="w-1.5 h-1.5 bg-dim rounded-full"></div>
            )}
        </div>
        <span className={`font-mono text-xs tracking-wide uppercase ${active ? 'text-txt' : completed ? 'text-muted line-through' : 'text-dim'}`}>{text}</span>
    </div>
    <span className="font-mono text-xs uppercase tracking-wide text-zinc-400">{text}</span>
  </div>
);

const PdfRenderer = ({ dataUrl }: { dataUrl: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const renderPdf = async () => {
      if (!window.pdfjsLib || !canvasRef.current) return;
      try {
        const pdf = await window.pdfjsLib.getDocument(dataUrl).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const context = canvas.getContext('2d');
        if (!context) return;
        await page.render({ canvasContext: context, viewport }).promise;
      } catch {
        setError('Could not render PDF preview.');
      }
    };
    renderPdf();
  }, [dataUrl]);

  if (error) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-zinc-500 p-6 text-center">
            <DocumentIcon className="w-12 h-12 mb-3 opacity-50 text-red-400" />
            <p className="text-sm mb-2 text-red-400/80">{error}</p>
        </div>
    );
  }

  return (
    <div className="relative w-full h-full flex items-center justify-center">
        {loading && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
                <div className="w-6 h-6 border-2 border-acc/30 border-t-acc rounded-full animate-spin"></div>
            </div>
        )}
        <canvas 
            ref={canvasRef} 
            className={`max-w-full max-h-full object-contain shadow-xl border border-zinc-800/50 rounded transition-opacity duration-500 ${loading ? 'opacity-0' : 'opacity-100'}`}
        />
    </div>
  );
};

export const LivePreview: React.FC<LivePreviewProps> = ({ creation, isLoading, uploadProgress, isFocused, onReset, onUpdateCreation }) => {
    const [loadingStep, setLoadingStep] = useState(0);
    const [showSplitView, setShowSplitView] = useState(false);
    const [showCode, setShowCode] = useState(false);
    const [customCode, setCustomCode] = useState<string>('');
    
    // Zoom and pan state
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef({ x: 0, y: 0 });

    const handleZoomIn = () => setZoom(z => Math.min(z + 0.25, 3));
    const handleZoomOut = () => setZoom(z => Math.max(z - 0.25, 0.25));
    const handleZoomReset = () => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (zoom <= 1) return; // Only pan if zoomed in
        setIsDragging(true);
        dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        setPan({
            x: e.clientX - dragStartRef.current.x,
            y: e.clientY - dragStartRef.current.y
        });
    };

    const handleMouseUp = () => setIsDragging(false);

    // Handle loading animation steps
    useEffect(() => {
        if (isLoading) {
            setLoadingStep(0);
            const interval = setInterval(() => {
                setLoadingStep(prev => (prev < 3 ? prev + 1 : prev));
            }, 2000); 
            return () => clearInterval(interval);
        } else {
            setLoadingStep(0);
        }
    }, [isLoading]);

    // Default to Split View when a new creation with an image is loaded
    useEffect(() => {
        if (creation?.originalImage) {
            setShowSplitView(true);
        } else {
            setShowSplitView(false);
        }
        if (creation?.html) {
            setCustomCode(creation.html);
        }
        setShowCode(false);
    }, [creation]);

    const handleDownloadAsHtml = () => {
        const codeToDownload = customCode || creation?.html;
        if (!codeToDownload || !creation) return;
        const blob = new Blob([codeToDownload], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${creation.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleExport = () => {
        if (!creation) return;
        // make sure to export the modified code
        const exportData = {
          ...creation,
          html: customCode || creation.html
        };
        const dataStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${creation.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_artifact.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

  return (
    <div
      className={`
        fixed z-40 flex flex-col
        rounded-2xl overflow-hidden border border-bdr bg-bg/95 backdrop-blur-3xl shadow-[0_0_80px_rgba(0,0,0,0.8)]
        transition-all duration-700 cubic-bezier(0.2, 0.8, 0.2, 1)
        ${isFocused
          ? 'inset-2 md:inset-6 opacity-100 scale-100'
          : 'top-1/2 left-1/2 w-[90%] h-[60%] -translate-x-1/2 -translate-y-1/2 opacity-0 scale-95 pointer-events-none'
        }
      `}
    >
      {/* Minimal Technical Header */}
      <div className="bg-bg2/80 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-bdr shrink-0">
        {/* Left: Controls */}
        <div className="flex items-center space-x-3 w-32">
           <div className="flex space-x-2 group/controls">
                <button 
                  onClick={onReset}
                  className="w-3 h-3 rounded-full bg-dim group-hover/controls:bg-red-500 hover:!bg-red-600 transition-colors flex items-center justify-center focus:outline-none"
                  title="Close Preview"
                >
                  <XMarkIcon className="w-2 h-2 text-black opacity-0 group-hover/controls:opacity-100" />
                </button>
                <div className="w-3 h-3 rounded-full bg-dim group-hover/controls:bg-amb transition-colors"></div>
                <div className="w-3 h-3 rounded-full bg-dim group-hover/controls:bg-grn transition-colors"></div>
           </div>
        </div>
        
        {/* Center: Title */}
        <div className="flex items-center space-x-2 text-muted">
            <CodeBracketIcon className="w-3 h-3" />
            <span className="text-[11px] font-mono uppercase tracking-wider">
                {isLoading ? 'System Processing...' : creation ? creation.name : 'Preview Mode'}
            </span>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center justify-end space-x-1 w-auto">
            {!isLoading && creation && (
                <>
                    <button 
                        onClick={() => {
                            if (showCode && customCode !== creation.html) {
                                onUpdateCreation?.(customCode);
                            }
                            setShowCode(!showCode);
                        }}
                        title={showCode ? "Show Preview" : "Show Code Editor"}
                        className={`p-1.5 rounded-lg transition-all ${showCode ? 'bg-bg3 text-txt border border-bdr' : 'text-dim hover:text-txt hover:bg-bg3/50 border border-transparent'}`}
                    >
                        <CommandLineIcon className="w-4 h-4" />
                    </button>
                    {creation.originalImage && (
                         <button 
                            onClick={() => setShowSplitView(!showSplitView)}
                            title={showSplitView ? "Show App Only" : "Compare with Original"}
                            className={`p-1.5 rounded-lg transition-all ${showSplitView ? 'bg-bg3 text-txt border border-bdr' : 'text-dim hover:text-txt hover:bg-bg3/50 border border-transparent'}`}
                        >
                            <ViewColumnsIcon className="w-4 h-4" />
                        </button>
                    )}

                    <button 
                        onClick={() => {
                            if (creation) {
                                const url = `${window.location.origin}/#creation/${creation.id}`;
                                navigator.clipboard.writeText(url);
                                alert(`Link copied to clipboard!\n\n${url}\n\n(Note: works locally or via a persistent backend)`);
                            }
                        }}
                        title="Share Creation"
                        className="text-dim hover:text-acc transition-all p-1.5 rounded-lg border border-transparent hover:border-acc/20 hover:bg-acc/10"
                    >
                        <ShareIcon className="w-4 h-4" />
                    </button>

                    <button 
                        onClick={handleDownloadAsHtml}
                        title="Download as HTML"
                        className="text-dim hover:text-txt transition-all p-1.5 rounded-lg border border-transparent hover:border-bdr hover:bg-bg3/50"
                    >
                        <DocumentIcon className="w-4 h-4" />
                    </button>

                    <button 
                        onClick={handleExport}
                        title="Export Artifact (JSON)"
                        className="text-dim hover:text-txt transition-all p-1.5 rounded-lg border border-transparent hover:border-bdr hover:bg-bg3/50"
                    >
                        <ArrowDownTrayIcon className="w-4 h-4" />
                    </button>

                    <button 
                        onClick={onReset}
                        title="New Upload"
                        className="ml-2 flex items-center space-x-1.5 text-xs font-bold bg-white text-bg hover:bg-acc hover:text-bg hover:shadow-[0_0_15px_rgba(0,216,255,0.4)] px-4 py-1.5 rounded-lg transition-all duration-300 transform hover:scale-105"
                    >
                        <PlusIcon className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline tracking-wide">New</span>
                    </button>
                </>
            )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative w-full flex-1 bg-bg flex overflow-hidden group/preview">
        {/* Holographic Inner Glow overlay */}
        <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_100px_rgba(0,216,255,0.05)] z-20"></div>
        {isLoading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 w-full">
             {/* Technical Loading State */}
             <div className="w-full max-w-md space-y-8 relative z-10">
                <div className="flex flex-col items-center">
                    <div className="relative w-16 h-16 mb-6">
                        <div className="absolute inset-0 border-[3px] border-acc border-t-transparent rounded-full animate-spin"></div>
                        <div className="absolute inset-2 border-[3px] border-pur border-b-transparent rounded-full animate-[spin_2s_linear_infinite_reverse]"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <CpuChipIcon className="w-6 h-6 text-txt animate-pulse" />
                        </div>
                    </div>
                    <h3 className="text-xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-acc via-pur to-acc bg-[length:200%_auto] animate-hologram">
                        {uploadProgress > 0 && uploadProgress < 100 
                            ? `Uplink established... ${uploadProgress}%` 
                            : 'Synthesizing Architecture'}
                    </h3>
                    <p className="text-dim text-sm mt-2 font-mono">Parsing visual heuristics</p>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-1.5 bg-bdr rounded-full overflow-hidden shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)]">
                    <div 
                        className="h-full bg-gradient-to-r from-acc to-pur transition-all duration-300 relative shadow-[0_0_10px_rgba(0,216,255,0.5)]" 
                        style={{ width: uploadProgress > 0 ? `${uploadProgress}%` : '42%' }}
                    >
                        <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem] animate-[progress_1s_linear_infinite]"></div>
                    </div>
                </div>

                 {/* Terminal Steps */}
                 <div className="border border-bdr bg-bg2/50 backdrop-blur-sm shadow-[inset_0_0_20px_rgba(30,48,72,0.3)] rounded-xl p-5 space-y-4 font-mono text-sm relative overflow-hidden">
                     <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-acc/30 to-transparent"></div>
                     <LoadingStep text="Extracting layout matrices" active={loadingStep === 0} completed={loadingStep > 0} />
                     <LoadingStep text="Resolving component hierarchy" active={loadingStep === 1} completed={loadingStep > 1} />
                     <LoadingStep text="Injecting interactive logic" active={loadingStep === 2} completed={loadingStep > 2} />
                     <LoadingStep text="Synthesizing final bundle" active={loadingStep === 3} completed={loadingStep > 3} />
                 </div>
             </div>
             
             {/* Decorative loading background */}
             <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-acc/5 rounded-full blur-[100px] animate-pulse"></div>
             </div>
          </div>
        ) : creation?.html ? (
          <>
            {/* Split View: Left Panel (Original Image) */}
            {showSplitView && creation.originalImage && (
                <div className="w-full md:w-1/2 h-1/2 md:h-full border-b md:border-b-0 md:border-r border-bdr bg-bg2 relative flex flex-col shrink-0">
                    <div className="absolute top-4 left-4 z-10 bg-bg/80 backdrop-blur text-muted text-[10px] font-mono uppercase px-2 py-1 rounded border border-bdr">
                        Input Source
                    </div>
                    <div className="w-full h-full p-6 flex items-center justify-center overflow-hidden">
                        {creation.originalImage.startsWith('data:application/pdf') ? (
                            <PdfRenderer dataUrl={creation.originalImage} />
                        ) : (
                            <img 
                                src={creation.originalImage} 
                                alt="Original Input" 
                                className="max-w-full max-h-full object-contain shadow-xl border border-bdr rounded"
                            />
                        )}
                    </div>
                </div>
            )}

            {/* App Preview Panel */}
            <div className={`relative h-full bg-white transition-all duration-500 overflow-hidden ${showSplitView && creation.originalImage ? 'w-full md:w-1/2 h-1/2 md:h-full border-t md:border-t-0 border-bdr' : 'w-full'} shadow-[0_0_50px_rgba(0,216,255,0.05)] hover:shadow-[0_0_80px_rgba(124,77,255,0.1)]`}>
                 <div className="absolute top-4 right-4 z-10 flex bg-white/90 backdrop-blur shadow-md rounded-md border border-zinc-200 overflow-hidden text-zinc-700">
                     <button onClick={handleZoomOut} className="px-3 py-1 hover:bg-zinc-100 border-r border-zinc-200" title="Zoom Out">-</button>
                     <button onClick={handleZoomReset} className="px-3 py-1 hover:bg-zinc-100 border-r border-zinc-200 text-xs font-mono" title="Reset Zoom">{Math.round(zoom * 100)}%</button>
                     <button onClick={handleZoomIn} className="px-3 py-1 hover:bg-zinc-100" title="Zoom In">+</button>
                 </div>
                 
                 <div 
                    className={`w-full h-full transform-gpu ${zoom > 1 ? 'cursor-grab active:cursor-grabbing' : ''}`}
                    style={{
                        transform: showCode ? 'none' : `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                        transformOrigin: 'center center',
                        transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)'
                    }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                 >
                    {showCode ? (
                        <div className="w-full h-full text-left" onMouseDown={(e) => e.stopPropagation()}>
                            <Editor
                                height="100%"
                                defaultLanguage="html"
                                theme="vs-dark"
                                value={customCode}
                                onChange={(value) => setCustomCode(value || '')}
                                options={{
                                    minimap: { enabled: false },
                                    fontSize: 14,
                                    wordWrap: 'on',
                                    padding: { top: 16 }
                                }}
                            />
                        </div>
                    ) : (
                        <iframe
                            title="WhisperX Live Preview"
                            srcDoc={customCode}
                            className="w-full h-full pointer-events-auto"
                            style={{ pointerEvents: isDragging ? 'none' : 'auto' }}
                            sandbox="allow-scripts allow-forms allow-popups allow-modals allow-same-origin"
                        />
                    )}
                 </div>
            </div>
          </div>
        </> : null}
      </div>
    </div>
  );
};
