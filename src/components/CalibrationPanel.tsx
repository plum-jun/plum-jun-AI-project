/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Move, RotateCw, ZoomIn, ZoomOut, Grid, Sparkles, 
  Settings, ArrowLeftRight, ArrowUpDown, Layers, Sliders, Palette,
  Maximize, RefreshCw
} from 'lucide-react';
import { CalibrationSettings, ContrastTheme, PatternLayer } from '../types';
import { I18N_DICTS } from '../utils/i18n';

interface CalibrationPanelProps {
  settings: CalibrationSettings;
  onChange: (settings: CalibrationSettings) => void;
  layers: PatternLayer[];
  onLayersChange: (layers: PatternLayer[]) => void;
  seamAllowance: number;
  onSeamAllowanceChange: (val: number) => void;
  easeAllowance: number;
  onEaseAllowanceChange: (val: number) => void;
  lang: 'zh' | 'en' | 'ru';
  activeCornerIndex: number | null;
  onActiveCornerIndexChange: (idx: number | null) => void;
}

export default function CalibrationPanel({
  settings,
  onChange,
  layers,
  onLayersChange,
  seamAllowance,
  onSeamAllowanceChange,
  easeAllowance,
  onEaseAllowanceChange,
  lang,
  activeCornerIndex,
  onActiveCornerIndexChange
}: CalibrationPanelProps) {

  const t = I18N_DICTS[lang];
  const [nudgeStep, setNudgeStep] = React.useState<number>(5);

  const updateSetting = <K extends keyof CalibrationSettings>(key: K, value: CalibrationSettings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  const toggleLayer = (id: string) => {
    onLayersChange(
      layers.map(l => l.id === id ? { ...l, visible: !l.visible } : l)
    );
  };

  const applyScalePreset = (preset: number) => {
    updateSetting('scale', preset);
  };

  // Localized descriptions for the selectable corners panel configuration
  const labels = {
    active_corner: lang === 'zh' ? '当前选中调校角:' : lang === 'ru' ? 'Активный угол:' : 'Selected Active Corner:',
    nudge_step: lang === 'zh' ? '微调幅度/单步:' : lang === 'ru' ? 'Шаг сдвига:' : 'Nudge Resolution:',
    nudge_pad: lang === 'zh' ? '微调方向盘 (D-Pad)' : lang === 'ru' ? 'Кнопки сдвига (D-Pad)' : 'Directional Nudge D-Pad',
    coord_x: lang === 'zh' ? '角度 X 轴坐标:' : lang === 'ru' ? 'Координата X:' : 'X Coordinate:',
    coord_y: lang === 'zh' ? '角度 Y 轴坐标:' : lang === 'ru' ? 'Координата Y:' : 'Y Coordinate:',
    corners_select_tip: lang === 'zh' ? '点击下方调校点或画布上对应点进行选择' : lang === 'ru' ? 'Выберите угол ниже или на холсте' : 'Select a corner below or click on the canvas handle',
    keyboard_tip: lang === 'zh' ? '💡 支持键盘 ◀ ▶ ▲ ▼ 箭头微调 (Shift = 10倍速)' : lang === 'ru' ? '💡 Поддерживает стрелки ◀ ▶ ▲ ▼ (Shift = 10x)' : '💡 Supports standard keyboard ◀ ▶ ▲ ▼ arrows (Shift = 10x)',
    corner_names: [
      lang === 'zh' ? '左上 (TL)' : lang === 'ru' ? 'Левый верхний (TL)' : 'Top Left (TL)',
      lang === 'zh' ? '右上 (TR)' : lang === 'ru' ? 'Правый верхний (TR)' : 'Top Right (TR)',
      lang === 'zh' ? '右下 (BR)' : lang === 'ru' ? 'Правый нижний (BR)' : 'Bottom Right (BR)',
      lang === 'zh' ? '左下 (BL)' : lang === 'ru' ? 'Левый нижний (BL)' : 'Bottom Left (BL)'
    ]
  };

  const cornersList = settings.perspectiveCorners || [0, 0, 1500, 0, 1500, 1000, 0, 1000];
  const imgCornersList = settings.imageCorners || [0, 0, 1500, 0, 1500, 1000, 0, 1000];
  const cornerLabelsCompact = ['TL', 'TR', 'BR', 'BL'];

  const handleCornerNudge = (dx: number, dy: number) => {
    if (activeCornerIndex === null) return;
    
    if (settings.imageCornersModeOn) {
      const nextPoints = [...imgCornersList] as [number, number, number, number, number, number, number, number];
      nextPoints[activeCornerIndex * 2] = Math.max(-200, Math.min(1700, nextPoints[activeCornerIndex * 2] + dx));
      nextPoints[activeCornerIndex * 2 + 1] = Math.max(-200, Math.min(1200, nextPoints[activeCornerIndex * 2 + 1] + dy));
      onChange({
        ...settings,
        imageCorners: nextPoints
      });
    } else {
      const nextPoints = [...cornersList] as [number, number, number, number, number, number, number, number];
      nextPoints[activeCornerIndex * 2] = Math.max(-200, Math.min(1700, nextPoints[activeCornerIndex * 2] + dx));
      nextPoints[activeCornerIndex * 2 + 1] = Math.max(-200, Math.min(1200, nextPoints[activeCornerIndex * 2 + 1] + dy));
      onChange({
        ...settings,
        perspectiveCorners: nextPoints
      });
    }
  };

  const handleCornerDirectInput = (axis: 'x' | 'y', val: number) => {
    if (activeCornerIndex === null) return;
    const maxVal = axis === 'x' ? 1700 : 1200;
    const boundedVal = isNaN(val) ? 0 : Math.max(-200, Math.min(maxVal, val));
    
    if (settings.imageCornersModeOn) {
      const nextPoints = [...imgCornersList] as [number, number, number, number, number, number, number, number];
      const idx = activeCornerIndex * 2 + (axis === 'x' ? 0 : 1);
      nextPoints[idx] = boundedVal;
      onChange({
        ...settings,
        imageCorners: nextPoints
      });
    } else {
      const nextPoints = [...cornersList] as [number, number, number, number, number, number, number, number];
      const idx = activeCornerIndex * 2 + (axis === 'x' ? 0 : 1);
      nextPoints[idx] = boundedVal;
      onChange({
        ...settings,
        perspectiveCorners: nextPoints
      });
    }
  };

  // Dual-languages high-contrast fabric color themes
  const THEMES: { id: ContrastTheme; name: string; bg: string; text: string; stroke: string }[] = [
    { id: 'classic', name: lang === 'zh' ? '经典高光 (明场白底)' : 'Classic Bright (White background)', bg: 'bg-white', text: 'text-gray-900', stroke: 'stroke-gray-900' },
    { id: 'neon-green', name: lang === 'zh' ? '护眼霓虹金绿 (投影最佳)' : 'Neon Green (Best for projection)', bg: 'bg-black', text: 'text-green-400', stroke: 'stroke-green-400' },
    { id: 'neon-red', name: lang === 'zh' ? '极光红 (深色花布辅照)' : 'Neon Red (For dark/printed fabrics)', bg: 'bg-black', text: 'text-red-500', stroke: 'stroke-red-500' },
    { id: 'neon-yellow', name: lang === 'zh' ? '高亮金黄 (深蓝毛纺对齐)' : 'Neon Yellow (For deep wool/cotton)', bg: 'bg-black', text: 'text-yellow-400', stroke: 'stroke-yellow-400' },
    { id: 'blueprint', name: lang === 'zh' ? '数码蓝图 (深蓝背投)' : 'Digital Blueprint (Back-projection)', bg: 'bg-blue-950', text: 'text-blue-200', stroke: 'stroke-blue-300' }
  ];

  // Dynamic localized styling based on whether we are rectifying the projected outline or the paper pattern sheet
  const isProj = settings.cornersModeOn;
  const isImg = settings.imageCornersModeOn;
  
  const cardBorderClass = isProj 
    ? 'border-pink-600/40 bg-pink-950/15' 
    : isImg 
      ? 'border-cyan-600/40 bg-cyan-950/15' 
      : 'border-gray-800 bg-gray-950/45';
      
  const headerTextClass = isProj ? 'text-pink-400' : isImg ? 'text-cyan-400' : 'text-gray-400';
  const textThemeClass = isImg ? 'text-cyan-400' : 'text-pink-400';
  const bgThemeClass = isImg ? 'bg-cyan-600' : 'bg-pink-600';
  const pingBgThemeClass = isImg ? 'bg-cyan-500' : 'bg-pink-500';
  const pingBorderThemeClass = isImg ? 'border-cyan-750/40' : 'border-pink-700/40';
  const borderThemeClass = isImg ? 'border-cyan-400' : 'border-pink-400';
  const focusBorderThemeClass = isImg ? 'focus:border-cyan-500' : 'focus:border-pink-500';
  const hoverBtnClass = isImg ? 'hover:text-cyan-400' : 'hover:text-pink-400';

  return (
    <div id="calibration-options-panel" className="flex flex-col gap-4 bg-gray-950/80 text-gray-200 p-4 rounded-xl border border-gray-800 animate-fade-in">
      
      {/* PERSPECTIVE FOUR CORNER PORT CONTROLS - Highlight feature */}
      <div className={`p-4 rounded-xl border transition-all duration-300 flex flex-col gap-3 ${cardBorderClass}`}>
        <label className={`text-xs font-black flex items-center gap-1.5 leading-none ${headerTextClass}`}>
          <Maximize className="w-4 h-4 animate-pulse text-current" />
          {lang === 'zh' ? '四角透视与图纸校正' : 'Perspective & Image Calibration'}
        </label>
        <span className="text-[10px] text-gray-400 block leading-normal">
          {lang === 'zh' 
            ? '支持分别单独校准：1) 投影仪物理摆放的画面偏斜；2) 手机等设备拍照导入图纸的透视变形。' 
            : 'Independently calibrate: 1) Projector keystone misalignment; 2) Perspective skew on physical draft photos.'}
        </span>

        {/* Dynamic Dual Target Switcher Tabs */}
        <div className="flex bg-gray-950 p-1 rounded-xl border border-gray-900 mt-1">
          <button
            type="button"
            onClick={() => {
              onChange({
                ...settings,
                cornersModeOn: !isProj,
                imageCornersModeOn: false
              });
              onActiveCornerIndexChange(0);
            }}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg transition leading-tight text-center ${
              isProj
                ? 'bg-pink-900/40 border border-pink-700/40 text-pink-300 font-bold'
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900/40'
            }`}
          >
            <span className="text-[11px] block">{lang === 'zh' ? '1. 投影仪校准' : '1. Projector Keystone'}</span>
            <span className="text-[8px] opacity-75">{lang === 'zh' ? '矫正设备镜头变形' : 'Align display grid'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onChange({
                ...settings,
                imageCornersModeOn: !isImg,
                cornersModeOn: false
              });
              onActiveCornerIndexChange(0);
            }}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg transition leading-tight text-center ${
              isImg
                ? 'bg-cyan-900/40 border border-cyan-700/40 text-cyan-300 font-bold'
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900/40'
            }`}
          >
            <span className="text-[11px] block">{lang === 'zh' ? '2. 导入图纸校正' : '2. Image Warp'}</span>
            <span className="text-[8px] opacity-75">{lang === 'zh' ? '单张拍照纸样拉伸' : 'Warp uploaded pattern'}</span>
          </button>
        </div>

        {/* Action button matching whichever target is toggled */}
        <div className="flex gap-2">
          {!(isProj || isImg) ? (
            <div className="text-center py-2.5 bg-gray-950/40 border border-gray-900 rounded-lg w-full text-xs text-gray-500 font-medium">
              {lang === 'zh' ? '💡 请点击上方标签开启对应的四角校准模式' : '💡 Select a tab above to initiate 4-corner warp calibration'}
            </div>
          ) : (
            <>
              <button
                onClick={() => {
                  if (isProj) {
                    onChange({ ...settings, cornersModeOn: false });
                  } else {
                    onChange({ ...settings, imageCornersModeOn: false });
                  }
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg border transition font-bold ${
                  isProj
                    ? 'bg-pink-600 border-pink-500 text-white'
                    : 'bg-cyan-600 border-cyan-500 text-white'
                }`}
              >
                <Maximize className="w-3.5 h-3.5" />
                {lang === 'zh' ? '保存并退出当前校准' : 'Save & Exit Calibration'}
              </button>
              
              <button
                onClick={() => {
                  const rCorners = [0, 0, 1500, 0, 1500, 1000, 0, 1000];
                  if (isProj) {
                    onChange({ ...settings, perspectiveCorners: rCorners as any });
                  } else {
                    onChange({ ...settings, imageCorners: rCorners as any });
                  }
                  onActiveCornerIndexChange(0);
                }}
                className="px-3 py-2 bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-400 hover:text-white rounded-lg text-xs transition"
                title={lang === 'zh' ? '一键恢复规整正方形' : 'Restore standard square corners'}
                type="button"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>

        {/* Paper pattern stretch match settings - keystone compensation feature */}
        <div className="mt-1 pt-2 border-t border-gray-900/40 flex flex-col gap-1.5">
          <span className="text-[10px] text-gray-400 font-bold block flex justify-between">
            <span>{lang === 'zh' ? '导入图纸适配画面模式' : 'Pattern Fitting Scaler'}</span>
            <span className="text-[8.5px] text-gray-500 font-mono">ImageFit</span>
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => onChange({ ...settings, imageFit: 'fill' })}
              className={`py-1.5 px-2 text-[11px] rounded-lg border text-center transition leading-tight ${
                settings.imageFit !== 'contain'
                  ? isImg ? 'bg-cyan-900/30 border-cyan-500 text-cyan-300 font-bold' : 'bg-pink-900/30 border-pink-500 text-pink-300 font-bold'
                  : 'bg-gray-950/60 border-gray-900 text-gray-400 hover:border-gray-800 hover:text-white'
              }`}
            >
              {lang === 'zh' ? '铺满网格 (推荐拉伸)' : 'Stretch to Grid'}
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...settings, imageFit: 'contain' })}
              className={`py-1.5 px-2 text-[11px] rounded-lg border text-center transition leading-tight ${
                settings.imageFit === 'contain'
                  ? isImg ? 'bg-cyan-900/30 border-cyan-500 text-cyan-300 font-bold' : 'bg-pink-900/30 border-pink-500 text-pink-300 font-bold'
                  : 'bg-gray-950/60 border-gray-900 text-gray-400 hover:border-gray-800 hover:text-white'
              }`}
            >
              {lang === 'zh' ? '保持比例 (居中)' : 'Maintain Aspect'}
            </button>
          </div>
        </div>

        {/* 4 CORNER DETAILED NUDGING MODULES */}
        {(isProj || isImg) && (
          <div className="mt-2.5 pt-2.5 border-t border-gray-900/40 flex flex-col gap-2 animate-fade-in text-gray-200">
            {/* Corner Selector Buttons */}
            <span className="text-[10px] text-gray-400 font-bold block">
              {isImg ? (lang === 'zh' ? '选择调校的图纸角:' : 'Active Image Corner:') : labels.active_corner}
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {[0, 1, 2, 3].map((idx) => {
                const cx = isImg ? imgCornersList[idx * 2] : cornersList[idx * 2];
                const cy = isImg ? imgCornersList[idx * 2 + 1] : cornersList[idx * 2 + 1];
                const isActive = activeCornerIndex === idx;
                
                const activeColorClass = isImg
                  ? 'bg-cyan-900/40 border-cyan-400 text-cyan-300 font-bold shadow-md ring-1 ring-cyan-500/20'
                  : 'bg-pink-900/40 border-pink-400 text-pink-300 font-bold shadow-md ring-1 ring-pink-500/20';
                  
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onActiveCornerIndexChange(idx)}
                    className={`p-2 rounded-xl text-left border text-[11px] transition flex flex-col justify-between ${
                      isActive
                        ? activeColorClass
                        : 'bg-gray-950/60 border-gray-900 text-gray-400 hover:border-gray-800 hover:text-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-center w-full text-[9px]">
                      <span className="truncate pr-1">
                        {isImg ? `I-${cornerLabelsCompact[idx]}` : cornerLabelsCompact[idx]}
                      </span>
                      <span className={`text-[8px] bg-gray-900 px-1 rounded-full font-mono ${textThemeClass}`}>#{idx+1}</span>
                    </div>
                    <div className="font-mono mt-1 text-[11px] text-gray-200">
                      {cx}, {cy}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Micro Nudging Pad D-Pad */}
            <div className="flex flex-col items-center gap-1.5 my-1 bg-gray-950/50 p-2.5 rounded-xl border border-gray-900">
              <span className="text-[10px] text-gray-400 font-extrabold uppercase font-mono tracking-wider">{labels.nudge_pad}</span>
              
              {/* Nudge Directional Pad Grid */}
              <div className="flex flex-col items-center gap-1.5">
                {/* Arrow Up */}
                <button
                  type="button"
                  onClick={() => handleCornerNudge(0, -nudgeStep)}
                  disabled={activeCornerIndex === null}
                  className={`w-10 h-8 bg-gray-800 hover:bg-gray-700 border border-gray-700 disabled:opacity-30 rounded-lg flex items-center justify-center text-sm font-bold hover:text-white active:scale-90 transition shadow ${textThemeClass}`}
                  title="Nudge Up"
                >
                  ▲
                </button>
                
                {/* Middle row: Left, Hub, Right */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCornerNudge(-nudgeStep, 0)}
                    disabled={activeCornerIndex === null}
                    className={`w-10 h-8 bg-gray-800 hover:bg-gray-700 border border-gray-700 disabled:opacity-30 rounded-lg flex items-center justify-center text-sm font-bold hover:text-white active:scale-90 transition shadow ${textThemeClass}`}
                    title="Nudge Left"
                  >
                    ◀
                  </button>
                  
                  {/* Central Status Core */}
                  <div className={`w-8 h-8 rounded-full bg-gray-900 border ${pingBorderThemeClass} flex items-center justify-center`}>
                    <span className={`w-2 h-2 rounded-full animate-ping ${pingBgThemeClass}`}></span>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => handleCornerNudge(nudgeStep, 0)}
                    disabled={activeCornerIndex === null}
                    className={`w-10 h-8 bg-gray-800 hover:bg-gray-700 border border-gray-700 disabled:opacity-30 rounded-lg flex items-center justify-center text-sm font-bold hover:text-white active:scale-90 transition shadow ${textThemeClass}`}
                    title="Nudge Right"
                  >
                    ▶
                  </button>
                </div>
                
                {/* Arrow Down */}
                <button
                  type="button"
                  onClick={() => handleCornerNudge(0, nudgeStep)}
                  disabled={activeCornerIndex === null}
                  className={`w-10 h-8 bg-gray-800 hover:bg-gray-700 border border-gray-700 disabled:opacity-30 rounded-lg flex items-center justify-center text-sm font-bold hover:text-white active:scale-90 transition shadow ${textThemeClass}`}
                  title="Nudge Down"
                >
                  ▼
                </button>
              </div>

              {/* Nudge step sizing selector */}
              <div className="w-full mt-2 pt-2 border-t border-gray-900/60 flex items-center justify-between">
                <span className="text-[10px] text-gray-500 font-semibold">{labels.nudge_step}</span>
                <div className="flex bg-gray-900 p-0.5 rounded-lg border border-gray-850">
                  {[1, 5, 10, 50].map((step) => (
                    <button
                      key={step}
                      type="button"
                      onClick={() => setNudgeStep(step)}
                      className={`px-2 py-0.5 text-[9px] rounded font-mono font-bold transition ${
                        nudgeStep === step
                          ? `${bgThemeClass} text-white shadow`
                          : `text-gray-400 ${hoverBtnClass}`
                      }`}
                    >
                      {step}px
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Precise Coordinate Input Boxes */}
            {activeCornerIndex !== null && (
              <div className="bg-gray-950/40 border border-gray-900 p-2.5 rounded-xl flex flex-col gap-2">
                <div className="text-[10px] text-gray-400 font-bold block">
                  {lang === 'zh' ? `手动输入精确坐标 [${cornerLabelsCompact[activeCornerIndex]}]:` : `Direct Coordinates [${cornerLabelsCompact[activeCornerIndex]}]:`}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[9px] text-gray-500 block mb-1">{labels.coord_x}</span>
                    <input
                      type="number"
                      value={isImg ? imgCornersList[activeCornerIndex * 2] : cornersList[activeCornerIndex * 2]}
                      onChange={(e) => handleCornerDirectInput('x', parseInt(e.target.value))}
                      className={`w-full bg-gray-900 border border-gray-800 ${focusBorderThemeClass} text-gray-150 text-xs py-1 px-2 rounded-lg focus:outline-none font-mono`}
                    />
                  </div>
                  <div>
                    <span className="text-[9px] text-gray-500 block mb-1">{labels.coord_y}</span>
                    <input
                      type="number"
                      value={isImg ? imgCornersList[activeCornerIndex * 2 + 1] : cornersList[activeCornerIndex * 2 + 1]}
                      onChange={(e) => handleCornerDirectInput('y', parseInt(e.target.value))}
                      className={`w-full bg-gray-900 border border-gray-800 ${focusBorderThemeClass} text-gray-150 text-xs py-1 px-2 rounded-lg focus:outline-none font-mono`}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Informational help badges */}
            <span className="text-[9.5px] leading-relaxed block italic w-full text-gray-500">
              {labels.keyboard_tip}
            </span>
          </div>
        )}
      </div>

      <hr className="border-gray-800" />

      {/* SECTION 1: Calibration Scaling */}
      {!settings.cornersModeOn && (
        <>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-gray-400 flex items-center gap-1">
                <ZoomIn className="w-3.5 h-3.5 text-indigo-400" />
                {t.scale_label}
              </label>
              <span className="text-mono text-xs bg-indigo-900/40 text-indigo-300 px-1.5 py-0.5 rounded leading-none">
                {settings.scale.toFixed(3)} px/mm
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => updateSetting('scale', Math.max(0.1, settings.scale - 0.05))}
                className="p-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 active:scale-95 transition"
                title="Slightly scale down"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              
              <input 
                type="range"
                min="0.2"
                max="5.0"
                step="0.01"
                value={settings.scale}
                onChange={(e) => updateSetting('scale', parseFloat(e.target.value))}
                className="flex-1 accent-indigo-500 h-1.5 bg-gray-800 rounded-lg cursor-pointer"
              />

              <button 
                onClick={() => updateSetting('scale', Math.min(10.0, settings.scale + 0.05))}
                className="p-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 active:scale-95 transition"
                title="Slightly scale up"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
            
            {/* Rapid Presets */}
            <div className="flex gap-1.5 mt-2 overflow-x-auto py-1">
              <span className="text-[10px] text-gray-500 self-center leading-none">{lang === 'zh' ? '缩放率:' : 'Presets:'}</span>
              {[0.5, 1.0, 1.5, 2.0, 3.0, 3.78].map((preset) => (
                <button
                  key={preset}
                  onClick={() => applyScalePreset(preset)}
                  className={`text-[10px] px-2 py-0.5 rounded-full border transition leading-none whitespace-nowrap ${
                    Math.abs(settings.scale - preset) < 0.01 
                      ? 'bg-indigo-600 text-white border-indigo-500' 
                      : 'bg-gray-900 text-gray-400 border-gray-800 hover:bg-gray-850'
                  }`}
                >
                  {preset === 3.78 ? '96 DPI (3.78px/mm)' : `${preset}x`}
                </button>
              ))}
            </div>
          </div>

          <hr className="border-gray-800" />

          {/* SECTION 2: Fine-Tuning Coordinates */}
          <div>
            <label className="text-xs font-bold text-gray-400 flex items-center gap-1 mb-2">
              <Move className="w-3.5 h-3.5 text-teal-400" />
              {t.offset_xy} & {t.rotation}
            </label>
            
            {/* XY Offset */}
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="bg-gray-900 p-2 rounded border border-gray-850">
                <span className="text-[10px] text-gray-500 block">X {lang === 'zh' ? '轴偏移' : 'Offset X'}</span>
                <div className="flex items-center justify-between gap-1 mt-1">
                  <button onClick={() => updateSetting('offsetX', settings.offsetX - 5)} className="px-1.5 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-xs">-5</button>
                  <span className="text-xs text-mono">{settings.offsetX} mm</span>
                  <button onClick={() => updateSetting('offsetX', settings.offsetX + 5)} className="px-1.5 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-xs">+5</button>
                </div>
              </div>
              <div className="bg-gray-900 p-2 rounded border border-gray-850">
                <span className="text-[10px] text-gray-500 block">Y {lang === 'zh' ? '轴偏移' : 'Offset Y'}</span>
                <div className="flex items-center justify-between gap-1 mt-1">
                  <button onClick={() => updateSetting('offsetY', settings.offsetY - 5)} className="px-1.5 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-xs">-5</button>
                  <span className="text-xs text-mono">{settings.offsetY} mm</span>
                  <button onClick={() => updateSetting('offsetY', settings.offsetY + 5)} className="px-1.5 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-xs">+5</button>
                </div>
              </div>
            </div>

            {/* Fine rotation angle with 0.1 deg precision */}
            <div className="bg-gray-900 p-2 rounded border border-gray-850 mb-2">
              <div className="flex justify-between items-center text-[10px] text-gray-500">
                <span>{lang === 'zh' ? '旋转矫正' : 'Rotation Adjustment'}</span>
                <span className="text-teal-400 font-mono">{settings.rotation.toFixed(1)}°</span>
              </div>
              <div className="flex items-center justify-between gap-1 mt-1.5">
                <button onClick={() => updateSetting('rotation', Math.max(-180, settings.rotation - 1))} className="px-1.5 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-xs">-1°</button>
                <button onClick={() => updateSetting('rotation', Math.max(-180, settings.rotation - 0.1))} className="px-1 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-[10px] text-gray-400">-0.1°</button>
                
                <input 
                  type="range"
                  min="-30"
                  max="30"
                  step="0.1"
                  value={settings.rotation}
                  onChange={(e) => updateSetting('rotation', parseFloat(e.target.value))}
                  className="flex-1 accent-teal-400 h-1 bg-gray-800 mx-2 cursor-pointer"
                />

                <button onClick={() => updateSetting('rotation', Math.min(180, settings.rotation + 0.1))} className="px-1 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-[10px] text-gray-400">+0.1°</button>
                <button onClick={() => updateSetting('rotation', Math.min(180, settings.rotation + 1))} className="px-1.5 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-xs">+1°</button>
              </div>
            </div>

            {/* Mirror flipping */}
            <div className="flex gap-2">
              <button
                onClick={() => updateSetting('flipX', !settings.flipX)}
                className={`flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded border transition ${
                  settings.flipX ? 'bg-indigo-600/30 border-indigo-500 text-indigo-350' : 'bg-gray-900 border-gray-800 text-gray-400'
                }`}
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                {t.mirror_x} {settings.flipX && 'ON'}
              </button>
              <button
                onClick={() => updateSetting('flipY', !settings.flipY)}
                className={`flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded border transition ${
                  settings.flipY ? 'bg-indigo-600/30 border-indigo-500 text-indigo-350' : 'bg-gray-900 border-gray-800 text-gray-400'
                }`}
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                {t.mirror_y} {settings.flipY && 'ON'}
              </button>
            </div>
          </div>

          <hr className="border-gray-800" />

          {/* SECTION 3: Keystone / Distortion Calibration */}
          <div>
            <label className="text-xs font-bold text-gray-400 flex items-center gap-1 mb-2">
              <RotateCw className="w-3.5 h-3.5 text-amber-400" />
              {t.keystone_label}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="flex justify-between items-center text-[10px] text-gray-500 mb-1">
                  <span>{t.keystone_x}</span>
                  <span className="font-mono text-amber-500">{settings.keystoneX > 0 ? '+' : ''}{(settings.keystoneX * 100).toFixed(0)}%</span>
                </div>
                <input 
                  type="range"
                  min="-0.2"
                  max="0.2"
                  step="0.01"
                  value={settings.keystoneX}
                  onChange={(e) => updateSetting('keystoneX', parseFloat(e.target.value))}
                  className="w-full accent-amber-500 h-1 bg-gray-800 cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between items-center text-[10px] text-gray-500 mb-1">
                  <span>{t.keystone_y}</span>
                  <span className="font-mono text-amber-500">{settings.keystoneY > 0 ? '+' : ''}{(settings.keystoneY * 100).toFixed(0)}%</span>
                </div>
                <input 
                  type="range"
                  min="-0.2"
                  max="0.2"
                  step="0.01"
                  value={settings.keystoneY}
                  onChange={(e) => updateSetting('keystoneY', parseFloat(e.target.value))}
                  className="w-full accent-amber-500 h-1 bg-gray-800 cursor-pointer"
                />
              </div>
            </div>
          </div>

          <hr className="border-gray-800" />
        </>
      )}

      {/* SECTION 4: Grid Layout */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold text-gray-400 flex items-center gap-1">
            <Grid className="w-3.5 h-3.5 text-sky-400" />
            {t.grid_label}
          </label>
          <input 
            type="checkbox"
            checked={settings.gridOn}
            onChange={(e) => updateSetting('gridOn', e.target.checked)}
            className="w-3.5 h-3.5 accent-sky-400 cursor-pointer"
          />
        </div>
        
        {settings.gridOn && (
          <div className="flex gap-2">
            <div className="flex-1 bg-gray-900 rounded p-1 flex border border-gray-800">
              {['cm', 'inch'].map((unit) => (
                <button
                  key={unit}
                  onClick={() => {
                    onChange({
                      ...settings,
                      gridUnit: unit as 'cm' | 'inch',
                      gridInterval: unit === 'cm' ? 50 : 25.4
                    });
                  }}
                  className={`flex-1 text-[10px] py-0.5 rounded text-center transition ${
                    settings.gridUnit === unit ? 'bg-sky-600 text-white font-medium' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {unit === 'cm' ? t.grid_unit_metric : t.grid_unit_imperial}
                </button>
              ))}
            </div>
            
            <select
              value={settings.gridInterval}
              onChange={(e) => updateSetting('gridInterval', parseFloat(e.target.value))}
              className="bg-gray-900 text-gray-300 text-xs rounded px-2 py-1 border border-gray-800 focus:outline-none focus:border-sky-500 cursor-pointer"
            >
              {settings.gridUnit === 'cm' ? (
                <>
                  <option value={10}>1 cm</option>
                  <option value={20}>2 cm</option>
                  <option value={50}>5 cm ({lang === 'zh' ? '标准' : 'Standard'})</option>
                  <option value={100}>10 cm</option>
                </>
              ) : (
                <>
                  <option value={12.7}>0.5 ({lang === 'zh' ? '英寸' : 'inch'})</option>
                  <option value={25.4}>1.0 in ({lang === 'zh' ? '标准' : 'Standard'})</option>
                  <option value={50.8}>2.0 in</option>
                  <option value={101.6}>4.0 in</option>
                </>
              )}
            </select>
          </div>
        )}
      </div>

      <hr className="border-gray-800" />

      {/* SECTION 5: Color Backdrop Themes */}
      <div>
        <label className="text-xs font-bold text-gray-400 flex items-center gap-1 mb-2">
          <Palette className="w-3.5 h-3.5 text-emerald-400" />
          {t.theme_label}
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {THEMES.map((theme) => (
            <button
              key={theme.id}
              onClick={() => updateSetting('theme', theme.id)}
              className={`text-[10px] text-left p-1.5 rounded border transition flex flex-col justify-between ${
                settings.theme === theme.id 
                  ? 'bg-gray-850 border-emerald-500 text-emerald-300' 
                  : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              <span className="font-semibold">{theme.name.split(' ')[0]}</span>
              <span className="text-[9px] text-gray-500 truncate mt-0.5">{theme.name.substr(theme.name.indexOf(' ') + 1)}</span>
            </button>
          ))}
        </div>
      </div>

      <hr className="border-gray-800" />

      {/* SECTION 6: Sewing Adjustments for Parametric Models */}
      <div className="bg-indigo-950/20 p-2.5 rounded-lg border border-indigo-900/40">
        <label className="text-xs font-bold text-indigo-300 flex items-center gap-1 mb-2">
          <Sliders className="w-3.5 h-3.5" />
          {t.advanced_sewing}
        </label>
        <div className="flex flex-col gap-2">
          <div>
            <div className="flex justify-between items-center text-[10px] text-indigo-400 mb-0.5">
              <span>{t.seam_allowance}</span>
              <span className="font-mono font-medium">{seamAllowance / 10} cm</span>
            </div>
            <div className="flex items-center gap-1.5">
              <input 
                type="range"
                min="0"
                max="30"
                step="5"
                value={seamAllowance}
                onChange={(e) => onSeamAllowanceChange(parseInt(e.target.value))}
                className="flex-1 accent-indigo-400 h-1 bg-gray-800 cursor-pointer"
              />
              <span className="text-[10px] text-gray-500 text-mono w-4">{seamAllowance}mm</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center text-[10px] text-indigo-400 mb-0.5">
              <span>{t.ease_allowance}</span>
              <span className="font-mono font-medium">{easeAllowance / 10} cm</span>
            </div>
            <div className="flex items-center gap-1.5">
              <input 
                type="range"
                min="0"
                max="80"
                step="10"
                value={easeAllowance}
                onChange={(e) => onEaseAllowanceChange(parseInt(e.target.value))}
                className="flex-1 accent-indigo-400 h-1 bg-gray-800 cursor-pointer"
              />
              <span className="text-[10px] text-gray-500 text-mono w-4">{easeAllowance}mm</span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 7: Layers visibility */}
      <div>
        <label className="text-xs font-bold text-gray-400 flex items-center gap-1 mb-1.5">
          <Layers className="w-3.5 h-3.5 text-fuchsia-400" />
          {t.layers_manager}
        </label>
        <div className="space-y-1">
          {layers.map((layer) => (
            <div key={layer.id} className="flex justify-between items-center bg-gray-900 p-1.5 rounded border border-gray-850 px-2">
              <span className="text-[11px] text-gray-300 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: layer.color }}></span>
                {layer.id === 'calibration' ? (lang === 'zh' ? '比例校验框' : 'Calibration 10cm Grid') : layer.id === 'net' ? (lang === 'zh' ? '成衣净样裁线' : 'Tailor Net Line') : (lang === 'zh' ? '裁剪外接缝分' : 'Seam Allowance Outline')}
              </span>
              <button
                onClick={() => toggleLayer(layer.id)}
                className={`text-[10px] px-2 py-0.5 rounded leading-none transition ${
                  layer.visible ? 'bg-fuchsia-600 text-white' : 'bg-gray-800 text-gray-500 hover:text-gray-400'
                }`}
              >
                {layer.visible ? t.show_layer : t.hide_layer}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
