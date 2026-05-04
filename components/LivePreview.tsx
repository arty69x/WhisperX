/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect, useState, useRef } from 'react';
import { ArrowDownTrayIcon, PlusIcon, ViewColumnsIcon, DocumentIcon, CodeBracketIcon, XMarkIcon, ShareIcon, CommandLineIcon, SparklesIcon, CpuChipIcon, ClipboardDocumentIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import { Creation } from './CreationHistory';
import Editor from '@monaco-editor/react';
import prettier from 'prettier/standalone';
import * as parserHtml from 'prettier/plugins/html';
import * as parserPostcss from 'prettier/plugins/postcss';
import * as parserBabel from 'prettier/plugins/babel';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid, LineChart, Line } from 'recharts';
import { refineCode, refineSnippet, explainCode, analyzeElement } from '../services/gemini';

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
                <span className="loader-spinner"></span>
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

    const [showLibrary, setShowLibrary] = useState(false);
    const [showAnalytics, setShowAnalytics] = useState(false);
    const [theme, setTheme] = useState<'cyberpunk' | 'holographic' | 'minimal'>('cyberpunk');
    const themeClasses = {
        cyberpunk: 'bg-[#050507] text-[#f1f5f9] border-[#00f2ff]',
        holographic: 'bg-[#1a0b2e] text-[#f0f0f0] border-[#9d4edd]',
        minimal: 'bg-[#ffffff] text-[#111111] border-[#e0e0e0]'
    };
    const viewportSize = '100%';
    const setViewportSize = (s: any) => {};
    const [messages, setMessages] = useState<{role: 'user' | 'assistant' | 'system', text: string}[]>([
        {role: 'assistant', text: "Welcome to WhisperX v1.0. How can I assist you with your project?"}
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isChatLoading, setIsChatLoading] = useState(false);
    const [isContextMode, setIsContextMode] = useState(false);
    const [customCode, setCustomCode] = useState<string>('');
    const [showCode, setShowCode] = useState(false);
    const editorRef = useRef<any>(null);

    const [animationSpeed, setAnimationSpeed] = useState('0.5');
    const [animationDelay, setAnimationDelay] = useState('0');

    const handleGenerateComponent = (comp: string) => {
        const desc = prompt(`Describe the ${comp} you want to generate:`);
        if (!desc) return;
        
        const codeToRefine = customCode || creation?.html || '';
        const userMsg = `I want to add a ${comp} to this page. Visual style: ${desc}. Please add it to the best appropriate container.`;
        setMessages(prev => [...prev, {role: 'user', text: `Generate a ${comp}: ${desc}`}]);
        setIsChatLoading(true);
        refineCode(userMsg, codeToRefine).then(newCode => {
            applyCodeChange(newCode);
            if (onUpdateCreation) onUpdateCreation(newCode);
            setMessages(prev => [...prev, { role: 'assistant', text: `${comp} successfully generated and added.` }]);
        }).catch(err => {
            setMessages(prev => [...prev, { role: 'system', text: err.message || `Failed to generate ${comp}.` }]);
        }).finally(() => {
            setIsChatLoading(false);
        });
    };

    const applyAnimation = (anim: string) => {
        const target = selectedElement?.id ? `id="${selectedElement.id}"` : 'the main container or body';
        const cssClassMap: Record<string, string> = {
            'fade-in': `animation: fadeIn ${animationSpeed}s ease-in ${animationDelay}s forwards; @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`,
            'slide-up': `animation: slideUp ${animationSpeed}s ease-out ${animationDelay}s forwards; @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`,
            'pulse': `animation: pulse ${animationSpeed}s infinite ${animationDelay}s; @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }`,
            'spin': `animation: spin ${animationSpeed}s linear infinite ${animationDelay}s; @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`,
            'bounce': `animation: bounce ${animationSpeed}s infinite ${animationDelay}s; @keyframes bounce { 0%, 100% { transform: translateY(-25%); animation-timing-function: cubic-bezier(0.8,0,1,1); } 50% { transform: none; animation-timing-function: cubic-bezier(0,0,0.2,1); } }`
        };

        const rule = cssClassMap[anim];
        if (rule) {
             const userMsg = `Apply the following animation CSS exactly as written to the element with ${target}:\n${rule}`;
             setIsChatLoading(true);
             refineCode(userMsg, customCode || creation?.html || '').then(newCode => {
                 applyCodeChange(newCode);
                 if (onUpdateCreation) onUpdateCreation(newCode);
                 setMessages(prev => [...prev, { role: 'assistant', text: `Animation applied.` }]);
             }).finally(() => {
                 setIsChatLoading(false);
             });
        }
    };

    const applyHoverEffect = (hover: string) => {
        const target = selectedElement?.id ? `id="${selectedElement.id}"` : 'all interactive elements (buttons, links, cards)';
        const cssClassMap: Record<string, string> = {
            'scale-up': `transition: transform ${animationSpeed}s ease ${animationDelay}s; &:hover { transform: scale(1.05); }`,
            'shadow-pop': `transition: box-shadow ${animationSpeed}s ease ${animationDelay}s; &:hover { box-shadow: 0 10px 20px rgba(0,216,255,0.3); }`,
            'border-glow': `transition: border-color ${animationSpeed}s ease ${animationDelay}s; border: 1px solid transparent; &:hover { border-color: #00f2ff; box-shadow: 0 0 10px rgba(0,242,255,0.5); }`
        };

        const rule = cssClassMap[hover];
        if (rule) {
             const userMsg = `Apply the following hover effect CSS to the element with ${target}:\n${rule}\nUse Tailwind classes if possible, otherwise inject CSS.`;
             setIsChatLoading(true);
             refineCode(userMsg, customCode || creation?.html || '').then(newCode => {
                 applyCodeChange(newCode);
                 if (onUpdateCreation) onUpdateCreation(newCode);
                 setMessages(prev => [...prev, { role: 'assistant', text: `Hover effect applied.` }]);
             }).finally(() => {
                 setIsChatLoading(false);
             });
        }
    };

    const applyTheme = (t: string) => {
        setTheme(t as any);
        let customColors = '';
        if (t === 'custom') {
            const colors = prompt('Describe your custom color palette (e.g., "Warm autumn colors with orange and brown" or "#ff0000 and #000000"):');
            if (!colors) return;
            customColors = colors;
        }

        const themePrompt = t === 'cyberpunk' ? 'Neon blue, pink, dark background' : 
                            t === 'holographic' ? 'Purple, cyan, glassmorphism, metallic' : 
                            t === 'minimal' ? 'White, grey, minimalist borders, high contrast text' : 
                            customColors;

        const userMsg = `Apply the ${t !== 'custom' ? t : 'following'} color palette theme to the current UI layout. Use appropriate background, foreground, border, and accent colors to match the theme: ${themePrompt}`;
        setIsChatLoading(true);
        refineCode(userMsg, customCode || creation?.html || '').then(newCode => {
            applyCodeChange(newCode);
            if (onUpdateCreation) onUpdateCreation(newCode);
            setMessages(prev => [...prev, { role: 'assistant', text: `Applied ${t} theme palette.` }]);
        }).finally(() => {
            setIsChatLoading(false);
        });
    };

    const applyCodeChange = (newCode: string) => {
        if (editorRef.current) {
            const editor = editorRef.current;
            const model = editor.getModel();
            if (model && model.getValue() !== newCode) {
                editor.pushUndoStop();
                editor.executeEdits('ai-update', [{
                    range: model.getFullModelRange(),
                    text: newCode
                }]);
                editor.pushUndoStop();
            }
        } else {
            setCustomCode(newCode);
        }
    };

    const updateCode = (newCode: string) => {
        setCustomCode(newCode);
    };


    const codeAnalytics = React.useMemo(() => {
        const code = customCode || creation?.html || '';
        const stylesLen = (code.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || []).join('').length;
        const scriptsLen = (code.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || []).join('').length;
        const htmlLen = code.length - stylesLen - scriptsLen;
        
        const tags = (code.match(/<[a-z0-9]+/gi) || []).length;
        // Simulated metrics
        const performanceScore = Math.max(0, 100 - (tags * 0.1) - (code.length * 0.0001));
        const accessibilityScore = Math.max(0, 100 - (code.match(/<img([^>]*?)>/gi)?.filter(img => !img.includes('alt')).length || 0) * 5);
        const bestPracticesScore = 95 - (code.match(/console\./gi)?.length || 0) * 2;
        const seoScore = code.includes('<title>') ? 100 : 80;
        
        const loadTime = ((code.length / 1024) * 0.05).toFixed(2); // simulated

        return {
            breakdown: [
                { name: 'HTML', value: htmlLen > 0 ? htmlLen : 0, fill: '#00f2ff' },
                { name: 'CSS', value: stylesLen > 0 ? stylesLen : 0, fill: '#9d4edd' },
                { name: 'JS', value: scriptsLen > 0 ? scriptsLen : 0, fill: '#f59e0b' }
            ],
            tags,
            totalSize: code.length,
            performanceScore: Math.round(performanceScore),
            accessibilityScore: Math.round(accessibilityScore),
            bestPracticesScore,
            seoScore,
            loadTime
        };
    }, [customCode, creation?.html]);

    // Visual Filter & Grid Debugger State
    const [filter, setFilter] = useState({ grayscale: 0, sepia: 0, brightness: 100, contrast: 100 });
    const [activePreset, setActivePreset] = useState<string | null>(null);
    const [showGrid, setShowGrid] = useState(false);
    const [debugOptions, setDebugOptions] = useState({ lines: false, outlines: false });
    const [isInspectorActive, setIsInspectorActive] = useState(false);
    const [selectedElement, setSelectedElement] = useState<any>(null);
    const [styleHistory, setStyleHistory] = useState<any[]>([]);
    const [stylePresets, setStylePresets] = useState<Record<string, any>>({
        'Neon Glow': { color: '#00d8ff', textShadow: '0 0 10px #00d8ff', backgroundColor: 'transparent' },
        'Cyberpunk': { color: '#ff003c', backgroundColor: '#fbee0f', textShadow: '2px 2px 0px #00f0ff' },
        'Minimal': { color: '#333333', backgroundColor: '#ffffff', border: '1px solid #e5e5e5' }
    });

    useEffect(() => {
        const _s = localStorage.getItem('stylePresets');
        if (_s) {
            try { setStylePresets(JSON.parse(_s)); } catch (e) { }
        }
    }, []);

    // Reset history and update inspector ring when element changes
    useEffect(() => {
        setStyleHistory([]);
        setStyleRedoHistory([]);
        const iframe = document.querySelector('iframe');
        if (iframe?.contentWindow) {
            iframe.contentWindow.postMessage({ type: 'SET_INSPECTOR_RING', id: selectedElement?.id }, '*');
        }
    }, [selectedElement]);

    const saveElementPreset = () => {
        if (!newPresetName || !selectedElement) return;
        const updated = { ...stylePresets, [newPresetName]: selectedElement.styles };
        setStylePresets(updated);
        localStorage.setItem('stylePresets', JSON.stringify(updated));
        setNewPresetName('');
    };

    const loadElementPreset = (name: string) => {
        if (!selectedElement) return;
        const newStyles = { ...selectedElement.styles, ...stylePresets[name] };
        setStyleHistory([...styleHistory, selectedElement.styles]);
        setSelectedElement({ ...selectedElement, styles: newStyles });
        
        const iframe = document.querySelector('iframe');
        if (iframe?.contentWindow) {
            Object.entries(stylePresets[name] as Record<string, string>).forEach(([prop, val]) => {
                iframe.contentWindow!.postMessage({ type: 'UPDATE_STYLE', id: selectedElement.id, property: prop, value: val }, '*');
            });
        }
    };
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

    const [styleRedoHistory, setStyleRedoHistory] = useState<any[]>([]);

    // Undo Style
    const undoStyle = () => {
        if (styleHistory.length === 0) return;
        const previous = styleHistory[styleHistory.length - 1];
        setStyleRedoHistory([...styleRedoHistory, selectedElement.styles]);
        setSelectedElement({ ...selectedElement, styles: previous });
        setStyleHistory(styleHistory.slice(0, -1));
        
        const iframe = document.querySelector('iframe');
        if (iframe?.contentWindow) {
            Object.entries(previous as Record<string, string>).forEach(([prop, val]) => {
                iframe.contentWindow!.postMessage({ type: 'UPDATE_STYLE', id: selectedElement.id, property: prop, value: val }, '*');
            });
            Object.keys(selectedElement.styles as Record<string, string>).forEach(prop => {
                if (!(prop in previous)) {
                    iframe.contentWindow!.postMessage({ type: 'UPDATE_STYLE', id: selectedElement.id, property: prop, value: '' }, '*');
                }
            });
        }
    };

    // Redo Style
    const redoStyle = () => {
        if (styleRedoHistory.length === 0) return;
        const next = styleRedoHistory[styleRedoHistory.length - 1];
        setStyleHistory([...styleHistory, selectedElement.styles]);
        setSelectedElement({ ...selectedElement, styles: next });
        setStyleRedoHistory(styleRedoHistory.slice(0, -1));
        
        const iframe = document.querySelector('iframe');
        if (iframe?.contentWindow) {
            Object.entries(next as Record<string, string>).forEach(([prop, val]) => {
                iframe.contentWindow!.postMessage({ type: 'UPDATE_STYLE', id: selectedElement.id, property: prop, value: val }, '*');
            });
            Object.keys(selectedElement.styles as Record<string, string>).forEach(prop => {
                if (!(prop in next)) {
                    iframe.contentWindow!.postMessage({ type: 'UPDATE_STYLE', id: selectedElement.id, property: prop, value: '' }, '*');
                }
            });
        }
    };
    useEffect(() => {
        const handleMessage = (e: MessageEvent) => {
            if (e.data.type === 'INSPECT_ELEMENT') {
                setSelectedElement(e.data.info);
            } else if (e.data.type === 'PLAY_AUDIO') {
                playAudioEffect(e.data.sound);
            } else if (e.data.type === 'ELEMENT_RESIZED') {
                const { id, classes, width, height } = e.data;
                const target = id ? `id="${id}"` : classes ? `classes="${classes}"` : 'the selected element';
                const userMsg = `Set width to ${width} and height to ${height} for the element with ${target}. Use Tailwind CSS classes if possible or inline styles.`;
                setIsChatLoading(true);
                refineCode(userMsg, customCode || creation?.html || '').then(newCode => {
                    applyCodeChange(newCode);
                    if (onUpdateCreation) onUpdateCreation(newCode);
                    setMessages(prev => [...prev, { role: 'assistant', text: `Resized element to ${width} x ${height}.` }]);
                }).finally(() => {
                    setIsChatLoading(false);
                });
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
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&family=JetBrains+Mono:wght@400;600&display=swap');
            
            :root {
                --acc: #00f2ff;
                --acc-glow: 0 0 15px rgba(0, 242, 255, 0.5);
            }
            
            body { 
                font-family: 'Inter', sans-serif;
                background-color: #050507;
                color: #f1f5f9;
                transition: all 0.3s ease;
            }
            
            /* Interactive Holographic elements */
            .interactive-node { 
                transition: all 0.4s cubic-bezier(0.19, 1, 0.22, 1); 
                cursor: pointer;
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 8px;
            }
            .interactive-node:hover { 
                transform: translateY(-2px) scale(1.01); 
                filter: brightness(1.2);
                animation: subtle-pulse-glow 2s infinite ease-in-out;
            }
            
            /* Subtle Pulsating Glow for Interactive Nodes */
            @keyframes subtle-pulse-glow {
                0%, 100% { box-shadow: 0 0 3px var(--acc), 0 0 8px rgba(0, 216, 255, 0.4); border-color: rgba(0, 216, 255, 0.6); }
                50% { box-shadow: 0 0 6px var(--acc), 0 0 15px rgba(0, 216, 255, 0.6); border-color: rgba(0, 216, 255, 0.9); }
            }
            
            /* Pulsating Neon Glow */
            @keyframes neon-glow {
                0%, 100% { box-shadow: 0 0 5px var(--acc), 0 0 10px var(--acc); border-color: var(--acc); }
                50% { box-shadow: 0 0 15px var(--acc), 0 0 25px var(--acc); border-color: white; }
            }
            .pulsating-glow {
                animation: neon-glow 2s infinite ease-in-out;
            }
            
            /* Enhanced Holographic Shimmer */
            @keyframes holographic-shimmer {
                0% { background-position: -200% 0; opacity: 0.5; }
                50% { opacity: 0.8; }
                100% { background-position: 200% 0; opacity: 0.5; }
            }
            .skeleton {
                background: linear-gradient(90deg, #1e293b 0%, var(--acc) 50%, #1e293b 100%);
                background-size: 200% 100%;
                animation: holographic-shimmer 2s infinite linear;
                border-radius: 8px;
            }
            
            /* Inspector Visual Feedback */
            .inspector-ring {
                outline: 2px dashed var(--acc) !important;
                outline-offset: 4px !important;
                box-shadow: 0 0 10px rgba(0, 242, 255, 0.5) !important;
                background-color: rgba(0, 242, 255, 0.1) !important;
                transition: outline-offset 0.2s, box-shadow 0.2s;
            }
            
            .grid-item-selected {
                outline: 2px solid white !important;
                outline-offset: 2px !important;
            }
            
            /* Advanced Card/Control Styles */
            .whisperx-card {
                border: 1px solid rgba(0, 242, 255, 0.3);
                background: linear-gradient(135deg, rgba(15, 23, 42, 0.8), rgba(0, 0, 0, 0.9));
                backdrop-filter: blur(20px);
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
                transition: all 0.3s ease;
                border-radius: 16px;
            }

            /* Drag & Drop Visuals */
            .dragging {
                opacity: 0.5;
                transform: scale(0.95);
                box-shadow: 0 0 20px rgba(0, 242, 255, 0.6);
            }
            .drop-target {
                position: relative;
            }
            .drop-target::before {
                content: '';
                position: absolute;
                inset: -2px;
                border: 2px dashed var(--acc);
                border-radius: inherit;
                z-index: 100;
                pointer-events: none;
                animation: pointer-pulse 1.5s infinite;
            }
            @keyframes pointer-pulse {
                0% { opacity: 0.5; transform: scale(1); }
                50% { opacity: 1; transform: scale(1.02); }
                100% { opacity: 0.5; transform: scale(1); }
            }
            .drop-confirmed {
                animation: flash-success 0.5s ease-out;
            }
            @keyframes flash-success {
                0% { box-shadow: inset 0 0 30px rgba(0, 255, 0, 0.6); }
                100% { box-shadow: inset 0 0 0 transparent; }
            }
            .drag-invalid {
                opacity: 0.8;
                filter: grayscale(1);
            }
            .drag-invalid::before {
                content: '';
                position: absolute;
                inset: -2px;
                border: 2px dashed red;
                border-radius: inherit;
                z-index: 100;
                pointer-events: none;
            }
        `;
        doc.head.appendChild(style);

        // Inject advanced components into DOM
        const controlsContainer = document.createElement('div');
        controlsContainer.className = 'p-6 space-y-6';
        controlsContainer.innerHTML = `
            <div class="whisperx-card p-6 interactive-node" aria-label="Interactive Controls Area" role="region">
                <h3 class="text-acc font-bold mb-4">Physics Interactive Engine</h3>
                <div class="flex flex-wrap gap-4 items-center">
                    <button class="interactive-node px-6 py-3 text-acc hover:border-white transition-all bg-bg3/50 rounded-xl shadow-[0_0_15px_rgba(0,216,255,0.2)]" aria-label="Trigger Bounce Action" role="button">
                        Bounce Action
                    </button>
                    <input type="range" class="interactive-node min-w-[200px]" aria-label="Adjust Intensity Slider" aria-valuemin="0" aria-valuemax="100" />
                    <input type="text" class="interactive-node px-4 py-2 bg-black/40 border border-bdr rounded-lg text-txt" placeholder="Enter custom value..." aria-label="Custom Value Input" />
                    <div class="interactive-node flex gap-2 p-2 bg-black/40 border border-bdr rounded-lg" role="group" aria-label="Option Selection">
                        <label class="flex items-center gap-2 cursor-pointer text-sm">
                            <input type="checkbox" class="accent-acc" aria-label="Enable Feature X" /> Feature X
                        </label>
                        <label class="flex items-center gap-2 cursor-pointer text-sm">
                            <input type="radio" name="opt" class="accent-acc" aria-label="Option A" /> Opt A
                        </label>
                        <label class="flex items-center gap-2 cursor-pointer text-sm">
                            <input type="radio" name="opt" class="accent-acc" aria-label="Option B" /> Opt B
                        </label>
                    </div>
                </div>

                <div class="mt-8 relative">
                    <h3 class="text-pur font-bold mb-4">Drop Zone Test</h3>
                    <div class="w-full min-h-[100px] border border-dashed border-bdr rounded-xl p-6 drop-target flex items-center justify-center bg-bg/50 neon-border hover:border-pur transition-colors" aria-label="Drop Target Zone">
                         <button class="interactive-node px-8 py-3 bg-pur/20 text-pur border border-pur/50 rounded-full font-bold tracking-widest shadow-[0_0_10px_rgba(157,78,221,0.5)] hover:shadow-[0_0_20px_rgba(157,78,221,0.8)] hover:bg-pur/40 transform hover:scale-105 active:scale-95 transition-all text-xs uppercase" aria-label="Distinct Holographic Button">
                             Initiate Sequence
                         </button>
                    </div>
                </div>
                
                <div class="mt-8 relative">
                    <h3 class="text-acc font-bold mb-4 flex items-center justify-between">
                        <span>Data Visualization (Interactive Force Graph)</span>
                        <div class="text-xs text-dim font-normal flex gap-2">
                            <button id="d3-regen" class="px-3 py-1.5 bg-bg2 rounded border border-bdr hover:text-white hover:border-acc transition-colors">Randomize Data</button>
                        </div>
                    </h3>
                    <div id="d3-chart-container" class="w-full h-64 bg-black/40 border border-bdr rounded-xl p-4 interactive-node relative overflow-hidden" aria-label="Interactive Scatter Plot Data" role="figure">
                    </div>
                </div>
            </div>
        `;
        doc.body.prepend(controlsContainer);

        // Inject D3.js and chart logic
        const d3Script = document.createElement('script');
        d3Script.src = "https://d3js.org/d3.v7.min.js";
        doc.head.appendChild(d3Script);

        const d3Logic = document.createElement('script');
        d3Logic.textContent = `
            function initD3() {
                if (typeof d3 === "undefined") {
                    setTimeout(initD3, 100);
                    return;
                }
                
                const container = document.getElementById('d3-chart-container');
                if (!container) return;
                
                // Clear existing
                container.innerHTML = '';
                
                // Generate nodes and links for force-directed graph
                let nodes = Array.from({length: 35}, (d, i) => ({
                    id: i,
                    r: Math.random() * 6 + 4,
                    c: Math.random() > 0.5 ? '#00f2ff' : '#9d4edd'
                }));
                
                let links = [];
                for (let i = 0; i < 45; i++) {
                    links.push({
                        source: Math.floor(Math.random() * nodes.length),
                        target: Math.floor(Math.random() * nodes.length)
                    });
                }
                
                const width = container.clientWidth - 32;
                const height = container.clientHeight - 32;

                const svg = d3.select('#d3-chart-container')
                    .append('svg')
                    .attr('width', '100%')
                    .attr('height', '100%')
                    .attr('viewBox', \`0 0 \${width} \${height}\`)
                    .style('overflow', 'visible');

                const glowFilter = svg.append('defs').append('filter').attr('id', 'glow');
                glowFilter.append('feGaussianBlur').attr('stdDeviation', '2.5').attr('result', 'coloredBlur');
                const feMerge = glowFilter.append('feMerge');
                feMerge.append('feMergeNode').attr('in', 'coloredBlur');
                feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

                // Force simulation
                const simulation = d3.forceSimulation(nodes)
                    .force("link", d3.forceLink(links).id(d => d.id).distance(40))
                    .force("charge", d3.forceManyBody().strength(-30))
                    .force("center", d3.forceCenter(width / 2, height / 2))
                    .force("collide", d3.forceCollide().radius(d => d.r + 2));

                const link = svg.append("g")
                    .attr("stroke", "rgba(0, 242, 255, 0.3)")
                    .attr("stroke-opacity", 0.6)
                    .selectAll("line")
                    .data(links)
                    .enter().append("line")
                    .attr("stroke-width", 1);

                const node = svg.append("g")
                    .selectAll("circle")
                    .data(nodes)
                    .enter().append("circle")
                    .attr("class", "dot")
                    .attr("r", d => d.r)
                    .attr("fill", d => d.c)
                    .style("cursor", "grab")
                    .call(d3.drag()
                        .on("start", dragstarted)
                        .on("drag", dragged)
                        .on("end", dragended));

                node.on('mouseover', function(e, d) {
                        d3.select(this).transition().duration(100)
                        .attr('r', d.r * 1.5)
                        .style('filter', 'url(#glow)')
                        .attr('stroke', '#fff')
                        .attr('stroke-width', 2);
                        window.parent.postMessage({ type: 'PLAY_AUDIO', sound: 'click' }, '*');
                    })
                    .on('mouseout', function(e, d) {
                        d3.select(this).transition().duration(200)
                        .attr('r', d.r)
                        .style('filter', null)
                        .attr('stroke', null);
                    });

                simulation.on("tick", () => {
                    link
                        .attr("x1", d => d.source.x)
                        .attr("y1", d => d.source.y)
                        .attr("x2", d => d.target.x)
                        .attr("y2", d => d.target.y);
                    node
                        .attr("cx", d => d.x = Math.max(d.r, Math.min(width - d.r, d.x)))
                        .attr("cy", d => d.y = Math.max(d.r, Math.min(height - d.r, d.y)));
                });

                function dragstarted(event, d) {
                    if (!event.active) simulation.alphaTarget(0.3).restart();
                    d.fx = d.x;
                    d.fy = d.y;
                    d3.select(this).style('cursor', 'grabbing');
                    window.parent.postMessage({ type: 'PLAY_AUDIO', sound: 'drag' }, '*');
                }

                function dragged(event, d) {
                    d.fx = event.x;
                    d.fy = event.y;
                }

                function dragended(event, d) {
                    if (!event.active) simulation.alphaTarget(0);
                    d.fx = null;
                    d.fy = null;
                    d3.select(this).style('cursor', 'grab');
                    window.parent.postMessage({ type: 'PLAY_AUDIO', sound: 'success' }, '*');
                }
                
                // Interaction: Randomize
                document.getElementById('d3-regen')?.addEventListener('click', (e) => {
                    e.stopPropagation();
                    window.parent.postMessage({ type: 'PLAY_AUDIO', sound: 'success' }, '*');
                    
                    nodes.forEach(d => {
                        d.fx = null;
                        d.fy = null;
                        // Give it a kick
                        d.vx = (Math.random() - 0.5) * 10;
                        d.vy = (Math.random() - 0.5) * 10;
                    });
                    simulation.alpha(1).restart();
                });
            }    
                // Link slider intensity to data volatility
                const slider = document.querySelector('input[type="range"]');
                if (slider) {
                    slider.addEventListener('input', (e) => {
                        const intensity = e.target.value / 100;
                        path.attr('stroke', d3.interpolateHsl('#00d8ff', '#ff003c')(intensity));
                    });
                }
            }
            initD3();
        `;
        doc.body.appendChild(d3Logic);

        // Add ambient background animation
        const ambientBg = document.createElement('div');
        ambientBg.style.position = 'fixed';
        ambientBg.style.top = '0';
        ambientBg.style.left = '0';
        ambientBg.style.width = '100vw';
        ambientBg.style.height = '100vh';
        ambientBg.style.background = 'radial-gradient(circle at 50% 50%, rgba(0, 242, 255, 0.1), transparent)';
        ambientBg.style.zIndex = '-1';
        ambientBg.style.pointerEvents = 'none';
        doc.body.prepend(ambientBg);

        // Include Matter.js for physics
        const matterScript = document.createElement('script');
        matterScript.src = "https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js";
        doc.head.appendChild(matterScript);

        // Inject interaction script
        const script = document.createElement('script');
        script.textContent = `
            const isInspectorActive = ${isInspectorActive.toString()};
            
            // Initialization of physics for nodes
            function initPhysics() {
                if (typeof Matter === "undefined") {
                    setTimeout(initPhysics, 100);
                    return;
                }
                
                // Advanced visual and haptic feedback for interactive nodes
                document.querySelectorAll('.interactive-node').forEach(el => {
                    if (el.dataset.physicsInit) return;
                    el.dataset.physicsInit = 'true';
                    
                    el.addEventListener('mouseenter', () => {
                        el.style.transform = 'scale(1.03) translateY(-2px)';
                        el.style.boxShadow = '0 0 15px rgba(0, 216, 255, 0.5), inset 0 0 10px rgba(0, 216, 255, 0.2)';
                        el.style.borderColor = '#00d8ff';
                        playAudio('click');
                    });
                    el.addEventListener('mouseleave', () => {
                        el.style.transform = 'scale(1) translateY(0)';
                        el.style.boxShadow = 'none';
                        el.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    });
                    el.addEventListener('mousedown', () => {
                        el.style.transform = 'scale(0.97)';
                        el.style.boxShadow = '0 0 5px rgba(0, 216, 255, 0.9)';
                        playAudio('drag');
                    });
                    el.addEventListener('mouseup', () => {
                        el.style.transform = 'scale(1.03) translateY(-2px)';
                        el.style.boxShadow = '0 0 25px rgba(0, 216, 255, 0.7)';
                        playAudio('success');
                    });
                });
            }
            initPhysics();
            setInterval(initPhysics, 1000); // Catch newly added elements
            
            // Audio Feedback
            const playAudio = (sound) => window.parent.postMessage({ type: 'PLAY_AUDIO', sound }, '*');
            
            // --- IDE Pane Layout Resizer ---
            function initIDELayoutResizer() {
                if (window.__ideLayoutResizerInit) return;
                window.__ideLayoutResizerInit = true;

                const style = document.createElement('style');
                style.textContent = '.ide-pane-container { position: relative; }' +
                    '.ide-resizer-right, .ide-resizer-bottom { position: absolute; z-index: 9999; transition: background 0.2s ease, box-shadow 0.2s ease; }' +
                    '.ide-resizer-right { top: 0; right: -4px; width: 8px; height: 100%; cursor: col-resize; }' +
                    '.ide-resizer-bottom { bottom: -4px; left: 0; width: 100%; height: 8px; cursor: row-resize; }' +
                    '.ide-resizer-right:hover, .ide-resizer-bottom:hover { background: rgba(0, 242, 255, 0.4); box-shadow: 0 0 10px rgba(0, 242, 255, 0.8); }' +
                    '.ide-resizer-active { background: rgba(0, 242, 255, 0.8) !important; }' +
                    'body.is-resizing { user-select: none !important; }' +
                    'body.is-resizing-col { cursor: col-resize !important; }' +
                    'body.is-resizing-row { cursor: row-resize !important; }';
                document.head.appendChild(style);

                function attachLayoutResizers() {
                    const elements = document.querySelectorAll('aside, main, nav, section, article, .sidebar, .pane, .panel, [class*="w-64"], [class*="w-72"], [class*="max-w-"]');
                    elements.forEach(el => {
                        if (el.dataset.hasIdeResizer === 'true' || el.offsetWidth < 50 || el.tagName === 'BODY' || el.tagName === 'HTML' || el.id === 'root') return;
                        el.dataset.hasIdeResizer = 'true';
                        
                        const computed = window.getComputedStyle(el);
                        if (computed.position === 'static') {
                            el.style.position = 'relative';
                        }
                        
                        const resizerR = document.createElement('div');
                        resizerR.className = 'ide-resizer-right';
                        el.appendChild(resizerR);
                        
                        const resizerB = document.createElement('div');
                        resizerB.className = 'ide-resizer-bottom';
                        el.appendChild(resizerB);
                        
                        let startX, startY, startWidth, startHeight;
                        
                        // Right Resizer Drag
                        resizerR.addEventListener('mousedown', (e) => {
                            e.preventDefault(); e.stopPropagation();
                            startX = e.clientX;
                            startWidth = el.offsetWidth;
                            document.body.classList.add('is-resizing', 'is-resizing-col');
                            resizerR.classList.add('ide-resizer-active');
                            if(typeof playAudio === 'function') playAudio('drag');
                            
                            const onMoveRight = (ev) => {
                                const dx = ev.clientX - startX;
                                el.style.flex = 'none';
                                el.style.width = Math.max(50, startWidth + dx) + 'px';
                                el.style.minWidth = Math.max(50, startWidth + dx) + 'px';
                                el.style.maxWidth = 'none';
                            };
                            
                            const onUpRight = () => {
                                document.removeEventListener('mousemove', onMoveRight);
                                document.removeEventListener('mouseup', onUpRight);
                                document.body.classList.remove('is-resizing', 'is-resizing-col');
                                resizerR.classList.remove('ide-resizer-active');
                                if(typeof playAudio === 'function') playAudio('success');
                            };
                            
                            document.addEventListener('mousemove', onMoveRight);
                            document.addEventListener('mouseup', onUpRight);
                        });
                        
                        // Bottom Resizer Drag
                        resizerB.addEventListener('mousedown', (e) => {
                            e.preventDefault(); e.stopPropagation();
                            startY = e.clientY;
                            startHeight = el.offsetHeight;
                            document.body.classList.add('is-resizing', 'is-resizing-row');
                            resizerB.classList.add('ide-resizer-active');
                            if(typeof playAudio === 'function') playAudio('drag');
                            
                            const onMoveBot = (ev) => {
                                const dy = ev.clientY - startY;
                                el.style.flex = 'none';
                                el.style.height = Math.max(50, startHeight + dy) + 'px';
                                el.style.minHeight = Math.max(50, startHeight + dy) + 'px';
                                el.style.maxHeight = 'none';
                            };
                            
                            const onUpBot = () => {
                                document.removeEventListener('mousemove', onMoveBot);
                                document.removeEventListener('mouseup', onUpBot);
                                document.body.classList.remove('is-resizing', 'is-resizing-row');
                                resizerB.classList.remove('ide-resizer-active');
                                if(typeof playAudio === 'function') playAudio('success');
                            };
                            
                            document.addEventListener('mousemove', onMoveBot);
                            document.addEventListener('mouseup', onUpBot);
                        });
                    });
                }

                attachLayoutResizers();
                setInterval(attachLayoutResizers, 2000);
            }
            initIDELayoutResizer();
            
            // --- Form Field Validation with Audio & CSS ---
            function initFormValidation() {
                if (window.__formValidationInit) return;
                window.__formValidationInit = true;
                
                const style = document.createElement('style');
                style.textContent = '.whisper-input-invalid { border-color: #ef4444 !important; outline-color: #ef4444 !important; animation: whisperShake 0.4s ease-in-out; box-shadow: 0 0 0 1px #ef4444 !important; } ' +
                                    '.whisper-input-valid { border-color: #22c55e !important; outline-color: #22c55e !important; box-shadow: 0 0 0 1px #22c55e !important; } ' +
                                    '@keyframes whisperShake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }';
                document.head.appendChild(style);

                let audioCtx = null;
                function playValidationSound(isValid) {
                    try {
                        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                        if (audioCtx.state === 'suspended') audioCtx.resume();
                        const osc = audioCtx.createOscillator();
                        const gainNode = audioCtx.createGain();
                        osc.connect(gainNode);
                        gainNode.connect(audioCtx.destination);
                        if (isValid) {
                            osc.type = 'sine';
                            osc.frequency.setValueAtTime(600, audioCtx.currentTime);
                            osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
                            gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
                            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
                            osc.start();
                            osc.stop(audioCtx.currentTime + 0.1);
                        } else {
                            osc.type = 'square';
                            osc.frequency.setValueAtTime(150, audioCtx.currentTime);
                            osc.frequency.linearRampToValueAtTime(100, audioCtx.currentTime + 0.15);
                            gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
                            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
                            osc.start();
                            osc.stop(audioCtx.currentTime + 0.15);
                        }
                    } catch (e) {
                        // ignore audio context errors
                    }
                }

                function handleInputValidation(e) {
                    const el = e.target;
                    if (!el.matches('input[type="text"], input[type="email"], input[type="password"], input[type="number"], textarea, select')) return;
                    
                    const isValid = el.checkValidity();
                    const isEmpty = el.value.trim().length === 0;
                    
                    // Don't validate if empty and not required (or just focused and typing)
                    // We'll mark neutral if it's empty and not required
                    if (isEmpty && !el.required) {
                         el.classList.remove('whisper-input-valid', 'whisper-input-invalid');
                         delete el.dataset.lastValidationSound;
                         return;
                    }
                    
                    // Prevent annoying real-time validation off first character unless it's a simple pattern
                    // but the spec specifically asked for real-time validation.

                    el.classList.remove('whisper-input-valid', 'whisper-input-invalid');
                    
                    if (isValid) {
                        el.classList.add('whisper-input-valid');
                        if (el.dataset.lastValidationSound !== 'valid') {
                            playValidationSound(true);
                            el.dataset.lastValidationSound = 'valid';
                        }
                    } else {
                        // Check if it's empty but required - might not want to shake until blur?
                        // Let's just do it directly.
                        el.classList.add('whisper-input-invalid');
                        if (el.dataset.lastValidationSound !== 'invalid') {
                            playValidationSound(false);
                            el.dataset.lastValidationSound = 'invalid';
                        }
                    }
                }

                document.addEventListener('input', handleInputValidation, true);
                document.addEventListener('change', handleInputValidation, true);
                document.addEventListener('blur', handleInputValidation, true); // Validate on blur as well
            }
            initFormValidation();

            // Resize Overlay Setup
            const resizeOverlay = document.createElement('div');
            resizeOverlay.id = 'whisperx-resize-overlay';
            resizeOverlay.style.cssText = 'position: fixed; pointer-events: none; z-index: 10000; border: 2px dashed #00f2ff; display: none;';
            const resizeHandle = document.createElement('div');
            resizeHandle.style.cssText = 'position: absolute; right: -6px; bottom: -6px; width: 12px; height: 12px; background: #00f2ff; pointer-events: auto; cursor: se-resize; border-radius: 2px;';
            resizeOverlay.appendChild(resizeHandle);
            document.body.appendChild(resizeOverlay);

            let isResizing = false;
            let startX, startY, startWidth, startHeight, targetEl = null;

            resizeHandle.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                e.preventDefault();
                if (!targetEl) return;
                isResizing = true;
                startX = e.clientX;
                startY = e.clientY;
                startWidth = targetEl.offsetWidth;
                startHeight = targetEl.offsetHeight;
                
                const onMove = (ev) => {
                    const newW = startWidth + (ev.clientX - startX);
                    const newH = startHeight + (ev.clientY - startY);
                    targetEl.style.width = newW + 'px';
                    targetEl.style.height = newH + 'px';
                    updateOverlay();
                };
                
                const onUp = () => {
                    isResizing = false;
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                    window.parent.postMessage({ type: 'ELEMENT_RESIZED', id: targetEl.id || '', classes: targetEl.className || '', width: targetEl.style.width, height: targetEl.style.height }, '*');
                };
                
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            });

            function updateOverlay() {
                if (!targetEl || !isInspectorActive) {
                    resizeOverlay.style.display = 'none';
                    return;
                }
                const rect = targetEl.getBoundingClientRect();
                resizeOverlay.style.top = rect.top + 'px';
                resizeOverlay.style.left = rect.left + 'px';
                resizeOverlay.style.width = rect.width + 'px';
                resizeOverlay.style.height = rect.height + 'px';
                resizeOverlay.style.display = 'block';
            }
            window.addEventListener('scroll', updateOverlay);
            window.addEventListener('resize', updateOverlay);
            
            // News Fetching logic
            async function fetchNews() {
               const btn = document.getElementById('news-btn');
               if (!btn) return;
               btn.textContent = 'Loading...';
               try {
                  const res = await fetch('https://jsonplaceholder.typicode.com/posts?_limit=3');
                  const news = await res.json();
                  const container = document.createElement('div');
                  container.innerHTML = news.map(n => '<p><strong>' + n.title + '</strong></p>').join('');
                  btn.parentElement.appendChild(container);
                  btn.remove();
               } catch (e) {
                  btn.textContent = 'Failed to load news';
               }
            }
            
            // Interaction Controller
            
            // Tooltips
            document.querySelectorAll('[title]').forEach(el => {
                el.addEventListener('mouseenter', (e) => {
                    const tooltip = document.createElement('div');
                    tooltip.textContent = el.getAttribute('title');
                    tooltip.id = 'tooltip';
                    tooltip.style.position = 'absolute';
                    tooltip.style.background = '#00d8ff';
                    tooltip.style.color = '#0f172a';
                    tooltip.style.padding = '5px 10px';
                    tooltip.style.borderRadius = '4px';
                    tooltip.style.fontSize = '12px';
                    tooltip.style.zIndex = '10000';
                    tooltip.style.pointerEvents = 'none';
                    document.body.appendChild(tooltip);
                    
                    const rect = el.getBoundingClientRect();
                    tooltip.style.left = (rect.left + window.scrollX) + 'px';
                    tooltip.style.top = (rect.top + window.scrollY - 30) + 'px';
                });
                el.addEventListener('mouseleave', () => {
                    document.getElementById('tooltip')?.remove();
                });
            });
            
            // News button injection
            const newsBtn = document.createElement('button');
            newsBtn.id = 'news-btn';
            newsBtn.textContent = 'Fetch News';
            newsBtn.onclick = () => fetchNews();
            document.body.prepend(newsBtn);

            document.addEventListener('click', (e) => {
                if (!isInspectorActive) {
                    playAudio('click');
                    return;
                }
                e.preventDefault();
                e.stopPropagation();
                const el = e.target;
                
                // Highlight selected element
                document.querySelectorAll('.inspector-selected').forEach(e => e.classList.remove('inspector-selected'));
                el.classList.add('inspector-selected');
                
                targetEl = el;
                updateOverlay();

                // Get DOM hierarchy and accessibility info
                const breadcrumbs = [];
                let current = el;
                while (current && current !== document.body) {
                    breadcrumbs.push({
                        tagName: current.tagName,
                        id: current.id,
                        className: current.className,
                        role: current.getAttribute('role') || 'n/a',
                        ariaLabel: current.getAttribute('aria-label') || 'n/a'
                    });
                    current = current.parentElement;
                }

                const computed = window.getComputedStyle(el);
                const rect = el.getBoundingClientRect();
                const info = {
                    tagName: el.tagName,
                    id: el.id,
                    className: el.className,
                    styles: Object.fromEntries(Object.entries(computed).filter(([k,v]) => typeof v === 'string')),
                    html: el.outerHTML,
                    dimensions: { width: rect.width, height: rect.height, top: rect.top, left: rect.left },
                    breadcrumbs: breadcrumbs.reverse(),
                    ariaProperties: {
                        role: el.getAttribute('role') || 'n/a',
                        ariaLabel: el.getAttribute('aria-label') || 'n/a',
                        ariaExpanded: el.getAttribute('aria-expanded') || 'n/a',
                        ariaHidden: el.getAttribute('aria-hidden') || 'n/a'
                    }
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

            // Grid Gap Debugging
            function showGridGaps() {
                document.querySelectorAll('.grid-gap-label').forEach(el => el.remove());
                document.querySelectorAll('*').forEach(el => {
                    if (window.getComputedStyle(el).display === 'grid') {
                        el.addEventListener('mouseenter', (e) => {
                             const style = window.getComputedStyle(el);
                             if (style.columnGap !== 'normal' || style.rowGap !== 'normal') {
                                 const label = document.createElement('div');
                                 label.className = 'grid-gap-label';
                                 label.textContent = "Gap: " + style.columnGap + "/" + style.rowGap;
                                 label.style.top = (el.getBoundingClientRect().top + window.scrollY) + "px";
                                 label.style.left = (el.getBoundingClientRect().left + window.scrollX) + "px";
                                 label.id = 'active-grid-label';
                                 document.body.appendChild(label);
                             }
                        });
                        el.addEventListener('mouseleave', () => {
                             document.getElementById('active-grid-label')?.remove();
                        });
                    }
                });
            }

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
                document.querySelectorAll('.drop-target').forEach(el => el.style.boxShadow = 'none');
            });
            document.addEventListener('dragover', (e) => {
                e.preventDefault();
                const target = e.target.closest('*');
                if (isInspectorActive || !target) return;
                
                if (target.parentElement === draggedNode.parentElement) {
                    target.style.boxShadow = '0 0 10px rgba(0, 216, 255, 0.8)';
                    target.classList.add('drop-target');
                    target.classList.remove('drag-invalid');
                } else if (target !== draggedNode) {
                    target.style.cursor = 'no-drop';
                    target.classList.add('drag-invalid');
                }
            });
            document.addEventListener('dragleave', (e) => { 
                e.target.style.boxShadow = 'none';
                e.target.style.cursor = 'auto';
                e.target.classList.remove('drop-target', 'drag-invalid');
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
            
            // Execute showGridGaps after script is parsed and DOM is ready
            const gapScript = document.createElement('script');
            gapScript.textContent = 'showGridGaps();';
            doc.body.appendChild(gapScript);
        } else {
            doc.body.classList.remove('grid-debug-lines');
            doc.body.classList.remove('grid-debug-outline');
        }

        // Auto-inject ARIA roles based on heuristics to improve accessibility
        doc.querySelectorAll('nav, header, footer, main, aside, section, article').forEach((el) => {
            const tagName = el.tagName.toLowerCase();
            if (!el.hasAttribute('role')) {
                const roleMap: Record<string, string> = {
                    'nav': 'navigation',
                    'header': 'banner',
                    'footer': 'contentinfo',
                    'main': 'main',
                    'aside': 'complementary',
                    'section': 'region',
                    'article': 'article'
                };
                if (roleMap[tagName]) {
                    el.setAttribute('role', roleMap[tagName]);
                }
            }
        });
        
        doc.querySelectorAll('button').forEach(btn => {
            if (!btn.hasAttribute('role')) btn.setAttribute('role', 'button');
        });
        
        doc.querySelectorAll('.alert, .error, .warning, [class*="alert"]').forEach(el => {
            if (!el.hasAttribute('role')) el.setAttribute('role', 'alert');
        });

        doc.querySelectorAll('dialog, .modal, .dialog').forEach(el => {
            if (!el.hasAttribute('role')) el.setAttribute('role', 'dialog');
            if (!el.hasAttribute('aria-modal')) el.setAttribute('aria-modal', 'true');
        });

        return doc.documentElement.outerHTML;
    }, [customCode, filter, showGrid, debugOptions]);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef({ x: 0, y: 0 });
    
    const [elementAiInsights, setElementAiInsights] = useState<string | null>(null);
    const [isAnalyzingElement, setIsAnalyzingElement] = useState(false);

    useEffect(() => {
        setElementAiInsights(null);
    }, [selectedElement]);

    const handleAnalyzeElement = async () => {
        if (!selectedElement) return;
        setIsAnalyzingElement(true);
        try {
            const insights = await analyzeElement(selectedElement);
            setElementAiInsights(insights);
        } catch (err) {
            console.error("Analysis Failed:", err);
            setElementAiInsights("Failed to analyze element.");
        } finally {
            setIsAnalyzingElement(false);
        }
    };

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
            applyCodeChange(creation.html);
        }
        setShowCode(false);
    }, [creation]);

    const handleBeautify = async () => {
        try {
            const formatted = await prettier.format(customCode, {
                parser: 'html',
                plugins: [parserHtml, parserPostcss, parserBabel],
            });
            // Improved AI semantic analysis
            const parser = new DOMParser();
            const doc = parser.parseFromString(formatted, 'text/html');
            const hasDivs = doc.querySelectorAll('div').length > 5;
            const hasMain = doc.querySelector('main');
            
            let suggestions = `\n<!-- \n  [AI Semantic Styling Suggestions]:\n`;
            if (hasDivs) suggestions += `  - High number of <div> elements detected. Consider using <section>, <article>, or <aside> for better semantic structure.\n`;
            if (!hasMain) suggestions += `  - No <main> tag found. Recommend wrapping main content in a <main> tag.\n`;
            suggestions += `  - Review interactive elements for proper role attributes.\n-->\n`;
            
            applyCodeChange(formatted + suggestions);
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

    const handleShare = () => {
        try {
            const dataToShare = {
                id: Date.now().toString(36),
                name: creation?.name || 'Shared Creation',
                html: customCode
            };
            const jsonStr = JSON.stringify(dataToShare);
            const base64Str = btoa(encodeURIComponent(jsonStr));
            const shareUrl = `${window.location.origin}${window.location.pathname}#shared/${base64Str}`;
            
            navigator.clipboard.writeText(shareUrl).then(() => {
                alert('Shareable link copied to clipboard!');
            }).catch(e => {
                console.error("Clipboard copy failed", e);
                alert('Could not copy to clipboard. Please check console for errors.');
            });
        } catch (e) {
            console.error("Failed to generate share link", e);
            alert("Failed to generate share link (might be too large).");
        }
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
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden relative">
        {showLibrary && (
            <div className="absolute inset-0 z-40 md:relative md:inset-auto w-full md:w-64 border-b md:border-b-0 md:border-r border-bdr bg-bg/95 md:bg-bg/90 backdrop-blur-xl flex flex-col p-4 shrink-0 overflow-y-auto space-y-8">
              <div className="flex justify-between items-center md:hidden mb-2">
                  <h4 className="text-acc font-mono text-xs uppercase tracking-widest">Controls</h4>
                  <button onClick={() => setShowLibrary(false)} className="text-dim hover:text-white pb-1">✕</button>
              </div>
              <div>
                  <h4 className="text-acc font-mono text-xs uppercase tracking-widest mb-4">Component Library</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {['Card', 'Button', 'Modal', 'Nav', 'Input', 'Chart', 'Hero', 'Footer'].map(comp => (
                      <div 
                          key={comp} 
                          onClick={() => handleGenerateComponent(comp)}
                          className="holographic-card p-2 text-[10px] cursor-pointer hover:border-acc hover:bg-acc/10 transition-all text-center flex items-center justify-center flex-col gap-1"
                      >
                        {comp}
                      </div>
                    ))}
                  </div>
              </div>
              <div>
                  <h4 className="text-pur font-mono text-xs uppercase tracking-widest mb-4">Color Palette</h4>
                  <div className="flex flex-col gap-2">
                      {['cyberpunk', 'holographic', 'minimal', 'custom'].map(t => (
                          <button key={t} onClick={() => applyTheme(t)} className={`text-[10px] py-1 border rounded ${theme === t ? 'border-pur text-pur' : 'border-bdr text-dim'} hover:border-pur transition-colors uppercase`}>
                              {t}
                          </button>
                      ))}
                  </div>
              </div>
              <div>
                  <h4 className="text-amb font-mono text-xs uppercase tracking-widest mb-4">Entry Animations</h4>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                      {['fade-in', 'slide-up', 'pulse', 'spin', 'bounce'].map(anim => (
                          <button key={anim} onClick={() => applyAnimation(anim)} className="text-[10px] py-1 border border-bdr rounded text-dim hover:border-amb hover:text-white transition-colors uppercase">
                              {anim}
                          </button>
                      ))}
                  </div>
                  <h4 className="text-amb font-mono text-xs uppercase tracking-widest mb-4">Hover Effects</h4>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                      {['scale-up', 'shadow-pop', 'border-glow'].map(hover => (
                          <button key={hover} onClick={() => applyHoverEffect(hover)} className="text-[10px] py-1 border border-bdr rounded text-dim hover:border-amb hover:text-white transition-colors uppercase">
                              {hover}
                          </button>
                      ))}
                  </div>
                  <div className="flex flex-col gap-2 text-[10px] text-dim mt-4">
                      <label className="flex flex-col">
                          Speed ({animationSpeed}s):
                          <input type="range" min="0.1" max="5" step="0.1" value={animationSpeed} onChange={e => setAnimationSpeed(e.target.value)} className="mt-1" />
                      </label>
                      <label className="flex flex-col">
                          Delay ({animationDelay}s):
                          <input type="range" min="0" max="5" step="0.1" value={animationDelay} onChange={e => setAnimationDelay(e.target.value)} className="mt-1" />
                      </label>
                  </div>
              </div>
            </div>
        )}
        <div className="flex-1 flex flex-col overflow-hidden">
            <div className="bg-bg/80 backdrop-blur-xl px-5 py-3 flex items-center justify-between border-b border-bdr/50 bg-gradient-to-r from-bg2/50 to-bg/50 shrink-0">
                {/* Left: Controls */}
                <div className="flex items-center space-x-3 w-32">
                   <div className="flex space-x-2 group/controls">
                        <button onClick={onReset} className="w-3 h-3 rounded-full bg-dim group-hover/controls:bg-red-500 hover:!bg-red-600 transition-colors flex items-center justify-center focus:outline-none" title="Close Preview">
                          <XMarkIcon className="w-2 h-2 text-black opacity-0 group-hover/controls:opacity-100" />
                        </button>
                        <div className="w-3 h-3 rounded-full bg-dim group-hover/controls:bg-amb transition-colors"></div>
                        <div className="w-3 h-3 rounded-full bg-dim group-hover/controls:bg-grn transition-colors"></div>
                   </div>
                </div>
                
                {/* Title */}
                <div className="flex items-center space-x-2 text-muted truncate max-w-[40%] md:max-w-none">
                    <CodeBracketIcon className="w-3 h-3 shrink-0" />
                    <span className="text-[10px] md:text-[11px] font-mono uppercase tracking-wider truncate">
                        {isLoading ? 'System Processing...' : creation ? creation.name : 'Preview Mode'}
                    </span>
                </div>

                {/* Viewport Simulator Control Panel & Existing actions */}
                <div className="flex items-center justify-end space-x-1 md:space-x-2 w-auto flex-wrap gap-y-1">
                    {!isLoading && creation && (
                        <>
                            <button 
                                onClick={() => setShowLibrary(!showLibrary)}
                                title="UI Component Library"
                                className={`p-1.5 rounded-lg transition-all ${showLibrary ? 'bg-bg3 text-txt border border-bdr' : 'text-dim hover:text-txt hover:bg-bg3/50 border border-transparent'}`}
                            >
                                <SparklesIcon className="w-4 h-4" />
                            </button>
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
                                onClick={() => setShowAnalytics(!showAnalytics)}
                                title="Code Analytics"
                                className={`p-1.5 rounded-lg transition-all ${showAnalytics ? 'bg-bg3 text-txt border border-bdr' : 'text-dim hover:text-txt hover:bg-bg3/50 border border-transparent'}`}
                            >
                                <ChartBarIcon className="w-4 h-4" />
                            </button>
                            <button 
                                onClick={handleShare}
                                title="Share Creation"
                                className="p-1.5 rounded-lg transition-all text-dim hover:text-txt hover:bg-bg3/50 border border-transparent"
                            >
                                <ShareIcon className="w-4 h-4" />
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
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 w-full bg-bg z-30">
             {/* Technical Loading State - Wireframe Skeleton */}
             <div className="w-full max-w-4xl space-y-6 relative z-10 opacity-70 animate-pulse">
                <div className="flex items-center space-x-4 mb-8">
                    <div className="w-12 h-12 rounded-full border-2 border-bdr bg-bg3/50 flex items-center justify-center">
                        <CpuChipIcon className="w-6 h-6 text-txt animate-pulse" />
                    </div>
                    <div className="space-y-2">
                        <div className="h-4 w-48 bg-bg3 rounded"></div>
                        <div className="h-3 w-32 bg-bg2 border border-bdr rounded"></div>
                    </div>
                </div>
                
                {/* Wireframe UI Structure */}
                <div className="grid grid-cols-12 gap-6 h-[400px]">
                    <div className="col-span-3 space-y-4">
                        <div className="h-10 w-full bg-bg2 border border-bdr rounded-lg skeleton"></div>
                        <div className="h-32 w-full bg-bg2 border border-bdr rounded-lg skeleton"></div>
                        <div className="h-24 w-full bg-bg3/50 border border-bdr rounded-lg skeleton"></div>
                    </div>
                    <div className="col-span-9 space-y-6">
                        <div className="h-48 w-full bg-bg2 border border-bdr rounded-xl skeleton relative overflow-hidden">
                             <div className="absolute top-4 left-4 right-4 h-6 bg-bg3/50 rounded skeleton"></div>
                             <div className="absolute top-14 left-4 w-1/3 h-4 bg-bg3/50 rounded skeleton"></div>
                        </div>
                        <div className="grid grid-cols-3 gap-6">
                             <div className="h-32 bg-bg2 border border-bdr rounded-xl skeleton"></div>
                             <div className="h-32 bg-bg2 border border-bdr rounded-xl skeleton"></div>
                             <div className="h-32 bg-bg2 border border-bdr rounded-xl skeleton"></div>
                        </div>
                    </div>
                </div>

                <div className="mt-8 relative w-full max-w-md mx-auto">
                    <div className="flex justify-between text-xs font-mono text-dim mb-2 uppercase tracking-widest">
                        <span>Generating Layout</span>
                        <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-bg3 h-1.5 rounded-full overflow-hidden border border-bdr">
                        <div className="h-full bg-gradient-to-r from-acc via-pur to-acc bg-[length:200%_auto] animate-[progress_1s_linear_infinite]" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                </div>
             </div>
             
             {/* Decorative loading background */}
             <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-acc/5 rounded-full blur-[120px] animate-pulse"></div>
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
                            <div className="bg-bg3 p-2 flex justify-between items-center border-b border-bdr">
                                <div className="flex space-x-2">
                                    <button 
                                        onClick={() => editorRef.current?.trigger('keyboard', 'undo', null)}
                                        aria-label="Undo code edit"
                                        className="text-xs text-dim hover:text-txt px-2 py-1 rounded bg-bg2 hover:bg-bg border border-bdr transition-all"
                                    >
                                        Undo
                                    </button>
                                    <button 
                                        onClick={() => editorRef.current?.trigger('keyboard', 'redo', null)}
                                        aria-label="Redo code edit"
                                        className="text-xs text-dim hover:text-txt px-2 py-1 rounded bg-bg2 hover:bg-bg border border-bdr transition-all"
                                    >
                                        Redo
                                    </button>
                                </div>
                                <button 
                                    onClick={handleBeautify}
                                    title="Beautify Code (Ctrl+Shift+L)"
                                    aria-label="Beautify code in editor"
                                    aria-keyshortcuts="Control+Shift+L"
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
                                onMount={(editor, monaco) => { 
                                    editorRef.current = editor;
                                    monaco.languages.html.htmlDefaults.setOptions({
                                        format: {
                                            tabSize: 4,
                                            insertSpaces: true
                                        },
                                        suggest: { html5: true }
                                    });
                                    editor.addAction({
                                        id: 'beautify-code',
                                        label: 'Beautify Code',
                                        keybindings: [
                                            monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyL
                                        ],
                                        contextMenuGroupId: 'navigation',
                                        contextMenuOrder: 1.5,
                                        run: () => { handleBeautify(); }
                                    });
                                }}
                                options={{
                                    minimap: { enabled: false },
                                    fontSize: 14,
                                    wordWrap: 'on',
                                    padding: { top: 16 },
                                    folding: true,
                                    showFoldingControls: 'always',
                                    formatOnPaste: true,
                                }}
                            />
                        </div>
                    ) : (
                        <>
                            <iframe
                                title="WhisperX Live Preview"
                                srcDoc={processedHtml}
                                className="w-full h-full pointer-events-auto"
                                style={{ pointerEvents: isDragging ? 'none' : 'auto' }}
                                sandbox="allow-scripts allow-forms allow-popups allow-modals allow-same-origin"
                            />
                            {isInspectorActive && selectedElement && (
                                <div 
                                    className="absolute z-50 flex gap-1 p-1 rounded-md bg-bg2/95 border border-acc shadow-[0_0_20px_rgba(0,216,255,0.4)] transition-all pointer-events-auto"
                                    style={{
                                        top: `${Math.max(4, selectedElement.dimensions?.top - 40 || 0)}px`,
                                        left: `${selectedElement.dimensions?.left || 0}px`,
                                        transform: `scale(${1/Math.max(zoom, 1)})`,
                                        transformOrigin: 'top left'
                                    }}
                                    onMouseDown={e => e.stopPropagation()}
                                >
                                    <button onClick={copyStyles} title="Copy Styles" className="p-1.5 hover:bg-white/10 hover:text-white rounded text-dim"><ClipboardDocumentIcon className="w-3 h-3" /></button>
                                    <button onClick={() => {
                                        const themeToApply = prompt('Enter a preset to apply (e.g., Neon Glow, Cyberpunk, Glass, Outline):');
                                        if (!themeToApply) return;
                                        setMessages(prev => [...prev, {role: 'user', text: `Apply ${themeToApply} style preset`}]);
                                        setIsChatLoading(true);
                                        const userMsg = `Apply the "${themeToApply}" visual style specifically to the selected element (${selectedElement.tagName} id="${selectedElement.id}" classes="${selectedElement.className}"). Update its Tailwind classes or inline styles locally.`;
                                        refineCode(userMsg, customCode || creation?.html || '').then(newCode => {
                                             applyCodeChange(newCode);
                                             if (onUpdateCreation) onUpdateCreation(newCode);
                                             setMessages(prev => [...prev, {role: 'assistant', text: `Applied ${themeToApply} preset to element.`}]);
                                        }).finally(() => setIsChatLoading(false));
                                    }} title="Apply Custom Preset" className="p-1.5 hover:bg-white/10 hover:text-white rounded text-dim"><SparklesIcon className="w-3 h-3" /></button>
                                    <button onClick={() => {
                                        const userMsg = `Analyze the selected element (${selectedElement.tagName} id=${selectedElement.id}) and provide UI/UX or performance insights on its current style: ${JSON.stringify(selectedElement.styles)}. Keep it brief.`;
                                        setInputValue("Analyze the selected element");
                                        setMessages(prev => [...prev, {role: 'user', text: userMsg}]);
                                        setIsChatLoading(true);
                                        explainCode(customCode || creation?.html || '').then(explanation => {
                                             setMessages(prev => [...prev, {role: 'assistant', text: explanation}]);
                                        }).finally(() => setIsChatLoading(false));
                                    }} title="Generate AI Insights" className="p-1.5 hover:bg-white/10 hover:text-white rounded text-dim"><ChartBarIcon className="w-3 h-3" /></button>
                                </div>
                            )}
                        </>
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
                                 <button onClick={savePreset} className="text-[10px] bg-acc text-bg px-2 rounded whitespace-nowrap">Save Preset</button>
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
                 {/* Analytics Panel */}
                 {showAnalytics && (
                     <div className="absolute top-16 left-4 bg-bg2/95 backdrop-blur border border-bdr rounded-xl p-6 z-20 shadow-[0_0_40px_rgba(0,0,0,0.5)] flex flex-col w-80 text-xs">
                         <div className="flex justify-between items-center mb-4">
                            <h4 className="font-mono text-acc tracking-widest uppercase">Code Composition</h4>
                            <button onClick={() => setShowAnalytics(false)} className="text-dim hover:text-white">✕</button>
                         </div>
                         <div className="h-48 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={codeAnalytics.breakdown} layout="vertical" margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" tick={{fontSize: 10, fill: '#888'}} axisLine={false} tickLine={false} />
                                    <RechartsTooltip 
                                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }} 
                                        cursor={{fill: 'rgba(255,255,255,0.05)'}} 
                                    />
                                    <Bar dataKey="value" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                         </div>
                         <div className="mt-4 grid grid-cols-2 gap-4 border-t border-bdr pt-4">
                             <div className="flex flex-col">
                                 <span className="text-muted font-mono uppercase text-[10px]">Total Size</span>
                                 <span className="text-txt font-bold text-sm">{(codeAnalytics.totalSize / 1024).toFixed(1)} KB</span>
                             </div>
                             <div className="flex flex-col">
                                 <span className="text-muted font-mono uppercase text-[10px]">DOM Nodes</span>
                                 <span className="text-txt font-bold text-sm">{codeAnalytics.tags}</span>
                             </div>
                             <div className="flex flex-col">
                                 <span className="text-muted font-mono uppercase text-[10px]">Est. Load Time</span>
                                 <span className="text-txt font-bold text-sm">{codeAnalytics.loadTime}s</span>
                             </div>
                             <div className="flex flex-col">
                                 <span className="text-muted font-mono uppercase text-[10px]">Complexity</span>
                                 <span className="text-txt font-bold text-sm">{codeAnalytics.tags > 500 ? 'High' : codeAnalytics.tags > 200 ? 'Med' : 'Low'}</span>
                             </div>
                         </div>
                         <div className="mt-4 border-t border-bdr pt-4">
                            <h5 className="font-mono text-dim tracking-widest uppercase text-[10px] mb-3">Lighthouse Simulation</h5>
                            <div className="grid grid-cols-4 gap-2 text-center">
                                <div className="flex flex-col items-center">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 mb-1 ${codeAnalytics.performanceScore >= 90 ? 'border-grn text-grn' : codeAnalytics.performanceScore >= 50 ? 'border-amb text-amb' : 'border-red-400 text-red-400'}`}>
                                        <span className="font-bold">{codeAnalytics.performanceScore}</span>
                                    </div>
                                    <span className="text-[9px] text-muted uppercase">Perf</span>
                                </div>
                                <div className="flex flex-col items-center">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 mb-1 ${codeAnalytics.accessibilityScore >= 90 ? 'border-grn text-grn' : codeAnalytics.accessibilityScore >= 50 ? 'border-amb text-amb' : 'border-red-400 text-red-400'}`}>
                                        <span className="font-bold">{codeAnalytics.accessibilityScore}</span>
                                    </div>
                                    <span className="text-[9px] text-muted uppercase">A11y</span>
                                </div>
                                <div className="flex flex-col items-center">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 mb-1 ${codeAnalytics.bestPracticesScore >= 90 ? 'border-grn text-grn' : codeAnalytics.bestPracticesScore >= 50 ? 'border-amb text-amb' : 'border-red-400 text-red-400'}`}>
                                        <span className="font-bold">{codeAnalytics.bestPracticesScore}</span>
                                    </div>
                                    <span className="text-[9px] text-muted uppercase">Prac</span>
                                </div>
                                <div className="flex flex-col items-center">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 mb-1 ${codeAnalytics.seoScore >= 90 ? 'border-grn text-grn' : codeAnalytics.seoScore >= 50 ? 'border-amb text-amb' : 'border-red-400 text-red-400'}`}>
                                        <span className="font-bold">{codeAnalytics.seoScore}</span>
                                    </div>
                                    <span className="text-[9px] text-muted uppercase">SEO</span>
                                </div>
                            </div>
                         </div>
                     </div>
                 )}

                 {/* Element Inspector Sidebar */}
                 {isInspectorActive && selectedElement && (
                    <div className="absolute top-0 right-0 w-80 h-full bg-bg/95 backdrop-blur-3xl border-l border-acc/30 p-6 overflow-y-auto text-xs z-20 shadow-[0_0_60px_rgba(0,0,0,0.8)]">
                        <div className="flex justify-between items-center mb-8 pb-4 border-b border-acc/20">
                            <h4 className="font-bold text-acc tracking-widest uppercase text-xs">Inspector Panel</h4>
                            <button onClick={() => setSelectedElement(null)} className="text-muted hover:text-white transition-colors">✕</button>
                        </div>
                        <div className="space-y-6">
                            <div className="bg-bg2/40 border border-acc/10 p-4 rounded-xl text-[11px]">
                                <p className="font-bold text-acc mb-3 uppercase tracking-wider">Hierarchy & Accessibility</p>
                                <div className="text-muted mb-4 overflow-auto whitespace-nowrap bg-black/30 p-3 rounded-lg border border-acc/10">
                                    {selectedElement.breadcrumbs?.map((b: any, i: number) => (
                                        <span key={i} className="hover:text-acc cursor-pointer font-mono">
                                            {b.tagName.toLowerCase()}{b.id ? `#${b.id}` : ''}
                                            {i < selectedElement.breadcrumbs.length - 1 && ' > '}
                                        </span>
                                    ))}
                                </div>
                                <div className="text-dim grid grid-cols-2 gap-3 bg-black/30 p-3 rounded-lg border border-acc/5 mb-3">
                                    <span className="truncate">Role: <span className="text-txt">{selectedElement.ariaProperties?.role}</span></span>
                                    <span className="truncate">Label: <span className="text-txt">{selectedElement.ariaProperties?.ariaLabel}</span></span>
                                </div>
                                <div className="mt-2">
                                    <button 
                                        onClick={handleAnalyzeElement} 
                                        disabled={isAnalyzingElement}
                                        className="w-full bg-acc/10 text-acc border border-acc/30 hover:border-acc hover:bg-acc/20 rounded py-1.5 transition-colors"
                                    >
                                        {isAnalyzingElement ? <span className="loader-spinner !w-3 !h-3"></span> : '✨ Get AI Insights'}
                                    </button>
                                    {elementAiInsights && (
                                        <div className="mt-3 bg-black/40 p-2 rounded border border-bdr text-acc/80 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                                            {elementAiInsights}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={copyStyles} className="flex-1 bg-acc/10 text-acc border border-acc/30 font-bold px-3 py-2 rounded-lg hover:bg-acc/20 transition-all">Copy Styles</button>
                                <button onClick={undoStyle} className="bg-bg3 text-white px-3 py-2 rounded-lg hover:bg-bdr transition-all" disabled={styleHistory.length === 0}>Undo</button>
                                <button onClick={redoStyle} className="bg-bg3 text-white px-3 py-2 rounded-lg hover:bg-bdr transition-all" disabled={styleRedoHistory.length === 0}>Redo</button>
                            </div>
                            {/* ... rest of the content unchanged ... */}
                            <div className="flex gap-2 mb-4">
                                <input 
                                    className="bg-bg text-txt text-[10px] px-2 py-1 rounded flex-1"
                                    placeholder="Preset Name..."
                                    value={newPresetName}
                                    onChange={(e) => setNewPresetName(e.target.value)}
                                />
                                <button onClick={saveElementPreset} className="bg-grn text-bg text-[10px] px-2 py-1 rounded">Save</button>
                            </div>
                            <div className="space-y-1">
                                <p className="font-bold text-muted text-[10px]">Computed Styles</p>
                                <div className="h-64 overflow-y-auto bg-bg p-2 rounded font-mono text-[10px] space-y-1">
                                    {Object.entries(selectedElement.styles).map(([key, value]) => (
                                        <div key={key} className="flex justify-between items-center group">
                                            <span className="text-acc shrink-0 w-1/3">{key}:</span>
                                            <div className="flex items-center w-2/3">
                                                <input 
                                                    className="bg-bg2 text-txt text-right flex-1 border-b border-transparent group-hover:border-acc transition-colors focus:border-acc"
                                                    value={value as string}
                                                    onChange={(e) => {
                                                        setStyleHistory([...styleHistory, selectedElement.styles]);
                                                        updateElementStyle(key, e.target.value);
                                                    }}
                                                />
                                                {key.includes('color') && (
                                                    <input 
                                                        type="color" 
                                                        className="w-4 h-4 ml-1 cursor-pointer"
                                                        value={value as string}
                                                        onChange={(e) => {
                                                            setStyleHistory([...styleHistory, selectedElement.styles]);
                                                            updateElementStyle(key, e.target.value);
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <p className="font-bold text-muted text-[10px]">Presets</p>
                                <div className="flex flex-col gap-1">
                                    {Object.entries(stylePresets).map(([p, styles]) => (
                                        <div key={p} className="flex items-center justify-between bg-bg2 p-1 rounded">
                                            <button onClick={() => loadElementPreset(p)} className="text-[10px] flex-1 text-left">{p}</button>
                                            <button onClick={() => {
                                                const newPresets = {...stylePresets};
                                                delete newPresets[p];
                                                setStylePresets(newPresets);
                                            }} className="text-[10px] text-red-500">Del</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                 )}
                 {/* Undo/Redo Toolbar */}
                 {showCode && (
                     <div className="absolute bottom-4 right-8 z-10 flex gap-2">
                         <button onClick={() => editorRef.current?.trigger('keyboard', 'undo', null)} aria-label="Undo" className="px-3 py-2 bg-bg2 hover:bg-bg3 border border-bdr hover:border-acc text-dim hover:text-txt rounded-lg transition-colors font-mono text-xs">Undo</button>
                         <button onClick={() => editorRef.current?.trigger('keyboard', 'redo', null)} aria-label="Redo" className="px-3 py-2 bg-bg2 hover:bg-bg3 border border-bdr hover:border-acc text-dim hover:text-txt rounded-lg transition-colors font-mono text-xs">Redo</button>
                     </div>
                 )}
            </div>
          </>
        ) : null}
      </div>

      {/* Chat Panel */}
      {!isLoading && creation && (
        <div className="w-full h-[30%] md:h-48 border-t border-bdr p-3 md:p-4 bg-bg2/50 flex flex-col shrink-0 z-30">
            <h4 className="text-acc font-mono text-[10px] md:text-xs uppercase tracking-widest mb-2 flex justify-between items-center">
                <span>WhisperX AI Assistant</span>
                <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer text-dim hover:text-white transition-colors">
                        <input type="checkbox" checked={isContextMode} onChange={(e) => setIsContextMode(e.target.checked)} className="accent-acc" />
                        Context Mode
                    </label>
                    <span className="text-dim">Status: {isChatLoading ? 'Processing...' : 'Idle'}</span>
                </div>
            </h4>
            <div className="flex-1 overflow-y-auto mb-2 text-[10px] md:text-xs font-mono space-y-1 p-2 bg-bg border border-bdr rounded">
                {messages.map((m, i) => (
                    <div key={i} className={`whitespace-pre-wrap ${m.role === 'system' ? 'text-red-400' : ''}`}>
                        <span className={m.role === 'user' ? 'text-acc' : m.role === 'system' ? 'text-red-500' : 'text-txt font-bold'}>
                            {m.role === 'system' ? 'error' : m.role}:
                        </span>{' '}
                        {m.text}
                    </div>
                ))}
                {isChatLoading && (
                    <div className="mt-2 space-y-2 opacity-50 animate-pulse">
                        <div className="text-acc font-bold">assistant:</div>
                        <div className="w-3/4 h-3 rounded bg-bdr relative overflow-hidden"><div className="absolute inset-0 skeleton"></div></div>
                        <div className="w-1/2 h-3 rounded bg-bdr relative overflow-hidden"><div className="absolute inset-0 skeleton"></div></div>
                        <div className="w-full h-10 mt-2 rounded bg-bg3 border border-bdr relative overflow-hidden">
                            <div className="absolute inset-0 skeleton"></div>
                            <div className="absolute top-2 left-2 text-[8px] text-txt/30">{'< /> AI Engine Working...'}</div>
                        </div>
                    </div>
                )}
            </div>
            <div className="flex gap-2">
                <input 
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    className="flex-1 input-field h-10 py-2 border-bdr text-txt text-base md:text-sm"
                    placeholder="Ask WhisperX, or e.g. 'generate a testimonial card'..."
                    onKeyDown={async (e) => {
                        if (e.key === 'Enter' && inputValue.trim()) {
                            const userMsg = inputValue;
                            let promptMsg = userMsg;
                            if (isContextMode && selectedElement) {
                                promptMsg = `[Context: Updating element <${selectedElement.tagName.toLowerCase()} ${selectedElement.id ? `id="${selectedElement.id}"` : ''} class="${selectedElement.className}">] ${userMsg}`;
                            } else if (/^(generate|create|add)\b/i.test(userMsg)) {
                                promptMsg = `${userMsg}. Please generate this UI component and add it to the best appropriate container within the current page. Ensure it matches the overall design.`;
                            }

                            setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
                            setInputValue('');
                            
                            const codeToRefine = customCode || creation?.html || '';
                            if (!codeToRefine) {
                                setMessages(prev => [...prev, { role: 'system', text: "No code available to refine. Please generate or import an applet first." }]);
                                return;
                            }

                            setMessages(prev => [...prev, { role: 'assistant', text: `Processing your request${isContextMode && selectedElement ? ' based on selected element context' : ' globally'}...` }]);
                            setIsChatLoading(true);

                            try {
                                const newCode = await refineCode(promptMsg, codeToRefine);
                                applyCodeChange(newCode);
                                if (onUpdateCreation) onUpdateCreation(newCode);
                                setMessages(prev => [...prev, { role: 'assistant', text: "Code successfully updated." }]);
                            } catch (err: any) {
                                setMessages(prev => [...prev, { role: 'system', text: err.message || "Failed to refine code." }]);
                            } finally {
                                setIsChatLoading(false);
                            }
                        }
                    }}
                />
                <button
                    onClick={async () => {
                        if (editorRef.current) {
                            const selection = editorRef.current.getSelection();
                            const model = editorRef.current.getModel();
                            let selText = "";
                            if (selection && !selection.isEmpty()) {
                                selText = model.getValueInRange(selection);
                            }
                            if (selText) {
                                const userMsg = inputValue.trim() ? inputValue : "Refine this code block";
                                const fullMsg = `${userMsg}\n\`\`\`\n${selText}\n\`\`\``;
                                setMessages(prev => [...prev, { role: 'user', text: fullMsg }]);
                                setInputValue('');
                                setMessages(prev => [...prev, { role: 'assistant', text: "Analyzing your selected code segment..." }]);
                                setIsChatLoading(true);

                                try {
                                    const newSnippet = await refineSnippet(userMsg, selText);
                                    if (editorRef.current) {
                                        editorRef.current.pushUndoStop();
                                        editorRef.current.executeEdits('ai-update-snippet', [{
                                            range: selection,
                                            text: newSnippet
                                        }]);
                                        editorRef.current.pushUndoStop();
                                        editorRef.current.setSelection(selection);
                                        const fullCode = editorRef.current.getModel().getValue();
                                        setCustomCode(fullCode);
                                        if (onUpdateCreation) onUpdateCreation(fullCode);
                                    }
                                    setMessages(prev => [...prev, { role: 'assistant', text: "Selected code snippet successfully refined and merged inline." }]);
                                } catch (err: any) {
                                    setMessages(prev => [...prev, { role: 'system', text: err.message || "Failed to refine selected code." }]);
                                } finally {
                                    setIsChatLoading(false);
                                }
                            } else {
                                setMessages(prev => [...prev, { role: 'system', text: "No code selected in the editor. Please highlight a section of code first." }]);
                            }
                        } else {
                            setMessages(prev => [...prev, { role: 'system', text: "Editor not available. Please toggle the Code Editor to select code." }]);
                        }
                    }}
                    className="px-4 py-2 btn-primary whitespace-nowrap h-10"
                >
                    ✨ Refine Selected
                </button>
                <button
                    onClick={async () => {
                        if (editorRef.current) {
                            const selection = editorRef.current.getSelection();
                            const model = editorRef.current.getModel();
                            let selText = "";
                            if (selection && !selection.isEmpty()) {
                                selText = model.getValueInRange(selection);
                            }
                            if (selText) {
                                setMessages(prev => [...prev, { role: 'user', text: `Explain this code:\n\`\`\`\n${selText}\n\`\`\`` }]);
                                setMessages(prev => [...prev, { role: 'assistant', text: "Analyzing your selected code for explanation..." }]);
                                setIsChatLoading(true);

                                try {
                                    const explanation = await explainCode(selText);
                                    setMessages(prev => [...prev, { role: 'assistant', text: explanation }]);
                                } catch (err: any) {
                                    setMessages(prev => [...prev, { role: 'system', text: err.message || "Failed to explain selected code." }]);
                                } finally {
                                    setIsChatLoading(false);
                                }
                            } else {
                                setMessages(prev => [...prev, { role: 'system', text: "No code selected in the editor. Please highlight a section of code first." }]);
                            }
                        } else {
                            setMessages(prev => [...prev, { role: 'system', text: "Editor not available. Please toggle the Code Editor to select code." }]);
                        }
                    }}
                    className="px-4 py-2 bg-bg3 text-txt border border-bdr hover:border-acc hover:text-acc rounded-xl font-mono text-xs transition-all duration-300 whitespace-nowrap h-10 shadow-[0_0_10px_rgba(255,255,255,0.05)] hover:shadow-[0_0_15px_rgba(0,242,255,0.2)]"
                >
                    💡 Explain Selected
                </button>
            </div>
        </div>
      )}

      </div>
      </div>
    </div>
  );
};
