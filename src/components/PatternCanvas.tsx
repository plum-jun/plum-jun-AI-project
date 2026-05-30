/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from 'react';
import { 
  Ruler, RefreshCw, ZoomIn, Eye, EyeOff, 
  HelpCircle, Sparkles, AlertCircle, Maximize, Move
} from 'lucide-react';
import { CalibrationSettings, BodyProfile, ContrastTheme, PatternLayer } from '../types';
import { generateGarmentPattern, PatternPath } from '../utils/patternEngine';
import { getPerspectiveMatrix3d } from '../utils/homography';
import { I18N_DICTS } from '../utils/i18n';

// Parse PDF imports
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

interface PatternCanvasProps {
  patternType: 'tshirt' | 'skirt' | 'pants' | 'vest' | 'uploaded';
  profile: BodyProfile;
  calibration: CalibrationSettings;
  layers: PatternLayer[];
  seamAllowance: number;
  easeAllowance: number;
  pdfFile: File | null;
  uploadedPdfPage: number;
  onPdfLoaded: (pageCount: number) => void;
  uploadedImageSrc: string | null;
  lang: 'zh' | 'en' | 'ru';
  onCalibrationChange: (chgs: Partial<CalibrationSettings>) => void;
  activeCornerIndex: number | null;
  onActiveCornerIndexChange: (idx: number | null) => void;
}

