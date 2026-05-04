/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect, useState, useRef } from 'react';
import { ArrowDownTrayIcon, PlusIcon, ViewColumnsIcon, DocumentIcon, CodeBracketIcon, XMarkIcon, ArrowsPointingOutIcon, MagnifyingGlassPlusIcon, MagnifyingGlassMinusIcon } from '@heroicons/react/24/outline';
import { Creation } from './CreationHistory';

interface LivePreviewProps {
  creation: Creation | null;
  isLoading: boolean;
  uploadProgress: number;
  isFocused: boolean;
  onReset: () => void;
}

declare global { interface Window { pdfjsLib?: any; } }

const LoadingStep = ({ text, active, completed }: { text: string; active: boolean; completed: boolean }) => (
  <div className={`flex items-center space-x-3 transition-all duration-500 ${active || completed ? 'opacity-100' : 'opacity-30'}`}>
    <div className={`w-4 h-4 ${completed ? 'text-green-400' : active ? 'text-blue-400' : 'text-zinc-700'}`}>
      {completed ? '✓' : active ? '•' : '·'}
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

  if (error) return <div className="text-red-400 text-sm p-6">{error}</div>;
  return <canvas ref={canvasRef} className="max-w-full max-h-full object-contain rounded border border-zinc-800/50" />;
};

export const LivePreview: React.FC<LivePreviewProps> = ({ creation, isLoading, uploadProgress, isFocused, onReset }) => {
  const [loadingStep, setLoadingStep] = useState(0);
  const [showSplitView, setShowSplitView] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!isLoading) {
      setLoadingStep(0);
      return;
    }
    const interval = setInterval(() => setLoadingStep((prev) => (prev < 3 ? prev + 1 : prev)), 1600);
    return () => clearInterval(interval);
  }, [isLoading]);

  useEffect(() => setShowSplitView(Boolean(creation?.originalImage)), [creation]);
  useEffect(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, [creation?.id]);

  const handleDownloadAsHtml = () => {
    if (!creation) return;
    const blob = new Blob([creation.html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${creation.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = () => {
    if (!creation) return;
    const blob = new Blob([JSON.stringify(creation, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${creation.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_artifact.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onPanStart = (e: React.MouseEvent<HTMLDivElement>) => {
    if (zoom <= 1) return;
    setIsPanning(true);
    panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  return (
    <div className={`fixed z-40 flex flex-col rounded-lg overflow-hidden border border-zinc-800 bg-[#0E0E10] shadow-2xl transition-all duration-700 ${isFocused ? 'inset-2 md:inset-4 opacity-100 scale-100' : 'top-1/2 left-1/2 w-[90%] h-[60%] -translate-x-1/2 -translate-y-1/2 opacity-0 scale-95 pointer-events-none'}`}>
      <div className="bg-[#121214] px-4 py-3 flex items-center justify-between border-b border-zinc-800 shrink-0">
        <button onClick={onReset} className="w-6 h-6 rounded bg-zinc-700 hover:bg-red-600 flex items-center justify-center"><XMarkIcon className="w-4 h-4 text-black" /></button>
        <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">{isLoading ? 'System Processing...' : creation?.name ?? 'Preview Mode'}</span>
        {!isLoading && creation ? <div className="flex items-center gap-1">{creation.originalImage && <button onClick={() => setShowSplitView((v) => !v)} className="p-1.5 text-zinc-500 hover:text-zinc-200"><ViewColumnsIcon className="w-4 h-4" /></button>}<button onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))} className="p-1.5 text-zinc-500 hover:text-zinc-200"><MagnifyingGlassMinusIcon className="w-4 h-4" /></button><button onClick={() => setZoom((z) => Math.min(2.5, z + 0.1))} className="p-1.5 text-zinc-500 hover:text-zinc-200"><MagnifyingGlassPlusIcon className="w-4 h-4" /></button><button onClick={() => document.documentElement.requestFullscreen?.()} className="p-1.5 text-zinc-500 hover:text-zinc-200"><ArrowsPointingOutIcon className="w-4 h-4" /></button><button onClick={handleDownloadAsHtml} className="p-1.5 text-zinc-500 hover:text-zinc-200"><DocumentIcon className="w-4 h-4" /></button><button onClick={handleExport} className="p-1.5 text-zinc-500 hover:text-zinc-200"><ArrowDownTrayIcon className="w-4 h-4" /></button><button onClick={onReset} className="ml-2 flex items-center space-x-1 text-xs font-bold bg-white text-black px-3 py-1.5 rounded-md"><PlusIcon className="w-3 h-3" /><span>New</span></button></div> : <CodeBracketIcon className="w-4 h-4 text-zinc-600" />}
      </div>
      <div className="relative w-full flex-1 bg-[#09090b] flex overflow-hidden">
        {isLoading ? <div className="w-full h-full flex flex-col items-center justify-center gap-3"><p className="text-zinc-300 font-mono">{uploadProgress > 0 && uploadProgress < 100 ? `Uploading: ${uploadProgress}%` : 'Constructing Environment'}</p><div className="space-y-1"><LoadingStep text="Analyzing inputs" active={loadingStep===0} completed={loadingStep>0}/><LoadingStep text="Identifying patterns" active={loadingStep===1} completed={loadingStep>1}/><LoadingStep text="Generating logic" active={loadingStep===2} completed={loadingStep>2}/><LoadingStep text="Compiling preview" active={loadingStep===3} completed={false}/></div></div> : creation?.html ? <>
          {showSplitView && creation.originalImage && <div className="w-full md:w-1/2 h-1/2 md:h-full border-r border-zinc-800 p-3 flex items-center justify-center">{creation.originalImage.startsWith('data:application/pdf') ? <PdfRenderer dataUrl={creation.originalImage} /> : <img src={creation.originalImage} alt="Original Input" className="w-full h-full object-contain" />}</div>}
          <div className={`relative overflow-hidden ${showSplitView && creation.originalImage ? 'w-full md:w-1/2 h-1/2 md:h-full' : 'w-full'}`} onMouseDown={onPanStart} onMouseMove={(e) => isPanning && setPan({ x: e.clientX - panStartRef.current.x, y: e.clientY - panStartRef.current.y })} onMouseUp={() => setIsPanning(false)} onMouseLeave={() => setIsPanning(false)}>
            <div className="w-full h-full transition-transform duration-200" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, cursor: zoom > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default' }}>
              <iframe title="Gemini Live Preview" srcDoc={creation.html} className="w-full h-full" sandbox="allow-scripts allow-forms allow-popups allow-modals allow-same-origin" />
            </div>
          </div>
        </> : null}
      </div>
    </div>
  );
};
