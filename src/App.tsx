/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  ProjectData, BodyProfile, CalibrationSettings, PatternLayer, ContrastTheme 
} from './types';
import { generateGarmentPattern } from './utils/patternEngine';
import CalibrationPanel from './components/CalibrationPanel';
import BodyMeasurementsPanel from './components/BodyMeasurementsPanel';
import PatternCanvas from './components/PatternCanvas';
import CloudSyncHub from './components/CloudSyncHub';
import { I18N_DICTS } from './utils/i18n';

// Icons from lucide-react
import { 
  Ruler, Layout, FileText, Upload, Download, Sliders, User, 
  CloudLightning, Smartphone, Check, Sparkles, BookOpen, AlertCircle,
  Minimize2, Maximize2, Layers, RotateCcw, RefreshCw, Languages, EyeOff, Eye
} from 'lucide-react';

// jsPDF for exact physical scale vector export
import { jsPDF } from 'jspdf';

const DEFAULT_CALIBRATION: CalibrationSettings = {
  scale: 1.5, // pixels per mm
  rotation: 0,
  offsetX: 0,
  offsetY: 0,
  keystoneX: 0,
  keystoneY: 0,
  flipX: false,
  flipY: false,
  gridOn: true,
  gridInterval: 50,
  gridUnit: 'cm',
  theme: 'neon-green',
  perspectiveCorners: [0, 0, 1500, 0, 1500, 1000, 0, 1000],
  cornersModeOn: false,
  imageFit: 'fill',
  imageCorners: [0, 0, 1500, 0, 1500, 1000, 0, 1000],
  imageCornersModeOn: false
};

const DEFAULT_LAYERS: PatternLayer[] = [
  { id: 'calibration', name: '尺寸校准面板 (10cm Grid)', visible: true, color: '#10b981', strokeWidth: 1.5 },
  { id: 'net', name: '成衣净样主裁线 (Folded seam)', visible: true, color: '#3b82f6', strokeWidth: 2 },
  { id: 'seam', name: '附带放缝裁剪外廓 (1cm Seam Allowance)', visible: true, color: '#f43f5e', strokeWidth: 2 }
];

