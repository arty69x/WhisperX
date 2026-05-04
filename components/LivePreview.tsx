/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect, useState, useRef } from 'react';
import { ArrowDownTrayIcon, PlusIcon, ViewColumnsIcon, DocumentIcon, CodeBracketIcon, XMarkIcon, ShareIcon, CommandLineIcon, SparklesIcon, CpuChipIcon } from '@heroicons/react/24/outline';
import { Creation } from './CreationHistory';
import Editor from '@monaco-editor/react';
import prettier from 'prettier/standalone';
import * as parserHtml from 'prettier/plugins/html';
import * as parserPostcss from 'prettier/plugins/postcss';
import * as parserBabel from 'prettier/plugins/babel';

interface LivePreviewProps {
  creation: Creation | null;
  isLoading: boolean;
  uploadProgress: number;
  isFocused: boolean;
  onReset: () => void;
  onUpdateCreation?: (html: string) => void;
}

// Add type definition for the global pdfjsLib
declare global {
  interface Window {
    pdfjsLib: any;
  }
}

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
);

const PdfRenderer = ({ dataUrl }: { dataUrl: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const renderPdf = async () => {
      if (!window.pdfjsLib) {
        setError("PDF library not initialized");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Load the document
        const loadingTask = window.pdfjsLib.getDocument(dataUrl);
        const pdf = await loadingTask.promise;
        
        // Get the first page
        const page = await pdf.getPage(1);
        
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        
        // Calculate scale to make it look good (High DPI)
        const viewport = page.getViewport({ scale: 2.0 });

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        await page.render(renderContext).promise;
        setLoading(false);
      } catch (err) {
        console.error("Error rendering PDF:", err);
        setError("Could not render PDF preview.");
        setLoading(false);
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
    const audioCtx = useRef<AudioContext | null>(null);

    const playAudioEffect = (type: 'click' | 'success' | 'invalid' | 'drag') => {
        if (!audioCtx.current) audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        const ctx = audioCtx.current;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        if (type === 'click') {
            osc.frequency.setValueAtTime(440, ctx.currentTime);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.1);
        } else if (type === 'success') {
            osc.frequency.setValueAtTime(600, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
        } else if (type === 'invalid') {
            osc.frequency.setValueAtTime(200, ctx.currentTime);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
        }
        
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
    };

    const [showCode, setShowCode] = useState(false);
    const [customCode, setCustomCode] = useState<string>('');
    const [history, setHistory] = useState<string[]>(['']);
    const [historyPtr, setHistoryPtr] = useState(0);
    const editorRef = useRef<any>(null);

    const updateCode = (newCode: string) => {
        setCustomCode(newCode);
        const newHistory = history.slice(0, historyPtr + 1);
        newHistory.push(newCode);
        setHistory(newHistory);
        setHistoryPtr(newHistory.length - 1);
    };

    const undo = () => {
        if (historyPtr > 0) {
            setHistoryPtr(historyPtr - 1);
            setCustomCode(history[historyPtr - 1]);
        }
    };
    
    const redo = () => {
        if (historyPtr < history.length - 1) {
            setHistoryPtr(historyPtr + 1);
            setCustomCode(history[historyPtr + 1]);
        }
    };

    // Visual Filter & Grid Debugger State
    const [filter, setFilter] = useState({ grayscale: 0, sepia: 0, brightness: 100, contrast: 100 });
    const [activePreset, setActivePreset] = useState<string | null>(null);
    const [showGrid, setShowGrid] = useState(false);
    const [debugOptions, setDebugOptions] = useState({ lines: false, outlines: false });
    const [isInspectorActive, setIsInspectorActive] = useState(false);
    const [selectedElement, setSelectedElement] = useState<any>(null);
    const [styleHistory, setStyleHistory] = useState<any[]>([]);
    
    // Add logic to toggle inspector ring
    useEffect(() => {
        const iframe = document.querySelector('iframe');
        if (iframe?.contentWindow) {
            iframe.contentWindow.postMessage({ type: 'SET_INSPECTOR_RING', id: selectedElement?.id }, '*');
        }
    }, [selectedElement]);
    const [filterPresets, setFilterPresets] = useState<Record<string, typeof filter>>({
        neon: { grayscale: 0, sepia: 0, brightness: 150, contrast: 120 },
        cyberpunk: { grayscale: 10, sepia: 50, brightness: 120, contrast: 150 },
        minimal: { grayscale: 100, sepia: 0, brightness: 100, contrast: 100 },
        glitch: { grayscale: 50, sepia: 20, brightness: 140, contrast: 200 },
        neon_glow: { grayscale: 0, sepia: 0, brightness: 180, contrast: 110 },
        retro_scanline: { grayscale: 30, sepia: 40, brightness: 110, contrast: 130 }
    });
    const [savedPresets, setSavedPresets] = useState<Record<string, typeof filter>>({});
    const [newPresetName, setNewPresetName] = useState('');

    useEffect(() => {
        const stored = localStorage.getItem('filterPresets');
        if (stored) setSavedPresets(JSON.parse(stored));
    }, []);

    const savePreset = () => {
        if (!newPresetName) return;
        const updated = { ...savedPresets, [newPresetName]: filter };
        setSavedPresets(updated);
        localStorage.setItem('filterPresets', JSON.stringify(updated));
        setNewPresetName('');
    };

    const loadPreset = (name: string) => {
        setFilter(savedPresets[name]);
        setActivePreset(name);
    };

    const deletePreset = (name: string) => {
        const updated = { ...savedPresets };
        delete updated[name];
        setSavedPresets(updated);
        localStorage.setItem('filterPresets', JSON.stringify(updated));
    };

    const copyStyles = () => {
        if (!selectedElement) return;
        const styleStr = Object.entries(selectedElement.styles).map(([k, v]) => `${k}: ${v}`).join(';\n');
        navigator.clipboard.writeText(styleStr);
    };

    const revertToOriginal = () => {
        if (styleHistory.length === 0) return;
        const last = styleHistory[styleHistory.length - 1];
        setSelectedElement({ ...selectedElement, styles: last });
        setStyleHistory(styleHistory.slice(0, -1));
    };
    useEffect(() => {
        const handleMessage = (e: MessageEvent) => {
            if (e.data.type === 'INSPECT_ELEMENT') {
                setSelectedElement(e.data.info);
            } else if (e.data.type === 'PLAY_AUDIO') {
                playAudioEffect(e.data.sound);
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    const updateElementStyle = (property: string, value: string) => {
        if (!selectedElement) return;
        const newStyles = { ...selectedElement.styles, [property]: value };
        setSelectedElement({ ...selectedElement, styles: newStyles });
        // Send message to iframe to update style
        const iframe = document.querySelector('iframe');
        if (iframe?.contentWindow) {
            iframe.contentWindow.postMessage({ type: 'UPDATE_STYLE', id: selectedElement.id, property, value }, '*');
        }
    };
    const processedHtml = React.useMemo(() => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(customCode, 'text/html');

        // Apply filters & debugging
        const style = document.createElement('style');
        style.textContent = `
            body { 
                filter: grayscale(${filter.grayscale}%) sepia(${filter.sepia}%) brightness(${filter.brightness}%) contrast(${filter.contrast}%); 
                transition: filter 0.3s ease;
                cursor: default;
            }
            button, a { cursor: pointer; transition: transform 0.2s, filter 0.2s; }
            button:hover, a:hover { transform: translateY(-2px); filter: brightness(1.1); }
            
            /* Animation */
            @keyframes bounce {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.05); }
            }
            .drop-confirmed { animation: bounce 0.3s ease; }

            .grid-debug-lines { outline: 1px solid blue !important; }
            .grid-debug-outline * { outline: 1px solid red !important; }
            .grid-item-selected { outline: 3px solid yellow !important; }
            .inspector-ring { outline: 3px solid #ff00ff !important; outline-offset: 2px; }
            
            /* Custom Cursor */
            .cursor-drag { cursor: grabbing !important; }
            
            /* Drag and Drop */
            .dragging { opacity: 0.5; border: 2px dashed #00d8ff; cursor: grabbing !important; transition: opacity 0.2s; }
            .drop-target { border: 2px solid #00d8ff; background: rgba(0, 216, 255, 0.1); transition: all 0.2s ease; transform: scale(1.02); }
            /* Cancel Indicator */
            .drag-invalid { cursor: no-drop !important; border-color: red !important; }
            
            /* Interactive State */
            .interactive-node { transition: all 0.2s ease; }
            .interactive-node:hover { transform: scale(1.01); box-shadow: 0 0 5px rgba(0,216,255,0.2); }
        `;
        doc.head.appendChild(style);

        // Inject interaction script
        const script = document.createElement('script');
        script.textContent = `
            const isInspectorActive = ${isInspectorActive.toString()};
            
            // Audio Feedback
            const playAudio = (sound) => window.parent.postMessage({ type: 'PLAY_AUDIO', sound }, '*');
            
            // Interaction Controller
            document.addEventListener('click', (e) => {
                if (!isInspectorActive) {
                    playAudio('click');
                    return;
                }
                e.preventDefault();
                e.stopPropagation();
                const el = e.target;
                const computed = window.getComputedStyle(el);
                const rect = el.getBoundingClientRect();
                const info = {
                    tagName: el.tagName,
                    id: el.id,
                    className: el.className,
                    styles: Object.fromEntries(Object.entries(computed).filter(([k,v]) => typeof v === 'string')),
                    html: el.outerHTML,
                    dimensions: { width: rect.width, height: rect.height, top: rect.top, left: rect.left }
                };
                window.parent.postMessage({ type: 'INSPECT_ELEMENT', info }, '*');
            }, true);

            // Style Updates and Inspector Ring
            window.addEventListener('message', (e) => {
                if (e.data.type === 'UPDATE_STYLE') {
                    const el = document.getElementById(e.data.id);
                    if (el) el.style[e.data.property] = e.data.value;
                } else if (e.data.type === 'SET_INSPECTOR_RING') {
                    document.querySelectorAll('.inspector-ring').forEach(el => el.classList.remove('inspector-ring'));
                    if (e.data.id) document.getElementById(e.data.id)?.classList.add('inspector-ring');
                }
            });

            // Drag and Drop Reordering
            let draggedNode = null;
            document.addEventListener('dragstart', (e) => {
                draggedNode = e.target;
                e.target.classList.add('dragging');
                document.body.classList.add('cursor-drag');
                playAudio('drag');
            });
            document.addEventListener('dragend', (e) => {
                e.target.classList.remove('dragging');
                document.body.classList.remove('cursor-drag');
            });
            document.addEventListener('dragover', (e) => {
                e.preventDefault();
                const target = e.target.closest('*');
                if (isInspectorActive) return;
                
                if (target && target !== draggedNode && target.parentElement === draggedNode.parentElement) {
                    target.classList.add('drop-target');
                    target.classList.remove('drag-invalid');
                } else if (target) {
                    target.classList.add('drag-invalid');
                }
            });
            document.addEventListener('dragleave', (e) => { 
                e.target.classList.remove('drop-target');
                e.target.classList.remove('drag-invalid');
            });
            document.addEventListener('drop', (e) => {
                e.preventDefault();
                if (isInspectorActive) return;
                const target = e.target.closest('*');
                if (target && target !== draggedNode && target.parentElement === draggedNode.parentElement) {
                    const parent = draggedNode.parentElement;
                    const children = Array.from(parent.children);
                    const draggedIndex = children.indexOf(draggedNode);
                    const targetIndex = children.indexOf(target);
                    if (draggedIndex < targetIndex) {
                        parent.insertBefore(draggedNode, target.nextSibling);
                    } else {
                        parent.insertBefore(draggedNode, target);
                    }
                    target.classList.remove('drop-target');
                    target.classList.add('drop-confirmed');
                    setTimeout(() => target.classList.remove('drop-confirmed'), 300);
                    playAudio('success');
                } else {
                    playAudio('invalid');
                }
            });

            // Atomic Node Interaction
            document.querySelectorAll('*').forEach(el => {
                if (el.children.length === 0) el.classList.add('interactive-node');
                el.addEventListener('click', (e) => {
                    if (isInspectorActive) return;
                    e.stopPropagation();
                    el.classList.toggle('grid-item-selected');
                });
            });
        `;
        doc.body.appendChild(script);

        if (showGrid) {
            if (debugOptions.lines) doc.body.classList.add('grid-debug-lines');
            if (debugOptions.outlines) doc.body.classList.add('grid-debug-outline');
        } else {
            doc.body.classList.remove('grid-debug-lines');
            doc.body.classList.remove('grid-debug-outline');
        }

        return doc.documentElement.outerHTML;
    }, [customCode, filter, showGrid, debugOptions]);
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

    const handleBeautify = async () => {
        try {
            const formatted = await prettier.format(customCode, {
                parser: 'html',
                plugins: [parserHtml, parserPostcss, parserBabel],
            });
            // Simulate AI semantic analysis
            const suggestions = `\n<!-- \n  [AI Semantic Styling Suggestions]:\n  - Consider replacing generic <div> containers with semantic <section> or <article> tags.\n  - Apply semantic aria-labels to interactive regions.\n-->\n`;
            setCustomCode(formatted + suggestions);
        } catch (e) {
            console.error('Error formatting code:', e);
            alert('Failed to beautify code. Please check for syntax errors.');
        }
    };

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
                     <button onClick={handleZoomOut} className="px-3 py-1 hover:bg-zinc-100 border-r border-zinc-200" aria-label="Zoom Out">-</button>
                     <button onClick={handleZoomReset} className="px-3 py-1 hover:bg-zinc-100 border-r border-zinc-200 text-xs font-mono" aria-label="Reset Zoom">{Math.round(zoom * 100)}%</button>
                     <button onClick={handleZoomIn} className="px-3 py-1 hover:bg-zinc-100" aria-label="Zoom In">+</button>
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
                        <div className="w-full h-full text-left flex flex-col" onMouseDown={(e) => e.stopPropagation()}>
                            <div className="bg-bg3 p-2 flex justify-end border-b border-bdr">
                                <button 
                                    onClick={handleBeautify}
                                    aria-label="Beautify code in editor"
                                    className="flex items-center space-x-2 text-xs text-acc hover:text-white px-3 py-1 bg-bg2 rounded border border-acc/30 hover:border-acc transition-all"
                                >
                                    <SparklesIcon className="w-3 h-3" />
                                    <span>Beautify Code</span>
                                </button>
                            </div>
                            <Editor
                                height="100%"
                                defaultLanguage="html"
                                theme="vs-dark"
                                value={customCode}
                                onChange={(value) => updateCode(value || '')}
                                onMount={(editor) => { editorRef.current = editor; }}
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
                            srcDoc={processedHtml}
                            className="w-full h-full pointer-events-auto"
                            style={{ pointerEvents: isDragging ? 'none' : 'auto' }}
                            sandbox="allow-scripts allow-forms allow-popups allow-modals allow-same-origin"
                        />
                    )}
                 </div>
                 {/* Filter & Debug Toolbar */}
                 {!showCode && (
                    <div className="absolute bottom-4 left-4 bg-bg2/90 backdrop-blur p-3 rounded-xl border border-bdr flex flex-col gap-3 z-10 text-xs">
                        <div className="flex flex-col gap-2">
                             <span className="text-muted">Filters</span>
                             <div className="flex gap-2">
                                <input type="range" min="0" max="100" value={filter.grayscale} onChange={(e) => setFilter({...filter, grayscale: parseInt(e.target.value)})} aria-label="Grayscale filter" className="w-20" />
                                <input type="range" min="0" max="100" value={filter.sepia} onChange={(e) => setFilter({...filter, sepia: parseInt(e.target.value)})} aria-label="Sepia filter" className="w-20" />
                             </div>
                             <div className="flex gap-1 flex-wrap">
                                 {Object.keys(filterPresets).map(p => (
                                     <button key={p} onClick={() => { setFilter(filterPresets[p]); setActivePreset(p); }} aria-label={`Apply ${p} preset`} className={`px-2 py-0.5 rounded text-[10px] ${activePreset === p ? 'bg-acc text-bg' : 'bg-bg'}`}>{p}</button>
                                 ))}
                                 {Object.keys(savedPresets).map(p => (
                                     <div key={p} className="flex items-center gap-0.5">
                                         <button onClick={() => loadPreset(p)} aria-label={`Apply saved ${p} preset`} className={`px-2 py-0.5 rounded text-[10px] border border-acc ${activePreset === p ? 'bg-acc text-bg' : 'bg-bg'}`}>{p}</button>
                                         <button onClick={() => deletePreset(p)} aria-label={`Delete ${p} preset`} className="text-[10px] text-red-500">x</button>
                                     </div>
                                 ))}
                             </div>
                             <div className="flex gap-1 mt-1">
                                 <input type="text" placeholder="Preset name" value={newPresetName} onChange={(e) => setNewPresetName(e.target.value)} className="bg-bg text-[10px] px-1 w-full rounded" />
                                 <button onClick={savePreset} className="text-[10px] bg-acc text-bg px-2 rounded">Save</button>
                             </div>
                        </div>
                        <div className="flex flex-col gap-2">
                            <span className="text-muted">Grid Debug</span>
                            <div className="flex gap-2">
                                <button onClick={() => setShowGrid(!showGrid)} aria-label="Toggle grid" className={`px-2 py-1 rounded ${showGrid ? 'bg-acc text-bg' : 'bg-bg'}`}>Toggle Grid</button>
                                <button onClick={() => setDebugOptions({...debugOptions, lines: !debugOptions.lines})} aria-label="Toggle grid lines" className={`px-2 py-1 rounded ${debugOptions.lines ? 'bg-acc text-bg' : 'bg-bg'}`}>Lines</button>
                                <button onClick={() => setDebugOptions({...debugOptions, outlines: !debugOptions.outlines})} aria-label="Toggle element outlines" className={`px-2 py-1 rounded ${debugOptions.outlines ? 'bg-acc text-bg' : 'bg-bg'}`}>Outlines</button>
                            </div>
                        </div>
                        <div className="flex flex-col gap-2">
                            <span className="text-muted">Inspector</span>
                            <button onClick={() => setIsInspectorActive(!isInspectorActive)} aria-label="Toggle Inspector" className={`px-2 py-1 rounded ${isInspectorActive ? 'bg-acc text-bg' : 'bg-bg'}`}>
                                {isInspectorActive ? 'Inspector Active' : 'Activate Inspector'}
                            </button>
                        </div>
                    </div>
                 )}
                 {/* Element Inspector Sidebar */}
                 {isInspectorActive && selectedElement && (
                    <div className="absolute top-0 right-0 w-80 h-full bg-bg2/95 border-l border-bdr p-4 overflow-y-auto text-xs z-20">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="font-bold">Inspector</h4>
                            <button onClick={() => setSelectedElement(null)} className="text-muted hover:text-white">Close</button>
                        </div>
                        <div className="space-y-4">
                            <div className="bg-bg p-2 rounded">
                                <p className="text-muted">Element: &lt;{selectedElement.tagName.toLowerCase()}&gt;</p>
                                <p className="text-muted">ID: {selectedElement.id || 'none'}</p>
                                <p className="text-muted">Dimensions: {selectedElement.dimensions?.width.toFixed(0)}x{selectedElement.dimensions?.height.toFixed(0)}</p>
                                <p className="text-muted">Position: {selectedElement.dimensions?.top.toFixed(0)} top, {selectedElement.dimensions?.left.toFixed(0)} left</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={copyStyles} className="bg-acc text-bg text-[10px] px-2 py-1 rounded">Copy Styles</button>
                                <button onClick={revertToOriginal} className="bg-bg3 text-white text-[10px] px-2 py-1 rounded">Revert Last</button>
                            </div>
                            <div className="space-y-1">
                                <p className="font-bold text-muted">Computed Styles</p>
                                <div className="h-40 overflow-y-auto bg-bg p-2 rounded font-mono text-[10px]">
                                    {Object.entries(selectedElement.styles).map(([key, value]) => (
                                        <div key={key} className="flex justify-between">
                                            <span className="text-acc">{key}:</span>
                                            <input 
                                                className="bg-transparent text-right text-white w-20"
                                                value={value as string}
                                                onChange={(e) => {
                                                    setStyleHistory([...styleHistory, selectedElement.styles]);
                                                    updateElementStyle(key, e.target.value);
                                                }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                 )}
                 {/* Undo/Redo Toolbar */}
                 {showCode && (
                     <div className="absolute bottom-4 right-4 flex gap-2">
                         <button onClick={undo} aria-label="Undo" className="p-2 bg-bg3 rounded">Undo</button>
                         <button onClick={redo} aria-label="Redo" className="p-2 bg-bg3 rounded">Redo</button>
                     </div>
                 )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};
