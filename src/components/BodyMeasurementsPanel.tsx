/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  User, Check, Plus, Trash2, RefreshCw, 
  Sparkles, Scale, Info
} from 'lucide-react';
import { BodyProfile } from '../types';
import { I18N_DICTS } from '../utils/i18n';

interface BodyMeasurementsPanelProps {
  profiles: BodyProfile[];
  selectedProfileId: string;
  onSelectProfile: (id: string) => void;
  onSaveProfile: (profile: BodyProfile) => void;
  onDeleteProfile: (id: string) => void;
  isSyncing: boolean;
  onForceSync: () => void;
  lang: 'zh' | 'en' | 'ru';
}

export default function BodyMeasurementsPanel({
  profiles,
  selectedProfileId,
  onSelectProfile,
  onSaveProfile,
  onDeleteProfile,
  isSyncing,
  onForceSync,
  lang
}: BodyMeasurementsPanelProps) {
  
  const currentProfile = profiles.find(p => p.id === selectedProfileId) || profiles[0];
  const t = I18N_DICTS[lang];
  
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<BodyProfile>({ ...currentProfile });
  const [newProfileName, setNewProfileName] = useState('');

  const SIZE_PRESETS = [
    { name: lang === 'zh' ? 'XS 标准体型 (155/80A)' : 'XS Size Sloper (155/80A)', height: 155, chest: 80, waist: 64, hips: 84, shoulder: 36, sleeve: 52, collar: 34 },
    { name: lang === 'zh' ? 'S 标准体型 (160/84A)' : 'S Size Sloper (160/84A)', height: 160, chest: 84, waist: 68, hips: 88, shoulder: 37, sleeve: 54, collar: 35 },
    { name: lang === 'zh' ? 'M 标准体型 (165/88A)' : 'M Size Sloper (165/88A)', height: 165, chest: 88, waist: 72, hips: 92, shoulder: 38, sleeve: 56, collar: 36 },
    { name: lang === 'zh' ? 'L 标准体型 (170/92A)' : 'L Size Sloper (170/92A)', height: 170, chest: 92, waist: 76, hips: 96, shoulder: 40, sleeve: 58, collar: 37 },
    { name: lang === 'zh' ? 'XL 标准体型 (175/96A)' : 'XL Size Sloper (175/96A)', height: 175, chest: 96, waist: 80, hips: 100, shoulder: 42, sleeve: 60, collar: 38 },
    { name: lang === 'zh' ? 'XXL 标准体型 (180/100A)' : 'XXL Size Sloper (180/100A)', height: 180, chest: 100, waist: 84, hips: 104, shoulder: 44, sleeve: 62, collar: 40 }
  ];

  React.useEffect(() => {
    if (currentProfile) {
      setEditForm({ ...currentProfile });
    }
  }, [currentProfile]);

  const handleFieldChange = (key: keyof BodyProfile, value: any) => {
    setEditForm(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleApplyPreset = (preset: typeof SIZE_PRESETS[0]) => {
    setEditForm(prev => ({
      ...prev,
      height: preset.height,
      chest: preset.chest,
      waist: preset.waist,
      hips: preset.hips,
      shoulderWidth: preset.shoulder,
      sleeveLength: preset.sleeve,
      collarCirc: preset.collar
    }));
  };

  const handleCreateNew = () => {
    const defaultPrefix = lang === 'zh' ? '新放样体型' : 'New Sloper Profile';
    const name = newProfileName.trim() || `${defaultPrefix} #${profiles.length + 1}`;
    const draft: BodyProfile = {
      id: 'profile-' + Date.now(),
      name,
      gender: 'female',
      height: 165,
      chest: 88,
      waist: 70,
      hips: 92,
      shoulderWidth: 38,
      sleeveLength: 55,
      collarCirc: 36,
      updatedTime: new Date().toISOString()
    };
    onSaveProfile(draft);
    onSelectProfile(draft.id);
    setNewProfileName('');
  };

  const handleSave = () => {
    onSaveProfile(editForm);
    setIsEditing(false);
  };

  const textDict = {
    cloudDB: lang === 'zh' ? '云同步身材档案数据库 (多端实时同步)' : 'Syncing Body Measurements Cloud DB',
    syncing: lang === 'zh' ? '同步中...' : 'Syncing...',
    sync: lang === 'zh' ? '立即同步' : 'Sync Now',
    newProfilePlaceholder: lang === 'zh' ? '输入新建人体型档案命名...' : 'Name new sloper owner...',
    btnCreate: lang === 'zh' ? '新建档案' : 'Create Profile',
    metaTitle: lang === 'zh' ? '体型数理模型尺寸参数 (参数自适应公式)' : 'Body Profile Parameters for Pattern Scaling',
    btnEdit: lang === 'zh' ? '修改数据/放码' : 'Modify Sloper',
    btnSave: lang === 'zh' ? '保存' : 'Save',
    btnCancel: lang === 'zh' ? '取消' : 'Cancel',
    promptPreset: lang === 'zh' ? '一键快速应用国际标准衣服尺码模板:' : 'Apply instant standard clothing sizing templates:',
    theoryIntro: lang === 'zh' ? '参数自适应原理：智能裁缝拼板算法会自动根据输入数据适配。重新分配胸腰臀经纬裁切弧度（例如后领窝深计算为领围/6+1.5cm）。修改将同步实时应用。' : 'Adaptive calculation: Tailoring sloper algorithms auto-adjust with inputs. Rescales dimensions including neck arches and darts dynamically.',
    confirmDelete: lang === 'zh' ? '确认永久删除该体型配置吗？此操作不可逆。' : 'Are you sure you want to delete this sloper? This cannot be undone.'
  };

  return (
    <div id="body-measurements-panel" className="bg-gray-950/85 p-4 rounded-xl border border-gray-800 flex flex-col gap-4 text-gray-200">
      
      {/* SECTION 1: Profile selector list with Sync status */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-xs font-bold text-gray-400 flex items-center gap-1.5 leading-none">
            <User className="w-3.5 h-3.5 text-indigo-400" />
            {textDict.cloudDB}
          </label>
          <button 
            onClick={onForceSync}
            disabled={isSyncing}
            className="text-[10px] text-gray-400 hover:text-white flex items-center gap-1 bg-gray-900 border border-gray-800 px-1.5 py-0.5 rounded active:scale-95 duration-100 disabled:opacity-50"
            title="手动刷新同步云存储端"
          >
            <RefreshCw className={`w-2.5 h-2.5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? textDict.syncing : textDict.sync}
          </button>
        </div>

        <div className="flex flex-col gap-1.5 max-h-[140px] overflow-y-auto pr-1">
          {profiles.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                onSelectProfile(p.id);
                setIsEditing(false);
              }}
              className={`flex items-center justify-between text-xs px-2.5 py-2 rounded-lg border transition ${
                p.id === selectedProfileId 
                  ? 'bg-indigo-650/20 border-indigo-500 text-indigo-300 font-semibold' 
                  : 'bg-gray-900/60 border-gray-850 text-gray-400 hover:border-gray-700 hover:text-gray-200'
              }`}
            >
              <div className="flex flex-col text-left">
                <span>{p.name}</span>
                <span className="text-[10px] text-gray-500 font-mono">
                  {t.profile_height}:{p.height}cm / {t.profile_chest}:{p.chest}cm / {t.profile_waist}:{p.waist}cm
                </span>
              </div>
              {p.id === selectedProfileId && (
                <Check className="w-3.5 h-3.5 text-indigo-500" />
              )}
            </button>
          ))}
        </div>

        {/* Add raw profile template */}
        <div className="flex gap-1.5 mt-2">
          <input 
            type="text"
            placeholder={textDict.newProfilePlaceholder}
            value={newProfileName}
            onChange={(e) => setNewProfileName(e.target.value)}
            className="flex-1 bg-gray-900 text-xs px-2.5 py-2 rounded-lg border border-gray-800 focus:outline-none focus:border-indigo-500 text-gray-200 placeholder-gray-650"
          />
          <button
            onClick={handleCreateNew}
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-lg text-xs flex items-center gap-1 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            {textDict.btnCreate}
          </button>
        </div>
      </div>

      <hr className="border-gray-800" />

      {/* SECTION 2: Interactive metrics & autogeneration config */}
      {currentProfile && (
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-400 font-semibold flex items-center gap-1">
              <Scale className="w-3.5 h-3.5 text-amber-500" />
              {textDict.metaTitle}
            </span>
            
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="text-[10px] bg-gray-900 text-indigo-400 border border-gray-850 px-2.5 py-1 rounded hover:text-indigo-300 transition"
              >
                {textDict.btnEdit}
              </button>
            ) : (
              <div className="flex gap-1">
                <button
                  onClick={handleSave}
                  className="text-[10px] bg-emerald-600 text-white px-2.5 py-1 rounded font-bold transition"
                >
                  {textDict.btnSave}
                </button>
                <button
                  onClick={() => {
                    setEditForm({ ...currentProfile });
                    setIsEditing(false);
                  }}
                  className="text-[10px] bg-gray-800 text-gray-400 px-2.5 py-1 rounded transition"
                >
                  {textDict.btnCancel}
                </button>
              </div>
            )}
          </div>

          {/* Quick presets when in editing mode */}
          {isEditing && (
            <div className="bg-gray-900 p-2 rounded-lg border border-gray-850 mb-1">
              <span className="text-[10px] text-gray-500 block mb-1">{textDict.promptPreset}</span>
              <div className="flex gap-1 overflow-x-auto py-1">
                {SIZE_PRESETS.map((sz) => (
                  <button
                    key={sz.name}
                    onClick={() => handleApplyPreset(sz)}
                    className="text-[9px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white border border-gray-750 whitespace-nowrap active:scale-95 transition"
                  >
                    {sz.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Core measurement sliders/inputs */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
            
            {/* Height cm */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>1. {t.profile_height}</span>
                <span className="font-semibold text-mono text-indigo-400">{isEditing ? editForm.height : currentProfile.height}cm</span>
              </div>
              {isEditing ? (
                <input 
                  type="range" min="100" max="210" step="1"
                  value={editForm.height}
                  onChange={(e) => handleFieldChange('height', parseInt(e.target.value))}
                  className="accent-indigo-500 h-1 cursor-pointer animate-none"
                />
              ) : (
                <div className="h-1 bg-gray-800 rounded">
                  <div className="h-1 bg-indigo-500 rounded" style={{ width: `${Math.min(100, Math.max(0, ((currentProfile.height - 100) / 110) * 100))}%` }}></div>
                </div>
              )}
            </div>

            {/* Chest circ cm */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>2. {t.profile_chest}</span>
                <span className="font-semibold text-mono text-indigo-400">{isEditing ? editForm.chest : currentProfile.chest}cm</span>
              </div>
              {isEditing ? (
                <input 
                  type="range" min="50" max="150" step="1"
                  value={editForm.chest}
                  onChange={(e) => handleFieldChange('chest', parseInt(e.target.value))}
                  className="accent-indigo-500 h-1 cursor-pointer"
                />
              ) : (
                <div className="h-1 bg-gray-800 rounded">
                  <div className="h-1 bg-indigo-500 rounded" style={{ width: `${Math.min(100, Math.max(0, ((currentProfile.chest - 50) / 100) * 100))}%` }}></div>
                </div>
              )}
            </div>

            {/* Waist circ cm */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>3. {t.profile_waist}</span>
                <span className="font-semibold text-mono text-indigo-400">{isEditing ? editForm.waist : currentProfile.waist}cm</span>
              </div>
              {isEditing ? (
                <input 
                  type="range" min="40" max="140" step="1"
                  value={editForm.waist}
                  onChange={(e) => handleFieldChange('waist', parseInt(e.target.value))}
                  className="accent-indigo-500 h-1 cursor-pointer"
                />
              ) : (
                <div className="h-1 bg-gray-800 rounded">
                  <div className="h-1 bg-indigo-500 rounded" style={{ width: `${Math.min(100, Math.max(0, ((currentProfile.waist - 40) / 100) * 100))}%` }}></div>
                </div>
              )}
            </div>

            {/* Hips circ cm */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>4. {t.profile_hips}</span>
                <span className="font-semibold text-mono text-indigo-400">{isEditing ? editForm.hips : currentProfile.hips}cm</span>
              </div>
              {isEditing ? (
                <input 
                  type="range" min="50" max="160" step="1"
                  value={editForm.hips}
                  onChange={(e) => handleFieldChange('hips', parseInt(e.target.value))}
                  className="accent-indigo-500 h-1 cursor-pointer"
                />
              ) : (
                <div className="h-1 bg-gray-800 rounded">
                  <div className="h-1 bg-indigo-500 rounded" style={{ width: `${Math.min(100, Math.max(0, ((currentProfile.hips - 50) / 110) * 100))}%` }}></div>
                </div>
              )}
            </div>

            {/* Shoulder Width cm */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>5. {t.profile_shoulder}</span>
                <span className="font-semibold text-mono text-indigo-400">{isEditing ? editForm.shoulderWidth : currentProfile.shoulderWidth}cm</span>
              </div>
              {isEditing ? (
                <input 
                  type="range" min="25" max="60" step="1"
                  value={editForm.shoulderWidth}
                  onChange={(e) => handleFieldChange('shoulderWidth', parseInt(e.target.value))}
                  className="accent-indigo-500 h-1 cursor-pointer"
                />
              ) : (
                <div className="h-1 bg-gray-800 rounded">
                  <div className="h-1 bg-indigo-500 rounded" style={{ width: `${Math.min(100, Math.max(0, ((currentProfile.shoulderWidth - 25) / 35) * 100))}%` }}></div>
                </div>
              )}
            </div>

            {/* Sleeve Length cm */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>6. {t.profile_sleeve}</span>
                <span className="font-semibold text-mono text-indigo-400">{isEditing ? editForm.sleeveLength : currentProfile.sleeveLength}cm</span>
              </div>
              {isEditing ? (
                <input 
                  type="range" min="15" max="80" step="1"
                  value={editForm.sleeveLength}
                  onChange={(e) => handleFieldChange('sleeveLength', parseInt(e.target.value))}
                  className="accent-indigo-500 h-1 cursor-pointer"
                />
              ) : (
                <div className="h-1 bg-gray-800 rounded">
                  <div className="h-1 bg-indigo-500 rounded" style={{ width: `${Math.min(100, Math.max(0, ((currentProfile.sleeveLength - 15) / 65) * 100))}%` }}></div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-gray-900/40 p-2.5 rounded border border-gray-850 flex gap-2 items-start mt-1">
            <Info className="w-3.5 h-3.5 text-indigo-400 self-start mt-0.5" />
            <div className="text-[10px] text-gray-400 leading-normal">
              {textDict.theoryIntro}
            </div>
          </div>

          {profiles.length > 2 && (
            <button
              onClick={() => {
                if (confirm(textDict.confirmDelete)) {
                  onDeleteProfile(currentProfile.id);
                }
              }}
              className="text-[10px] text-red-500 flex items-center justify-center gap-1 py-1.5 rounded bg-red-950/10 border border-red-900/30 hover:bg-red-950/20 active:scale-95 duration-100 transition mt-2"
            >
              <Trash2 className="w-3 h-3" />
              {lang === 'zh' ? '永久注销此身材配置' : 'Delete This Sloper Profile'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