export default function App() {
  // Localization: Auto detects browser languages, fallback to chinese
  const [lang, setLang] = useState<'zh' | 'en' | 'ru'>('zh');
  
  useEffect(() => {
    try {
      const systemLang = navigator.language?.toLowerCase();
      if (systemLang?.startsWith('ru')) {
        setLang('ru');
      } else if (systemLang?.startsWith('en')) {
        setLang('en');
      } else {
        setLang('zh');
      }
    } catch (_) {
      setLang('zh');
    }
  }, []);

  const t = I18N_DICTS[lang];

  // Sync state managers
  const [profiles, setProfiles] = useState<BodyProfile[]>([]);
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('profile-user');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('project-tshirt');

  const [activeTab, setActiveTab] = useState<'profile' | 'calibrate' | 'cloud' | 'export'>('calibrate');
  const [isSyncing, setIsSyncing] = useState(false);

  // Active configuration states
  const [patternType, setPatternType] = useState<'tshirt' | 'skirt' | 'pants' | 'vest' | 'uploaded'>('tshirt');
  const [seamAllowance, setSeamAllowance] = useState<number>(10); // in mm
  const [easeAllowance, setEaseAllowance] = useState<number>(20); // in mm
  const [calibration, setCalibration] = useState<CalibrationSettings>(DEFAULT_CALIBRATION);
  const [layers, setLayers] = useState<PatternLayer[]>(DEFAULT_LAYERS);
  const [activeCornerIndex, setActiveCornerIndex] = useState<number | null>(null);

  // PDF & Image upload states
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploadedImageSrc, setUploadedImageSrc] = useState<string | null>(null);
  const [pdfPageCount, setPdfPageCount] = useState<number>(1);
  const [uploadedPdfPage, setUploadedPdfPage] = useState<number>(1);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // UI display managers: default to Landscape Simulated format
  const [isWidescreenSimulator, setIsWidescreenSimulator] = useState<boolean>(true);
  const [fullWorkspaceTrigger, setFullWorkspaceTrigger] = useState<boolean>(false);
  const [hideUIBars, setHideUIBars] = useState<boolean>(false); // Call or Hide visual UI button overlay

  // Revoke previous uploaded Object URLs to prevent browser memory leaks
  useEffect(() => {
    return () => {
      if (uploadedImageSrc) {
        URL.revokeObjectURL(uploadedImageSrc);
      }
    };
  }, [uploadedImageSrc]);

  // Seam selection helper
  const activeProfile = profiles.find(p => p.id === selectedProfileId) || profiles[0] || {
    id: 'profile-user',
    name: lang === 'zh' ? '我的默认身材体型' : 'My Tailoring Sloper',
    gender: 'female',
    height: 165,
    chest: 90,
    waist: 72,
    hips: 95,
    shoulderWidth: 38,
    sleeveLength: 56,
    collarCirc: 36,
    updatedTime: new Date().toISOString()
  };

  // --- PERSISTENCE REAL-WORLD LOGIC (Node Server API + LocalStorage fallback backup) ---
  
  // Load data initially
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setIsSyncing(true);
    try {
      const pRes = await fetch('/api/profiles');
      const prRes = await fetch('/api/projects');
      
      let serverProfiles: BodyProfile[] = [];
      let serverProjects: ProjectData[] = [];

      if (pRes.ok) serverProfiles = await pRes.json();
      if (prRes.ok) serverProjects = await prRes.json();

      if (serverProfiles.length > 0) {
        setProfiles(serverProfiles);
        const savedDefaultProfile = localStorage.getItem('s_profile_id') || serverProfiles[0].id;
        setSelectedProfileId(savedDefaultProfile);
      }
      if (serverProjects.length > 0) {
        setProjects(serverProjects);
        const savedDefaultProj = localStorage.getItem('s_project_id') || serverProjects[0].id;
        setSelectedProjectId(savedDefaultProj);
        applyProjectData(serverProjects.find(pr => pr.id === savedDefaultProj) || serverProjects[0]);
      } else {
        loadFromLocalStorageFallback();
      }
    } catch (e) {
      console.warn('API backend offline, falling back into localized persistent cookies');
      loadFromLocalStorageFallback();
    } finally {
      setIsSyncing(false);
    }
  };

  const loadFromLocalStorageFallback = () => {
    const rawProfiles = localStorage.getItem('profiles');
    const rawProjects = localStorage.getItem('projects');

    if (rawProfiles) {
      const parsed = JSON.parse(rawProfiles);
      setProfiles(parsed);
      setSelectedProfileId(parsed[0].id);
    } else {
      const base = [
        {
          id: 'profile-user',
          name: lang === 'zh' ? '我的默认身材体型 (云端同步)' : 'Default Draping Model (Cloud Sync)',
          gender: 'female' as const,
          height: 165,
          chest: 88,
          waist: 70,
          hips: 92,
          shoulderWidth: 38,
          sleeveLength: 54,
          collarCirc: 35,
          updatedTime: new Date().toISOString()
        }
      ];
      setProfiles(base);
      setSelectedProfileId(base[0].id);
    }

    if (rawProjects) {
      const parsed = JSON.parse(rawProjects);
      setProjects(parsed);
      setSelectedProjectId(parsed[0].id);
      applyProjectData(parsed[0]);
    } else {
      const basePr = [
        {
          id: 'project-tshirt',
          name: lang === 'zh' ? '自适应高定圆领衣' : 'Parametric Round Neck Tshirt',
          patternType: 'tshirt' as const,
          bodyProfileId: 'profile-user',
          customMeasurements: {},
          calibration: DEFAULT_CALIBRATION,
          layers: DEFAULT_LAYERS,
          updatedTime: new Date().toISOString()
        }
      ];
      setProjects(basePr);
      setSelectedProjectId(basePr[0].id);
      applyProjectData(basePr[0]);
    }
  };

  // Sync active project structure back to state
  const applyProjectData = (proj: ProjectData) => {
    if (!proj) return;
    setPatternType(proj.patternType);
    setCalibration(proj.calibration || DEFAULT_CALIBRATION);
    setLayers(proj.layers || DEFAULT_LAYERS);
  };

  // Profile Save endpoint
  const saveBodyProfile = async (updated: BodyProfile) => {
    setIsSyncing(true);
    const nextProfiles = profiles.map(p => p.id === updated.id ? updated : p);
    if (!profiles.some(p => p.id === updated.id)) {
      nextProfiles.push(updated);
    }
    setProfiles(nextProfiles);
    localStorage.setItem('profiles', JSON.stringify(nextProfiles));

    try {
      await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
    } catch (e) {
      console.warn('Post body profile failure, cached locally.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Profile Delete
  const deleteBodyProfile = async (id: string) => {
    const next = profiles.filter(p => p.id !== id);
    setProfiles(next);
    localStorage.setItem('profiles', JSON.stringify(next));
    if (selectedProfileId === id && next.length > 0) {
      setSelectedProfileId(next[0].id);
    }

    try {
      await fetch(`/api/profiles/${id}`, { method: 'DELETE' });
    } catch (e) {
      console.warn('Delete profile failure');
    }
  };

  // Save Project template
  const saveProjectData = async (nameOverride?: string) => {
    const activeProject = projects.find(pr => pr.id === selectedProjectId);
    if (!activeProject) return;

    setIsSyncing(true);
    const updated: ProjectData = {
      ...activeProject,
      name: nameOverride || activeProject.name,
      patternType: patternType,
      calibration: calibration,
      layers: layers,
      bodyProfileId: selectedProfileId,
      updatedTime: new Date().toISOString()
    };

    const nextProjects = projects.map(p => p.id === updated.id ? updated : p);
    setProjects(nextProjects);
    localStorage.setItem('projects', JSON.stringify(nextProjects));

    try {
      await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
    } catch (e) {
      console.warn('Cloud API sync offline, stored layout on device sandbox.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Create new blank project
  const createNewProject = (name: string, type: typeof patternType) => {
    const draft: ProjectData = {
      id: 'project-' + Date.now(),
      name: name || (lang === 'zh' ? `自定义制版项目 #${projects.length + 1}` : `Tailoring Drape Project #${projects.length + 1}`),
      patternType: type,
      bodyProfileId: selectedProfileId,
      customMeasurements: {},
      calibration: calibration,
      layers: layers,
      updatedTime: new Date().toISOString()
    };

    const nextProjects = [...projects, draft];
    setProjects(nextProjects);
    setSelectedProjectId(draft.id);
    applyProjectData(draft);
    localStorage.setItem('projects', JSON.stringify(nextProjects));

    fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft)
    }).catch(() => {});
  };

  // Universal Drop Loader: Supports both structured PDF documents & standard pattern images (JPEG, PNG, BMP)
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processUploadedFile(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processUploadedFile(file);
    }
  };

  const processUploadedFile = (file: File) => {
    const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
    const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|bmp|gif)$/i.test(file.name);

    if (isPdf) {
      setPdfFile(file);
      if (uploadedImageSrc) {
        URL.revokeObjectURL(uploadedImageSrc);
        setUploadedImageSrc(null);
      }
      setPatternType('uploaded');
      setUploadedPdfPage(1);
      setCalibration(prev => ({
        ...prev,
        cornersModeOn: true,
        gridOn: true,
        imageFit: 'fill',
        perspectiveCorners: prev.perspectiveCorners || [0, 0, 1500, 0, 1500, 1000, 0, 1000]
      }));
      createNewProject(lang === 'zh' ? `导入纸样 - ${file.name.replace('.pdf', '')}` : `Import PDF - ${file.name.replace('.pdf', '')}`, 'uploaded');
    } else if (isImage) {
      if (uploadedImageSrc) {
        URL.revokeObjectURL(uploadedImageSrc);
      }
      const url = URL.createObjectURL(file);
      setUploadedImageSrc(url);
      setPdfFile(null);
      setPatternType('uploaded');
      setCalibration(prev => ({
        ...prev,
        cornersModeOn: true,
        gridOn: true,
        imageFit: 'fill',
        perspectiveCorners: prev.perspectiveCorners || [0, 0, 1500, 0, 1500, 1000, 0, 1000]
      }));
      createNewProject(lang === 'zh' ? `导入图纸 - ${file.name}` : `Import Image - ${file.name}`, 'uploaded');
    } else {
      alert(lang === 'zh' ? '⚠️ 请上传有效格式裁衣图纸 (支持 PDF, PNG, JPEG, BMP)。' : '⚠️ Please upload a valid pattern file (PDF, PNG, JPEG, BMP).');
    }
  };

  const handleTriggerInput = () => {
    fileInputRef.current?.click();
  };

  // PDF EXACT 1:1 VECTOR BLUEPRINT COMPILER
  const handlePdfExport1to1 = () => {
    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a0'
      });

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(22);
      const docTitle = lang === 'zh' ? '智能投影1比1物理纸样输出' : 'Smart Tailor 1:1 Physical Scale Vector PDF';
      doc.text(`${docTitle} - ${activeProfile.name}`, 40, 40);
      
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(11);
      const labelType = lang === 'zh' ? '裁打品类' : 'Garment Sloper';
      const labelDate = lang === 'zh' ? '制图日期' : 'Plotted Date';
      const labelSeam = lang === 'zh' ? '缝边' : 'Seam';
      const labelH = lang === 'zh' ? '身高' : 'Height';
      const labelChe = lang === 'zh' ? '胸围' : 'Chest';
      
      doc.text(`${labelType}: ${patternType.toUpperCase()} | ${labelDate}: ${new Date().toLocaleDateString()}`, 40, 52);
      doc.text(`Specs: ${labelH} ${activeProfile.height}cm / ${labelChe} ${activeProfile.chest}cm / ${labelSeam} ${seamAllowance}mm`, 40, 60);

      // 2" x 2" (5.08cm x 5.08cm) grid block
      doc.rect(40, 80, 50.8, 50.8);
      doc.setFontSize(9);
      doc.text(lang === 'zh' ? '2" x 2" 校准物理核准方块' : '2" x 2" Calibration Metric Box', 42, 105);
      doc.text(lang === 'zh' ? '物理打印时用直尺确定本方块为5.08cm' : 'Verify this box equals exactly 5.08cm', 42, 115);

      const patterns = generateGarmentPattern(
        patternType === 'uploaded' ? 'tshirt' : patternType,
        activeProfile,
        seamAllowance,
        easeAllowance
      );

      // Draw vectorized shapes
      patterns.paths.forEach((p) => {
        if (p.id.startsWith('calib-square')) return;

        if (p.strokeType === 'cut') {
          doc.setDrawColor(244, 63, 94);
          doc.setLineWidth(0.8);
        } else if (p.strokeType === 'stitch') {
          doc.setDrawColor(59, 130, 246);
          doc.setLineWidth(0.55);
          doc.setLineDashPattern([2, 2], 0);
        } else {
          doc.setDrawColor(100, 100, 100);
          doc.setLineWidth(0.3);
        }

        const commands = p.d.trim().split(/(?=[MLQCZ])/i);
        let cx = 0, cy = 0;

        commands.forEach((cmd) => {
          const type = cmd[0].toUpperCase();
          const args = cmd.slice(1).trim().split(/\s+/).map(parseFloat);

          if (type === 'M' && args.length >= 2) {
            cx = args[0];
            cy = args[1];
          } else if (type === 'L' && args.length >= 2) {
            doc.line(cx, cy, args[0], args[1]);
            cx = args[0];
            cy = args[1];
          } else if ((type === 'Q' || type === 'C') && args.length >= 2) {
            const tx = args[args.length - 2];
            const ty = args[args.length - 1];
            doc.line(cx, cy, tx, ty);
            cx = tx;
            cy = ty;
          }
        });

        if (p.label && p.labelPos) {
          doc.setFontSize(10);
          doc.setTextColor(50, 50, 50);
          doc.text(p.label, p.labelPos.x, p.labelPos.y);
        }
      });

      doc.save(`TailorDraft_1to1_${patternType}_${Date.now()}.pdf`);
    } catch (err: any) {
      alert(`Export PDF crash, retry: ${err.message || err}`);
    }
  };

  const categories = [
    { id: 'tshirt', name: lang === 'zh' ? '经典圆领T恤' : 'Classic Crewneck T-shirt', desc: lang === 'zh' ? '自适应袖窿打底' : 'Adaptive sleeve curve' },
    { id: 'skirt', name: lang === 'zh' ? 'A字半身长裙' : 'A-Line Maxi Skirt', desc: lang === 'zh' ? '含腰部收省道设计' : 'Dart count layout' },
    { id: 'pants', name: lang === 'zh' ? '宽松沙滩休闲裤' : 'Casual Beach Pants', desc: lang === 'zh' ? '自动拟合裆弯深度' : 'Fitted backrise arch' },
    { id: 'vest', name: lang === 'zh' ? '修身正装马甲' : 'Slim Formal Vest', desc: lang === 'zh' ? '斜领开口腰节款' : 'Angled v-collar sloper' }
  ];

  return (
    <div className="absolute inset-0 bg-neutral-950 font-sans overflow-hidden flex flex-col h-full text-gray-150 select-none">
      
      {/* HEADER BAR (Collapsed under full-focus projection state to prevent light pollution) */}
      {!hideUIBars && (
        <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between shadow-md z-10 shrink-0 select-none">
          <div className="flex items-center gap-2.5">
            <div className="bg-gradient-to-tr from-indigo-600 to-teal-500 p-2 rounded-xl text-white shadow-md animate-pulse">
              <Ruler className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-black text-white tracking-wider flex items-center gap-1.5 leading-none">
                {t.title}
                <span className="text-[9px] bg-indigo-900/50 text-indigo-300 font-normal px-2 py-0.5 rounded-full border border-indigo-800/40">
                  {t.tag_cloud}
                </span>
              </h1>
              <p className="text-[10px] text-gray-400 mt-1">
                {t.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Locale Language Switch Button */}
            <button
              onClick={() => {
                const nextLang = lang === 'zh' ? 'en' : lang === 'en' ? 'ru' : 'zh';
                setLang(nextLang);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-gray-800 border border-gray-750 text-gray-350 hover:text-white transition flex items-center gap-1 text-xs"
              title="切换系统语言 Switch Languages / Сменить язык"
            >
              <Languages className="w-3.5 h-3.5 text-indigo-400" />
              <span>{lang === 'zh' ? 'English' : lang === 'en' ? 'Русский' : '中文'}</span>
            </button>

            {/* Clear UI for pristine projection */}
            <button
              onClick={() => setHideUIBars(true)}
              className="px-2.5 py-1.5 rounded-lg bg-pink-950/20 border border-pink-900/45 text-pink-400 hover:bg-pink-950/40 hover:text-pink-300 transition flex items-center gap-1 text-xs"
              title={t.btn_hide_ui}
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span>{t.btn_hide_ui}</span>
            </button>

            {/* Screen layout simulator tools */}
            <button
              onClick={() => setIsWidescreenSimulator(!isWidescreenSimulator)}
              className={`text-xs px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition ${
                isWidescreenSimulator 
                  ? 'bg-indigo-600 border-indigo-500 text-white font-semibold' 
                  : 'bg-gray-800 border-gray-750 text-gray-400 hover:text-white'
              }`}
              title="微信小程序横向强制全屏排料模拟"
            >
              <Smartphone className="w-4 h-4" />
              {isWidescreenSimulator ? t.exit_sim : t.sim_landscape}
            </button>

            <button
              onClick={() => setFullWorkspaceTrigger(!fullWorkspaceTrigger)}
              className="p-1.5 rounded-lg bg-gray-800 border border-gray-750 text-gray-300 hover:text-white active:scale-95 transition"
              title="最大化工作区"
            >
              {fullWorkspaceTrigger ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </header>
      )}

      {/* Floating reveal trigger displayed on active projection mode */}
      {hideUIBars && (
        <button
          onClick={() => setHideUIBars(false)}
          className="absolute top-4 right-4 z-50 px-3.5 py-2 rounded-xl bg-gray-950/90 hover:bg-gray-900 text-pink-400 hover:text-pink-300 font-semibold text-xs border border-pink-900/40 backdrop-blur shadow-2xl flex items-center gap-1.5 active:scale-95 transition"
        >
          <Eye className="w-4 h-4 animate-bounce" />
          <span>{t.btn_show_ui}</span>
        </button>
      )}

      {/* WORKSPACE CONTENT AREA */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT COMPILER BLOCK (Collapses under focus mode) */}
        {!fullWorkspaceTrigger && !hideUIBars && (
          <aside className="w-[360px] bg-gray-900 border-r border-gray-800 p-4 overflow-y-auto flex flex-col gap-4 shrink-0 shadow-xl">
            
            {/* 服饰品类 selector */}
            <div>
              <label className="text-[11px] font-bold text-gray-500 block uppercase tracking-wider mb-2">
                {t.category_label}
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {categories.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setPatternType(item.id as any);
                      saveProjectData();
                    }}
                    className={`p-2.5 rounded-xl text-left border transition-all ${
                      patternType === item.id 
                        ? 'bg-indigo-600 border-indigo-500 text-white font-bold shadow-md' 
                        : 'bg-gray-850 border-gray-800 text-gray-400 hover:border-gray-750 hover:text-gray-200'
                    }`}
                  >
                    <span className="text-xs block leading-tight">{item.name}</span>
                    <span className={`text-[8.5px] block mt-1 ${patternType === item.id ? 'text-indigo-200' : 'text-gray-500'}`}>
                      {item.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Drag upload grid */}
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-4 text-center transition flex flex-col justify-center items-center gap-2 ${
                dragOver 
                  ? 'border-teal-500 bg-teal-950/25 text-teal-300 animate-pulse' 
                  : patternType === 'uploaded'
                    ? 'border-indigo-500 bg-indigo-950/20 text-indigo-300'
                    : 'border-gray-800 bg-gray-950/50 text-gray-500 hover:border-gray-700'
              }`}
            >
              <Upload className={`w-6 h-6 ${patternType === 'uploaded' ? 'text-indigo-500' : 'text-gray-400'}`} />
              <div>
                <span className="text-xs font-bold text-gray-300 block">
                  {t.uploaded_label}
                </span>
                <span className="text-[9px] text-gray-500 block leading-normal mt-1 px-1">
                  {t.uploaded_desc}
                </span>
              </div>
              <input 
                ref={fileInputRef}
                type="file" 
                accept=".pdf,image/png,image/jpeg,image/bmp" 
                onChange={handleFileSelect}
                className="hidden" 
              />
              <button 
                onClick={handleTriggerInput}
                className="text-[10px] bg-gray-800 border border-gray-700 hover:bg-gray-750 hover:text-white px-2.5 py-1.5 rounded transition text-gray-300 mt-1"
              >
                {t.upload_btn}
              </button>

              {patternType === 'uploaded' && pdfFile && (
                <div className="w-full bg-gray-900 border border-gray-850 p-2 rounded-lg mt-2 flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-gray-500">PDF {lang === 'zh' ? '页数筛选:' : 'Page Picker:'}</span>
                    <span className="text-indigo-400 font-mono font-semibold">{uploadedPdfPage} / {pdfPageCount}</span>
                  </div>
                  <div className="flex gap-1">
                    <button 
                      onClick={() => setUploadedPdfPage(prev => Math.max(1, prev - 1))}
                      disabled={uploadedPdfPage <= 1}
                      className="flex-1 bg-gray-800 text-[10px] py-1 rounded hover:bg-gray-750 text-gray-300 disabled:opacity-40"
                    >
                      {t.page_prev}
                    </button>
                    <button 
                      onClick={() => setUploadedPdfPage(prev => Math.min(pdfPageCount, prev + 1))}
                      disabled={uploadedPdfPage >= pdfPageCount}
                      className="flex-1 bg-gray-800 text-[10px] py-1 rounded hover:bg-gray-750 text-gray-300 disabled:opacity-40"
                    >
                      {t.page_next}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar navigation tabs */}
            <div>
              <div className="flex bg-gray-950 p-1 rounded-xl border border-gray-850">
                {[
                  { id: 'calibrate', name: lang === 'zh' ? '投影校准' : 'Warp', icon: Sliders },
                  { id: 'profile', name: lang === 'zh' ? '身材尺寸' : 'Measure', icon: User },
                  { id: 'cloud', name: lang === 'zh' ? '多端云AI' : 'Cloud AI', icon: CloudLightning },
                  { id: 'export', name: lang === 'zh' ? '排料导出' : 'Export', icon: FileText }
                ].map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex-1 flex flex-col items-center gap-1 py-1.5 rounded-lg transition text-center ${
                        activeTab === tab.id 
                          ? 'bg-gray-850 border border-gray-800 text-indigo-400 font-bold' 
                          : 'text-gray-500 hover:text-gray-350'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span className="text-[10px] block">{tab.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tabs details render block */}
            <div className="flex-1 flex flex-col">
              {activeTab === 'calibrate' && (
                <CalibrationPanel
                  settings={calibration}
                  onChange={(chg) => {
                    setCalibration(chg);
                    saveProjectData();
                  }}
                  layers={layers}
                  onLayersChange={setLayers}
                  seamAllowance={seamAllowance}
                  onSeamAllowanceChange={setSeamAllowance}
                  easeAllowance={easeAllowance}
                  onEaseAllowanceChange={setEaseAllowance}
                  lang={lang}
                  activeCornerIndex={activeCornerIndex}
                  onActiveCornerIndexChange={setActiveCornerIndex}
                />
              )}

              {activeTab === 'profile' && (
                <BodyMeasurementsPanel
                  profiles={profiles}
                  selectedProfileId={selectedProfileId}
                  onSelectProfile={(id) => {
                    setSelectedProfileId(id);
                    localStorage.setItem('s_profile_id', id);
                    saveProjectData();
                  }}
                  onSaveProfile={saveBodyProfile}
                  onDeleteProfile={deleteBodyProfile}
                  isSyncing={isSyncing}
                  onForceSync={fetchInitialData}
                  lang={lang}
                />
              )}

              {activeTab === 'cloud' && (
                <CloudSyncHub
                  projects={projects}
                  selectedProjectId={selectedProjectId}
                  onSelectProject={(id) => {
                    setSelectedProjectId(id);
                    localStorage.setItem('s_project_id', id);
                    const chosen = projects.find(p => p.id === id);
                    if (chosen) applyProjectData(chosen);
                  }}
                  onSaveProject={() => saveProjectData()}
                  onDeleteProject={async (id) => {
                    const next = projects.filter(p => p.id !== id);
                    setProjects(next);
                    localStorage.setItem('projects', JSON.stringify(next));
                    if (selectedProjectId === id) {
                      setSelectedProjectId(next[0].id);
                      applyProjectData(next[0]);
                    }
                    try {
                      await fetch(`/api/projects/${id}`, { method: 'DELETE' });
                    } catch (_) {}
                  }}
                  currentProfile={activeProfile}
                  currentPatternType={patternType}
                  lang={lang}
                />
              )}

              {activeTab === 'export' && (
                <div id="pdf-exporter-form" className="flex flex-col gap-4 bg-gray-950/80 p-4 rounded-xl border border-gray-800">
                  <div className="flex items-center gap-2 text-indigo-400 leading-none">
                    <FileText className="w-4 h-4" />
                    <span className="text-xs font-bold">{t.export_title}</span>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    {t.export_desc}
                  </p>
                  
                  <div className="flex flex-col gap-1.5 bg-gray-900 p-3 rounded-lg border border-gray-850">
                    <span className="text-[9px] text-gray-500 block uppercase font-mono">{lang === 'zh' ? '纸张尺寸规范 (A0 Standard):' : 'Plotted Dimensions (A0 Standard):'}</span>
                    <div className="text-xs font-semibold text-gray-200">A0 (1189mm x 841mm)</div>
                    <span className="text-[9.5px] text-gray-400">{lang === 'zh' ? '完美适配面料排料, 避免切割断口。' : 'Seamless vector mapping without pagination gaps.'}</span>
                  </div>

                  <button
                    onClick={handlePdfExport1to1}
                    className="w-full bg-gradient-to-tr from-indigo-600 to-indigo-500 active:scale-95 text-white hover:from-indigo-500 hover:to-indigo-400 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition shadow-md cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    {t.export_btn}
                  </button>

                  <hr className="border-gray-800" />

                  <button
                    onClick={() => saveProjectData()}
                    className="w-full bg-gray-900 border border-gray-800 hover:border-gray-700 py-2 rounded-lg text-[11px] font-semibold text-gray-300 hover:text-white transition cursor-pointer text-center"
                  >
                    {t.save_cloud_btn}
                  </button>
                </div>
              )}
            </div>
          </aside>
        )}

        {/* MAIN VISUAL BOARD CANVAS */}
        <section className="flex-1 h-full p-4 flex flex-col overflow-hidden relative bg-neutral-950 select-none">
          
          {/* Simulate WeChat Mini Program landscape device frame borders if toggled */}
          {isWidescreenSimulator ? (
            <div className="flex-1 flex flex-col bg-black rounded-[32px] border-[10px] border-neutral-800 shadow-3xl p-1.5 overflow-hidden relative select-none">
              {/* Top notch simulated camera receiver */}
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-32 h-3.5 bg-neutral-800 rounded-b-xl z-50 pointer-events-none" />
              
              {/* Simulated Mobile Status bar & WeChat Mini Program capsule menu */}
              <div className="absolute top-1 left-5 right-5 flex justify-between items-center z-50 text-[9px] font-mono pointer-events-none">
                {/* Left side standard phone indicators */}
                <div className="flex items-center gap-2 text-gray-400">
                  <span className="font-semibold text-white">09:41</span>
                  <span className="flex items-center gap-0.5">
                    <span className="w-0.5 h-1 bg-gray-400 rounded-[0.5px]" />
                    <span className="w-0.5 h-1.5 bg-gray-400 rounded-[0.5px]" />
                    <span className="w-0.5 h-2 bg-gray-400 rounded-[0.5px]" />
                    <span className="w-0.5 h-2.5 bg-green-500 rounded-[0.5px]" />
                  </span>
                  <span className="tracking-wide">5G</span>
                  <span className="text-gray-700">|</span>
                  <span className="text-green-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    WIFI INTERNET OK
                  </span>
                </div>

                {/* Right side WeChat layout capsule */}
                <div className="flex items-center gap-3.5 bg-neutral-900/90 border border-neutral-700/60 rounded-full py-0.5 px-3">
                  <span className="text-pink-400 font-sans tracking-wide text-[8.5px] font-bold">● {lang === 'zh' ? '小程序全屏投影' : 'Landscape Mode'}</span>
                  <span className="h-2 w-[1px] bg-neutral-800" />
                  {/* WeChat Menu Dot indicator */}
                  <div className="flex gap-0.5 items-center">
                    <span className="w-1 h-1 rounded-full bg-white/80" />
                    <span className="w-1.2 h-1.2 rounded-full bg-white/80" />
                    <span className="w-1 h-1 rounded-full bg-white/80" />
                  </div>
                  <span className="h-2 w-[1px] bg-neutral-800" />
                  {/* WeChat Close button */}
                  <div className="w-2.5 h-2.5 rounded-full border border-white/80 flex items-center justify-center">
                    <span className="w-1 h-1 rounded-full bg-white" />
                  </div>
                </div>
              </div>
              
              <div className="flex-1 flex flex-col rounded-[22px] overflow-hidden bg-neutral-900 pb-1 pt-6 relative">
                <PatternCanvas
                  patternType={patternType}
                  profile={activeProfile}
                  calibration={calibration}
                  layers={layers}
                  seamAllowance={seamAllowance}
                  easeAllowance={easeAllowance}
                  pdfFile={pdfFile}
                  uploadedPdfPage={uploadedPdfPage}
                  onPdfLoaded={setPdfPageCount}
                  uploadedImageSrc={uploadedImageSrc}
                  lang={lang}
                  onCalibrationChange={(chgs) => {
                    setCalibration(prev => ({ ...prev, ...chgs }));
                  }}
                  activeCornerIndex={activeCornerIndex}
                  onActiveCornerIndexChange={setActiveCornerIndex}
                />
              </div>
            </div>
          ) : (
            <PatternCanvas
              patternType={patternType}
              profile={activeProfile}
              calibration={calibration}
              layers={layers}
              seamAllowance={seamAllowance}
              easeAllowance={easeAllowance}
              pdfFile={pdfFile}
              uploadedPdfPage={uploadedPdfPage}
              onPdfLoaded={setPdfPageCount}
              uploadedImageSrc={uploadedImageSrc}
              lang={lang}
              onCalibrationChange={(chgs) => {
                setCalibration(prev => ({ ...prev, ...chgs }));
              }}
              activeCornerIndex={activeCornerIndex}
              onActiveCornerIndexChange={setActiveCornerIndex}
            />
          )}

          {/* Quick measurement parameters help footer indicators */}
          <footer className="mt-3 text-[10px] text-gray-500 flex justify-between items-center px-1">
            <span>{t.canvas_bottom_scale} <strong>{calibration.scale.toFixed(2)}x</strong> pixel scaling.</span>
            <span>{t.canvas_bottom_desc}</span>
          </footer>
        </section>
      </div>
    </div>
  );
}