export default function PatternCanvas({
  patternType,
  profile,
  calibration,
  layers,
  seamAllowance,
  easeAllowance,
  pdfFile,
  uploadedPdfPage,
  onPdfLoaded,
  uploadedImageSrc,
  lang,
  onCalibrationChange,
  activeCornerIndex,
  onActiveCornerIndexChange
}: PatternCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const t = I18N_DICTS[lang];

  const [pdfRendered, setPdfRendered] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Measure tape tool
  const [measurementPoints, setMeasurementPoints] = useState<{ x: number; y: number }[]>([]);
  const [measurementDistance, setMeasurementDistance] = useState<number | null>(null);
  const [tapeMode, setTapeMode] = useState(false);

  // Active dragged corner pointer tracker
  const [draggedCornerIndex, setDraggedCornerIndex] = useState<number | null>(null);
  const [draggedTarget, setDraggedTarget] = useState<'projector' | 'image' | null>(null);

  // State to store custom SVG guidelines
  const [guidelines, setGuidelines] = useState<{ id: string; x1: number; y1: number; x2: number; y2: number }[]>([]);
  const [drawingGuide, setDrawingGuide] = useState<{ x: number; y: number } | null>(null);

  // Default coordinate references
  const w = 1500;
  const h = 1000;

  // Active perspective points mapping
  const corners = calibration.perspectiveCorners || [0, 0, w, 0, w, h, 0, h];
  const imgCorners = calibration.imageCorners || [0, 0, w, 0, w, h, 0, h];

  // Generate Net and Seam garments vectors (in mm space)
  const patternInstance = generateGarmentPattern(
    patternType === 'uploaded' ? 'tshirt' : patternType,
    profile,
    seamAllowance,
    easeAllowance
  );

  // Configure pdfjs worker dynamically with fallback to unpkg / cdnjs CDN for guaranteed mime-type serving
  useEffect(() => {
    try {
      const version = pdfjsLib.version || '5.7.284';
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.mjs`;
    } catch (_) {
      try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
      } catch (err) {
        console.warn('PDFjs worker setup issue:', err);
      }
    }
  }, []);

  // Keyboard Arrow key nudges for selected corner matching patternprojector
  useEffect(() => {
    const isProjectorActive = !!calibration.cornersModeOn;
    const isImageActive = !!calibration.imageCornersModeOn;
    if ((!isProjectorActive && !isImageActive) || activeCornerIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        let dx = 0;
        let dy = 0;

        if (e.key === 'ArrowLeft') dx = -step;
        else if (e.key === 'ArrowRight') dx = step;
        else if (e.key === 'ArrowUp') dy = -step;
        else if (e.key === 'ArrowDown') dy = step;

        if (isProjectorActive) {
          const nextPoints = [...corners] as [number, number, number, number, number, number, number, number];
          nextPoints[activeCornerIndex * 2] = Math.max(-200, Math.min(w + 200, nextPoints[activeCornerIndex * 2] + dx));
          nextPoints[activeCornerIndex * 2 + 1] = Math.max(-200, Math.min(h + 200, nextPoints[activeCornerIndex * 2 + 1] + dy));
          onCalibrationChange({ perspectiveCorners: nextPoints });
        } else if (isImageActive) {
          const nextPoints = [...imgCorners] as [number, number, number, number, number, number, number, number];
          nextPoints[activeCornerIndex * 2] = Math.max(-200, Math.min(w + 200, nextPoints[activeCornerIndex * 2] + dx));
          nextPoints[activeCornerIndex * 2 + 1] = Math.max(-200, Math.min(h + 200, nextPoints[activeCornerIndex * 2 + 1] + dy));
          onCalibrationChange({ imageCorners: nextPoints });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [calibration.cornersModeOn, calibration.imageCornersModeOn, activeCornerIndex, corners, imgCorners, onCalibrationChange]);

  // PDF Page Renderer (Renders user uploaded PDF patterns onto canvas coordinate system)
  useEffect(() => {
    if (patternType !== 'uploaded' || !pdfFile) {
      setPdfRendered(false);
      return;
    }

    let isSubscribed = true;
    const renderPdf = async () => {
      setPdfLoading(true);
      setPdfError(null);
      try {
        const fileReader = new FileReader();
        fileReader.onload = async (e) => {
          if (!e.target?.result || !isSubscribed) return;
          try {
            const typedArray = new Uint8Array(e.target.result as ArrayBuffer);
            
            const version = pdfjsLib.version || '5.7.284';
            const loadingTask = pdfjsLib.getDocument({
              data: typedArray,
              cMapUrl: `https://unpkg.com/pdfjs-dist@${version}/cmaps/`,
              cMapPacked: true,
              standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${version}/standard_fonts/`
            });
            
            const pdf = await loadingTask.promise;
            
            if (isSubscribed) {
              onPdfLoaded(pdf.numPages);
            }

            const currPage = Math.min(pdf.numPages, Math.max(1, uploadedPdfPage));
            const page = await pdf.getPage(currPage);
            
            if (!isSubscribed) return;

            const canvas = pdfCanvasRef.current;
            if (!canvas) return;

            const context = canvas.getContext('2d');
            if (!context) return;

            const scaleFactor = 1.8;
            const viewport = page.getViewport({ scale: scaleFactor });

            canvas.width = viewport.width;
            canvas.height = viewport.height;

            const renderContext = {
              canvasContext: context,
              viewport: viewport
            } as any;

            await page.render(renderContext).promise;
            if (isSubscribed) {
              setPdfRendered(true);
              setPdfLoading(false);
            }
          } catch (err: any) {
            console.error('Inner PDF render failed', err);
            if (isSubscribed) {
              setPdfError(`解析PDF图样时出错: ${err.message || '格式不支持'}`);
              setPdfLoading(false);
            }
          }
        };
        fileReader.readAsArrayBuffer(pdfFile);
      } catch (outerErr: any) {
        console.error('Outer PDF load error', outerErr);
        if (isSubscribed) {
          setPdfError('加载PDF文件资源失败。');
          setPdfLoading(false);
        }
      }
    };

    renderPdf();

    return () => {
      isSubscribed = false;
    };
  }, [pdfFile, patternType, uploadedPdfPage, onPdfLoaded]);

  // Handle click on canvas for custom measurement ribbons and guidelines
  const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (draggedCornerIndex !== null || calibration.cornersModeOn) {
      return; // prevent conflicts during homography corner calibration
    }
    if (!containerRef.current) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Convert pixel inputs back to relative canvas coordinate system
    const mmX = (clickX / rect.width) * w;
    const mmY = (clickY / rect.height) * h;

    if (tapeMode) {
      if (measurementPoints.length >= 2) {
        setMeasurementPoints([{ x: mmX, y: mmY }]);
        setMeasurementDistance(null);
      } else {
        const newPoints = [...measurementPoints, { x: mmX, y: mmY }];
        setMeasurementPoints(newPoints);
        
        if (newPoints.length === 2) {
          const dx = newPoints[1].x - newPoints[0].x;
          const dy = newPoints[1].y - newPoints[0].y;
          const distMm = Math.sqrt(dx * dx + dy * dy);
          setMeasurementDistance(distMm);
        }
      }
    }
  };

  // Pointer movement tracking for four-corner dragging
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (draggedCornerIndex === null || !draggedTarget) return;
    if (!svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    // Convert relative drag pixels inside SVG back to mathematically sound boundaries
    const canvasX = Math.round((clientX / rect.width) * w);
    const canvasY = Math.round((clientY / rect.height) * h);

    const boundedX = Math.max(-100, Math.min(w + 100, canvasX));
    const boundedY = Math.max(-100, Math.min(h + 100, canvasY));

    if (draggedTarget === 'projector') {
      const nextPoints = [...corners] as [number, number, number, number, number, number, number, number];
      nextPoints[draggedCornerIndex * 2] = boundedX;
      nextPoints[draggedCornerIndex * 2 + 1] = boundedY;
      onCalibrationChange({ perspectiveCorners: nextPoints });
    } else if (draggedTarget === 'image') {
      const nextPoints = [...imgCorners] as [number, number, number, number, number, number, number, number];
      nextPoints[draggedCornerIndex * 2] = boundedX;
      nextPoints[draggedCornerIndex * 2 + 1] = boundedY;
      onCalibrationChange({ imageCorners: nextPoints });
    }
  };

  const handlePointerUpOrLeave = () => {
    if (draggedCornerIndex !== null) {
      setDraggedCornerIndex(null);
      setDraggedTarget(null);
    }
  };

  const getThemeClasses = (theme: ContrastTheme) => {
    switch (theme) {
      case 'neon-green':
        return {
          bg: 'bg-black',
          gridStroke: 'rgba(16, 185, 129, 0.15)',
          guidelineColor: '#059669',
          textColor: 'text-green-400',
          svgStroke: '#10b981',
          gridAxisStroke: 'rgba(16, 185, 129, 0.4)'
        };
      case 'neon-red':
        return {
          bg: 'bg-black',
          gridStroke: 'rgba(239, 68, 68, 0.15)',
          guidelineColor: '#dc2626',
          textColor: 'text-red-500',
          svgStroke: '#f43f5e',
          gridAxisStroke: 'rgba(239, 68, 68, 0.4)'
        };
      case 'neon-yellow':
        return {
          bg: 'bg-black',
          gridStroke: 'rgba(234, 179, 8, 0.15)',
          guidelineColor: '#ca8a04',
          textColor: 'text-yellow-400',
          svgStroke: '#eab308',
          gridAxisStroke: 'rgba(234, 179, 8, 0.4)'
        };
      case 'blueprint':
        return {
          bg: 'bg-blue-950',
          gridStroke: 'rgba(56, 189, 248, 0.15)',
          guidelineColor: '#0284c7',
          textColor: 'text-blue-100',
          svgStroke: '#93c5fd',
          gridAxisStroke: 'rgba(56, 189, 248, 0.4)'
        };
      case 'classic':
      default:
        return {
          bg: 'bg-white',
          gridStroke: 'rgba(156, 163, 175, 0.2)',
          guidelineColor: '#4b5563',
          textColor: 'text-gray-900',
          svgStroke: '#1f2937',
          gridAxisStroke: 'rgba(107, 114, 128, 0.5)'
        };
    }
  };

  const themeConfig = getThemeClasses(calibration.theme);

  // Generate alignment measurement grids dynamically
  const generateGridElements = () => {
    if (!calibration.gridOn && !calibration.cornersModeOn) return null;

    const step = calibration.gridInterval;
    const gridPaths: string[] = [];

    // Vertical gridlines
    for (let x = 0; x <= w; x += step) {
      gridPaths.push(`M ${x} 0 L ${x} ${h}`);
    }
    // Horizontal gridlines
    for (let y = 0; y <= h; y += step) {
      gridPaths.push(`M 0 ${y} L ${w} ${y}`);
    }

    const labelsToDraw: { x: number; y: number; text: string; fontSize: number }[] = [];

    if (calibration.gridUnit === 'inch') {
      // Draw standard inch dimensions like in the user's attachment (centered beautifully on background)
      labelsToDraw.push({
        x: w / 2,
        y: h - 160,
        text: '24in',
        fontSize: 34
      });
      labelsToDraw.push({
        x: 180,
        y: h / 2,
        text: '16in',
        fontSize: 34
      });
    } else {
      // Draw metric labels matching standard CM grid layouts
      labelsToDraw.push({
        x: w / 2,
        y: h - 160,
        text: '60cm',
        fontSize: 34
      });
      labelsToDraw.push({
        x: 184,
        y: h / 2,
        text: '40cm',
        fontSize: 34
      });
    }

    // Include step coordinates markings along the top and left axes
    const coordinateLabels: { x: number; y: number; text: string; anchor: string }[] = [];
    if (calibration.gridUnit === 'inch') {
      for (let x = step * 2; x < w; x += step * 2) {
        const inches = Math.round(x / 25.4);
        coordinateLabels.push({ x, y: 22, text: `${inches}"`, anchor: 'middle' });
      }
      for (let y = step * 2; y < h; y += step * 2) {
        const inches = Math.round(y / 25.4);
        coordinateLabels.push({ x: 18, y: y + 4, text: `${inches}"`, anchor: 'start' });
      }
    } else {
      for (let x = step * 2; x < w; x += step * 2) {
        const cm = Math.round(x / 10);
        coordinateLabels.push({ x, y: 22, text: `${cm}cm`, anchor: 'middle' });
      }
      for (let y = step * 2; y < h; y += step * 2) {
        const cm = Math.round(y / 10);
        coordinateLabels.push({ x: 18, y: y + 4, text: `${cm}cm`, anchor: 'start' });
      }
    }

    return (
      <g stroke={themeConfig.gridStroke} strokeWidth={0.8}>
        {/* Alignment main lines */}
        <path d={gridPaths.join(' ')} strokeDasharray="3,3" />
        {/* Outer boundary box */}
        <rect x={0} y={0} width={w} height={h} fill="none" stroke={themeConfig.gridAxisStroke} strokeWidth={1.5} />
        {/* Major Grid Axes */}
        <line x1={0} y1={0} x2={w} y2={0} stroke={themeConfig.gridAxisStroke} strokeWidth={2.5} />
        <line x1={0} y1={0} x2={0} y2={h} stroke={themeConfig.gridAxisStroke} strokeWidth={2.5} />

        {/* Major calibration size labels (e.g. 24in, 16in overlay like attachment) */}
        {labelsToDraw.map((lbl, idx) => (
          <text
            key={`major-${idx}`}
            x={lbl.x}
            y={lbl.y}
            fill={themeConfig.svgStroke}
            fontSize={lbl.fontSize}
            fontWeight="bold"
            textAnchor="middle"
            opacity={0.35}
            className="font-sans tracking-widest select-none pointer-events-none"
          >
            {lbl.text}
          </text>
        ))}

        {/* Axis tick markings */}
        {coordinateLabels.map((tick, idx) => (
          <text
            key={`tick-${idx}`}
            x={tick.x}
            y={tick.y}
            fill={themeConfig.svgStroke}
            fontSize={11}
            fontWeight="700"
            textAnchor={tick.anchor}
            opacity={0.5}
            className="font-mono select-none pointer-events-none"
          >
            {tick.text}
          </text>
        ))}
      </g>
    );
  };

  const activeLayers = new Set(layers.filter(l => l.visible).map(l => l.id));

  // Outer perspective calibration style
  const outerMatrixStyle: React.CSSProperties = {
    width: `${w}px`,
    height: `${h}px`,
    position: 'relative',
    transformOrigin: 'top left',
    transition: draggedCornerIndex !== null ? 'none' : 'transform 0.1s ease-out',
    // This correctly warps the entire viewport to correct the projector angle misalignment (Keystone Warp)
    transform: `${getPerspectiveMatrix3d(w, h, corners)}`,
  };

  // Inner translate, rotate, scale offset styling for loaded garments / files
  const innerPatternStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: `${w}px`,
    height: `${h}px`,
    transformOrigin: 'top left',
    transform: `
      translate(${calibration.offsetX}px, ${calibration.offsetY}px)
      scale(${calibration.scale})
      rotate(${calibration.rotation}deg)
      scaleX(${calibration.flipX ? -1 : 1})
      scaleY(${calibration.flipY ? -1 : 1})
      skewX(${calibration.keystoneX * 25}deg)
      skewY(${calibration.keystoneY * 25}deg)
    `,
  };

  // Dynamic 4-corner perspective warp styling applied purely to the imported paper pattern image or custom canvas
  const imageWarpStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: `${w}px`,
    height: `${h}px`,
    transformOrigin: 'top left',
    transform: `${getPerspectiveMatrix3d(w, h, imgCorners)}`,
    pointerEvents: 'none',
  };

  // Corner definitions
  const cornerLabels = ['TL', 'TR', 'BR', 'BL'];
  const cornerLabelsText = [
    lang === 'zh' ? '左上' : 'TL',
    lang === 'zh' ? '右上' : 'TR',
    lang === 'zh' ? '右下' : 'BR',
    lang === 'zh' ? '左下' : 'BL'
  ];

  const fitClass = calibration.imageFit === 'contain' ? 'object-contain' : 'object-fill';

  return (
    <div 
      id="projection-master-viewport" 
      className="relative flex-1 flex flex-col h-full bg-neutral-900 rounded-2xl border border-gray-800 overflow-hidden shadow-2xl select-none"
      ref={containerRef}
    >
      
      {/* Top status flags & micro UI panel */}
      <div className="absolute top-3 left-3 right-3 z-30 flex items-center justify-between pointer-events-none">
        
        {/* Status markers */}
        <div className="flex gap-1.5 pointer-events-auto">
          <span className="flex items-center gap-1.5 text-[10px] bg-gray-950/85 text-emerald-400 font-mono px-2 py-1 rounded-full border border-emerald-950 shadow-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            {t.projection_status}: {calibration.theme === 'classic' ? t.theme_bright : t.theme_dark}
          </span>
          {patternType === 'uploaded' && (
            <span className="text-[10px] bg-gray-950/85 text-indigo-300 px-2 py-1 rounded-full border border-indigo-950 shadow-lg">
              {t.pdf_loaded}: {pdfFile ? pdfFile.name : uploadedImageSrc ? t.custom_img : t.pdf_empty} {pdfFile ? `(Page ${uploadedPdfPage})` : ''}
            </span>
          )}
          {calibration.cornersModeOn && (
            <span className="text-[10px] bg-pink-950/90 text-pink-300 px-2 py-1 rounded-full border border-pink-900/40 animate-pulse shadow-lg flex items-center gap-1">
              <Maximize className="w-3 h-3 text-pink-400" />
              {t.corners_btn}
            </span>
          )}
          {calibration.imageCornersModeOn && (
            <span className="text-[10px] bg-cyan-950/90 text-cyan-300 px-2 py-1 rounded-full border border-cyan-900/40 animate-pulse shadow-lg flex items-center gap-1 animate-fade-in">
              <Maximize className="w-3 h-3 text-cyan-450" />
              {lang === 'zh' ? '校正图纸中' : 'Rectifying Image'}
            </span>
          )}
        </div>

        {/* Dynamic distance/annotation toolsets */}
        <div className="flex gap-2 pointer-events-auto">
          {measurementDistance !== null && (
            <div className="flex items-center gap-1.5 text-xs bg-amber-900/95 text-amber-100 border border-amber-800 px-2.5 py-1 rounded-lg shadow-xl animate-fade-in">
              <Ruler className="w-3.5 h-3.5 text-amber-300" />
              <span>{t.measurement_dist}: <strong>{measurementDistance.toFixed(1)} mm</strong> ({(measurementDistance / 10).toFixed(1)} cm)</span>
              <button 
                onClick={() => { setMeasurementPoints([]); setMeasurementDistance(null); }}
                className="text-[9px] bg-amber-950 px-1 rounded hover:bg-amber-850 transition"
              >
                X
              </button>
            </div>
          )}

          <button
            onClick={() => setTapeMode(!tapeMode)}
            className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg shadow-md transition ${
              tapeMode 
                ? 'bg-amber-600 text-white font-medium hover:bg-amber-500' 
                : 'bg-gray-950/85 text-gray-300 hover:text-white hover:bg-gray-900 border border-gray-800'
            }`}
            title="Click two points to measure real pixels distance"
          >
            <Ruler className="w-3.5 h-3.5" />
            {tapeMode ? t.tape_help_active : t.measure_tape}
          </button>

          <button
            onClick={() => {
              setGuidelines([]);
              setDrawingGuide(null);
              setMeasurementPoints([]);
              setMeasurementDistance(null);
              // reset to default rect boundary corners
              onCalibrationChange({ 
                perspectiveCorners: [0, 0, w, 0, w, h, 0, h],
                cornersModeOn: false
              });
            }}
            className="flex items-center gap-1 text-xs bg-gray-950/85 text-gray-400 hover:text-white px-2.5 py-1 rounded-lg hover:bg-gray-900 border border-gray-800 transition shadow-md"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {t.reset_board}
          </button>
        </div>
      </div>

      {/* RENDER DOCK AREA */}
      <div className={`flex-1 overflow-hidden cursor-crosshair relative ${themeConfig.bg} select-none transition-colors duration-200 flex items-center justify-center`}>
        
        {pdfLoading && (
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col justify-center items-center gap-2 z-50">
            <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
            <span className="text-sm text-gray-200 font-medium">解析 PDF 矢量白模中...</span>
          </div>
        )}

        {pdfError && (
          <div className="absolute inset-5 bg-red-950/10 backdrop-blur border border-red-900/20 rounded-xl p-4 flex flex-col justify-center items-center gap-2 z-50 max-w-sm mx-auto my-auto h-fit shadow-xl">
            <AlertCircle className="w-8 h-8 text-red-500" />
            <span className="text-xs text-red-200 font-semibold text-center leading-normal">{pdfError}</span>
          </div>
        )}

        {/* Outer Scale Viewport Wrapper that dynamically maps centered within workspace */}
        <div 
          id="calibration-warped-container" 
          style={outerMatrixStyle}
          className="absolute origin-top-left"
        >
          {/* 1. Transformable Pattern & Image Content Layer */}
          <div
            id="inner-pattern-content"
            style={innerPatternStyle}
            className="absolute inset-0"
          >
            {/* Wrapper for uploaded image/PDF that applies specific image corner keystone warp */}
            <div style={imageWarpStyle} className="absolute inset-0 pointer-events-none z-0">
              {/* Mainstream Image Formats Layer: JPEG, PNG, BMP, etc. (Centered and fully contained) */}
              {patternType === 'uploaded' && uploadedImageSrc && (
                <img
                  src={uploadedImageSrc}
                  alt="Uploaded Pattern Sheet"
                  className={`absolute inset-0 w-full h-full ${fitClass} pointer-events-none transition brightness-105 ${
                    calibration.theme !== 'classic' ? 'invert hue-rotate-180 brightness-110 contrast-125' : ''
                  }`}
                  referrerPolicy="no-referrer"
                />
              )}

              {/* Embedded PDF Canvas (Renders parsed layered vectors) */}
              {patternType === 'uploaded' && pdfFile && (
                <canvas
                  ref={pdfCanvasRef}
                  className={`absolute inset-0 w-full h-full ${fitClass} origin-top-left pointer-events-none transition opacity-90 ${
                    calibration.theme !== 'classic' ? 'invert hue-rotate-180 brightness-110 contrast-125' : ''
                  }`}
                />
              )}
            </div>

            {/* SVG for garment outline drawings, annotations, guidelines and custom measurements */}
            <svg
              id="pattern-overlay-svg"
              className="absolute inset-0 w-full h-full z-10 pointer-events-auto"
              viewBox={`0 0 ${w} ${h}`}
              onClick={handleCanvasClick}
            >
              {/* 2. Boundary Calibration Box (10cm Grid Box) */}
              {activeLayers.has('calibration') && patternInstance.paths
                .filter(p => p.layerId === 'calibration')
                .map((p) => (
                  <path
                    key={p.id}
                    d={p.d}
                    fill="none"
                    stroke={themeConfig.svgStroke}
                    strokeWidth={2}
                    className="stroke-dasharray-none border-dashed transition-all"
                  />
                ))}

              {/* 3. Outer Seam and Net stitches outlines */}
              {patternInstance.paths
                .filter(p => p.layerId !== 'calibration')
                .map((p) => {
                  const isNet = p.layerId === 'net';
                  const isSeam = p.layerId === 'seam';
                  const layerVisible = (isNet && activeLayers.has('net')) || (isSeam && activeLayers.has('seam'));

                  if (!layerVisible) return null;

                  return (
                    <path
                      key={p.id}
                      d={p.d}
                      fill="none"
                      stroke={isNet ? '#3b82f6' : themeConfig.svgStroke}
                      strokeWidth={isNet ? 1.5 : 2.5}
                      strokeDasharray={isNet ? '4,4' : 'none'}
                      className="transition-all"
                    />
                  );
                })}

              {/* 4. Annotations and sizing coordinates */}
              {patternInstance.paths.map((p) => {
                if (!p.label || !p.labelPos) return null;
                const isNet = p.layerId === 'net';
                const isCalibration = p.layerId === 'calibration';
                
                if (isNet && !activeLayers.has('net')) return null;
                if (isCalibration && !activeLayers.has('calibration')) return null;

                return (
                  <text
                    key={`text-${p.id}`}
                    x={p.labelPos.x}
                    y={p.labelPos.y}
                    fill={isNet ? '#3b82f6' : themeConfig.svgStroke}
                    fontSize={isCalibration ? 11 : 12}
                    fontWeight={isCalibration ? '400' : '600'}
                    textAnchor="middle"
                    className="select-none font-mono tracking-wide"
                  >
                    {p.label}
                  </text>
                );
              })}

              {/* 5. Custom layout guidelines */}
              {guidelines.map((g) => (
                <line
                  key={g.id}
                  x1={g.x1}
                  y1={g.y1}
                  x2={g.x2}
                  y2={g.y2}
                  stroke="#ec4899"
                  strokeWidth={2}
                  strokeDasharray="4,2"
                />
              ))}

              {drawingGuide && (
                <circle cx={drawingGuide.x} cy={drawingGuide.y} r={4} fill="#ec4899" />
              )}

              {/* 6. Measured tape distance markers */}
              {measurementPoints.map((pt, i) => (
                <circle key={i} cx={pt.x} cy={pt.y} r={6} fill="#f59e0b" className="animate-ping" />
              ))}
              {measurementPoints.length === 2 && (
                <g>
                  <line
                    x1={measurementPoints[0].x}
                    y1={measurementPoints[0].y}
                    x2={measurementPoints[1].x}
                    y2={measurementPoints[1].y}
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                  />
                  <rect
                    x={(measurementPoints[0].x + measurementPoints[1].x) / 2 - 40}
                    y={(measurementPoints[0].y + measurementPoints[1].y) / 2 - 10}
                    width="80"
                    height="20"
                    rx="4"
                    fill="#78350f"
                    stroke="#d97706"
                    strokeWidth="1"
                  />
                  <text
                    x={(measurementPoints[0].x + measurementPoints[1].x) / 2}
                    y={(measurementPoints[0].y + measurementPoints[1].y) / 2 + 4}
                    fill="#fef3c7"
                    fontSize="10"
                    textAnchor="middle"
                    className="font-mono font-semibold"
                  >
                    {measurementDistance ? `${measurementDistance.toFixed(0)}mm` : ''}
                  </text>
                </g>
              )}
            </svg>
          </div>

          {/* 2. Warped Alignment Grid Sub-Layer (Warped dynamically with projector keystone transform) */}
          {(calibration.gridOn || calibration.cornersModeOn) && (
            <svg
              id="projector-grid-warped-svg"
              className="absolute inset-0 w-full h-full pointer-events-none z-20"
              viewBox={`0 0 ${w} ${h}`}
            >
              {generateGridElements()}
            </svg>
          )}
        </div>

        {/* 3. Unwarped Flat Overlay for calibration handles (Keeps dragging 100% stable with no perspective-skewing drift) */}
        {(calibration.cornersModeOn || calibration.imageCornersModeOn) && (
          <svg
            ref={svgRef}
            id="calibration-handles-unwarped-svg"
            className="absolute inset-0 w-full h-full pointer-events-auto z-40 transition-none"
            viewBox={`0 0 ${w} ${h}`}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUpOrLeave}
            onPointerLeave={handlePointerUpOrLeave}
          >
            {calibration.cornersModeOn && (
              <g id="homography-handles-overlay">
                {/* Visual outlines connecting our corners */}
                <line x1={corners[0]} y1={corners[1]} x2={corners[2]} y2={corners[3]} stroke="#ec4899" strokeWidth={1.5} strokeDasharray="3,3" />
                <line x1={corners[2]} y1={corners[3]} x2={corners[4]} y2={corners[4 + 1]} stroke="#ec4899" strokeWidth={1.5} strokeDasharray="3,3" />
                <line x1={corners[4]} y1={corners[4 + 1]} x2={corners[6]} y2={corners[7]} stroke="#ec4899" strokeWidth={1.5} strokeDasharray="3,3" />
                <line x1={corners[6]} y1={corners[7]} x2={corners[0]} y2={corners[1]} stroke="#ec4899" strokeWidth={1.5} strokeDasharray="3,3" />

                {[0, 1, 2, 3].map((idx) => {
                  const cx = corners[idx * 2];
                  const cy = corners[idx * 2 + 1];
                  const isHoveredOrDragged = draggedCornerIndex === idx && draggedTarget === 'projector';
                  const isActiveCorner = activeCornerIndex === idx;

                  return (
                    <g 
                      key={`proj-handle-${idx}`} 
                      className="cursor-move group pointer-events-auto"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setDraggedCornerIndex(idx);
                        setDraggedTarget('projector');
                        onActiveCornerIndexChange(idx);
                      }}
                    >
                      {/* Generous touch target */}
                      <circle 
                        cx={cx} 
                        cy={cy} 
                        r={32} 
                        fill="transparent" 
                        className="pointer-events-auto"
                      />
                      {/* Active highlight ring focus */}
                      {isActiveCorner && (
                        <circle 
                          cx={cx} 
                          cy={cy} 
                          r={18} 
                          fill="none" 
                          stroke="#fbbf24" 
                          strokeWidth={2}
                          strokeDasharray="3,3"
                          className="animate-pulse"
                        />
                      )}
                      {/* Glowing background */}
                      <circle 
                        cx={cx} 
                        cy={cy} 
                        r={isHoveredOrDragged ? 14 : 9} 
                        fill="#ec4899" 
                        fillOpacity={0.35} 
                        className="transition-all duration-150 animate-pulse"
                      />
                      {/* Solid inner center knob */}
                      <circle 
                        cx={cx} 
                        cy={cy} 
                        r={isHoveredOrDragged ? 8 : 5} 
                        fill="#f43f5e" 
                        stroke="#ffffff" 
                        strokeWidth={1.5} 
                        className="transition-all duration-150"
                      />
                      {/* Handle badge indicators */}
                      <g transform={`translate(${cx + 14}, ${cy - 12})`}>
                        <rect 
                          width="24" 
                          height="14" 
                          rx="3" 
                          fill="#111827" 
                          stroke={isActiveCorner ? "#fbbf24" : "#ec4899"} 
                          strokeWidth="1" 
                        />
                        <text 
                          x="12" 
                          y="10" 
                          fill={isActiveCorner ? "#fbbf24" : "#f472b6"} 
                          fontSize="8" 
                          fontWeight="bold"
                          textAnchor="middle" 
                          className="font-mono text-center"
                        >
                          {cornerLabelsText[idx]}
                        </text>
                      </g>
                    </g>
                  );
                })}
              </g>
            )}

            {calibration.imageCornersModeOn && (
              <g id="image-warp-handles-overlay">
                {/* Visual outlines connecting our image corners */}
                <line x1={imgCorners[0]} y1={imgCorners[1]} x2={imgCorners[2]} y2={imgCorners[3]} stroke="#22d3ee" strokeWidth={1.5} strokeDasharray="3,3" />
                <line x1={imgCorners[2]} y1={imgCorners[3]} x2={imgCorners[4]} y2={imgCorners[5]} stroke="#22d3ee" strokeWidth={1.5} strokeDasharray="3,3" />
                <line x1={imgCorners[4]} y1={imgCorners[5]} x2={imgCorners[6]} y2={imgCorners[7]} stroke="#22d3ee" strokeWidth={1.5} strokeDasharray="3,3" />
                <line x1={imgCorners[6]} y1={imgCorners[7]} x2={imgCorners[0]} y2={imgCorners[1]} stroke="#22d3ee" strokeWidth={1.5} strokeDasharray="3,3" />

                {[0, 1, 2, 3].map((idx) => {
                  const cx = imgCorners[idx * 2];
                  const cy = imgCorners[idx * 2 + 1];
                  const isHoveredOrDragged = draggedCornerIndex === idx && draggedTarget === 'image';
                  const isActiveCorner = activeCornerIndex === idx;

                  return (
                    <g 
                      key={`img-handle-${idx}`} 
                      className="cursor-move group pointer-events-auto"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setDraggedCornerIndex(idx);
                        setDraggedTarget('image');
                        onActiveCornerIndexChange(idx);
                      }}
                    >
                      {/* Generous touch target */}
                      <circle 
                        cx={cx} 
                        cy={cy} 
                        r={32} 
                        fill="transparent" 
                        className="pointer-events-auto"
                      />
                      {/* Active highlight ring focus */}
                      {isActiveCorner && (
                        <circle 
                          cx={cx} 
                          cy={cy} 
                          r={18} 
                          fill="none" 
                          stroke="#fbbf24" 
                          strokeWidth={2}
                          strokeDasharray="3,3"
                          className="animate-pulse"
                        />
                      )}
                      {/* Glowing background */}
                      <circle 
                        cx={cx} 
                        cy={cy} 
                        r={isHoveredOrDragged ? 14 : 9} 
                        fill="#06b6d4" 
                        fillOpacity={0.35} 
                        className="transition-all duration-150 animate-pulse"
                      />
                      {/* Solid inner center knob */}
                      <circle 
                        cx={cx} 
                        cy={cy} 
                        r={isHoveredOrDragged ? 8 : 5} 
                        fill="#0891b2" 
                        stroke="#ffffff" 
                        strokeWidth={1.5} 
                        className="transition-all duration-150"
                      />
                      {/* Handle badge indicators */}
                      <g transform={`translate(${cx + 14}, ${cy - 12})`}>
                        <rect 
                          width="26" 
                          height="14" 
                          rx="3" 
                          fill="#111827" 
                          stroke={isActiveCorner ? "#fbbf24" : "#06b6d4"} 
                          strokeWidth="1" 
                        />
                        <text 
                          x="13" 
                          y="10" 
                          fill={isActiveCorner ? "#fbbf24" : "#22d3ee"} 
                          fontSize="8" 
                          fontWeight="bold"
                          textAnchor="middle" 
                          className="font-mono text-center"
                        >
                          I-{cornerLabels[idx]}
                        </text>
                      </g>
                    </g>
                  );
                })}
              </g>
            )}
          </svg>
        )}

        {/* Tutorial instruction cards */}
        {tapeMode && (
          <div className="absolute bottom-4 left-4 right-4 z-20 bg-amber-950/95 text-amber-100 p-3 text-xs rounded-xl border border-amber-900 flex justify-between items-center max-w-lg mx-auto shadow-2xl pointer-events-auto leading-relaxed">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span><strong>{t.tape_tutorial_title}</strong>: {t.tape_tutorial}</span>
            </span>
            <button
              onClick={() => setTapeMode(false)}
              className="bg-amber-800 hover:bg-amber-700 font-bold px-2.5 py-1 rounded-lg transition whitespace-nowrap text-white"
            >
              {t.done}
            </button>
          </div>
        )}

        {calibration.cornersModeOn && draggedCornerIndex === null && (
          <div className="absolute bottom-4 left-4 right-4 z-20 bg-pink-950/95 text-pink-100 p-3 text-xs rounded-xl border border-pink-900/40 flex justify-between items-center max-w-lg mx-auto shadow-2xl pointer-events-auto leading-relaxed">
            <span className="flex items-center gap-1.5">
              <Move className="w-4 h-4 text-pink-400" />
              <span><strong>{t.corners_mod}</strong>: {t.corners_drag_help}</span>
            </span>
            <button
              onClick={() => onCalibrationChange({ cornersModeOn: false })}
              className="bg-pink-800 hover:bg-pink-750 font-bold px-2.5 py-1 rounded-lg transition whitespace-nowrap text-white"
            >
              {t.done}
            </button>
          </div>
        )}

        {calibration.imageCornersModeOn && draggedCornerIndex === null && (
          <div className="absolute bottom-4 left-4 right-4 z-20 bg-cyan-950/95 text-cyan-100 p-3 text-xs rounded-xl border border-cyan-c rounded border-cyan-900/40 flex justify-between items-center max-w-lg mx-auto shadow-2xl pointer-events-auto leading-relaxed animate-fade-in">
            <span className="flex items-center gap-1.5">
              <Move className="w-4 h-4 text-cyan-400" />
              <span><strong>{lang === 'zh' ? '导入图纸四角校正' : 'Image Keystone'}</strong>: {lang === 'zh' ? '拖拽蓝色 [I-TL / I-TR...] 摇杆到图纸的四个对应角，对其做精细物理梯形矫正。' : 'Drag the blue handles to align and flatten the perspective on your uploaded pattern sheet.'}</span>
            </span>
            <button
              onClick={() => onCalibrationChange({ imageCornersModeOn: false })}
              className="bg-cyan-800 hover:bg-cyan-750 font-bold px-2.5 py-1 rounded-lg transition whitespace-nowrap text-white"
            >
              {t.done}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
