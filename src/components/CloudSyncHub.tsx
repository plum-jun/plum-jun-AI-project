/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, Send, Cloud, History, BookmarkCheck,
  RefreshCw, MessageSquare, BookOpen, AlertCircle
} from 'lucide-react';
import { AiMessage, BodyProfile, ProjectData } from '../types';
import { I18N_DICTS } from '../utils/i18n';

interface CloudSyncHubProps {
  projects: ProjectData[];
  selectedProjectId: string;
  onSelectProject: (id: string) => void;
  onSaveProject: (proj: ProjectData) => void;
  onDeleteProject: (id: string) => void;
  currentProfile: BodyProfile;
  currentPatternType: string;
  lang: 'zh' | 'en' | 'ru';
}

export default function CloudSyncHub({
  projects,
  selectedProjectId,
  onSelectProject,
  onSaveProject,
  onDeleteProject,
  currentProfile,
  currentPatternType,
  lang
}: CloudSyncHubProps) {

  const t = I18N_DICTS[lang];

  const getWelcomeMessage = () => {
    if (lang === 'zh') {
      return '✨ 您好，我是您的智能云裁剪顾问！你可以向我询问：\n- 如何在肩膀与手臂之间过度过渡？\n- 马甲/裙子的省缝一般留多大？\n- 怎么利用10cm校对块校正倾斜投影？';
    } else if (lang === 'ru') {
      return '✨ Здравствуйте! Я ваш интеллектуальный облачный консультант по крою. Вы можете спросить меня о:\n- Как сгладить линию перехода от плеча к пройме рукава?\n- Каковы стандартные припуски на вытачки?\n- Как использовать 10-см калибровочный квадрат для настройки проектора?';
    } else {
      return '✨ Welcome to Smart Tailor Cloud Assistant! Ask me anything regarding:\n- How to blend curves from shoulder to sleeve arch?\n- What are the conventional seam allowances?\n- How to calibrate oblique-angle projectors?';
    }
  };

  const [messages, setMessages] = useState<AiMessage[]>([]);

  // Initialize welcome message dynamically on language switches
  useEffect(() => {
    setMessages([
      { 
        id: 'welcome', 
        sender: 'assistant', 
        text: getWelcomeMessage(), 
        timestamp: new Date().toLocaleTimeString() 
      }
    ]);
  }, [lang]);

  const [inputMessage, setInputMessage] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputMessage.trim();
    if (!text || aiLoading) return;

    const userMsg: AiMessage = {
      id: 'msg-' + Date.now(),
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setAiLoading(true);

    try {
      const response = await fetch('/api/gemini/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg],
          currentProfile,
          currentPatternType,
          lang
        })
      });

      if (!response.ok) {
        throw new Error('API server unreachable');
      }

      const data = await response.json();
      setMessages(prev => [...prev, {
        id: 'ai-' + Date.now(),
        sender: 'assistant',
        text: data.reply || (lang === 'zh' ? '没有收到有效的服装数据。' : lang === 'ru' ? 'Выкройки не получены.' : 'No clothing response received.'),
        timestamp: new Date().toLocaleTimeString()
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        id: 'ai-err-' + Date.now(),
        sender: 'assistant',
        text: lang === 'zh' 
          ? '⚠️ 云顾问离线。已使用1cm国标裁剪标准，可在本地畅快投影。建议缝分留出1.0cm。' 
          : lang === 'ru'
            ? '⚠️ Облачный ассистент не в сети. Рекомендован припуск 1.0 см для локального раскроя.'
            : '⚠️ Offline mode active. Standard sewing configurations are saved on your device successfully. Recommended seam allowance is 1.0cm.',
        timestamp: new Date().toLocaleTimeString()
      }]);
    } finally {
      setAiLoading(false);
    }
  };

  const labels = {
    cloudHistory: lang === 'zh' ? '小程序多端云同步打版图纸库' : lang === 'ru' ? 'Синхронизированная библиотека выкроек' : 'WeChat Cloud Synchronization Library',
    aiAssistant: lang === 'zh' ? 'AI 裁缝裁剪指南顾问 (Gemini)' : lang === 'ru' ? 'Облачный AI-ассистент кроя (Gemini)' : 'AI Tailoring Advisor (Gemini Pro)',
    aiLoading: lang === 'zh' ? '云缝纫师傅思考中...' : lang === 'ru' ? 'Ассистент думает...' : 'Advising in progress...',
    placeholder: lang === 'zh' ? '问AI: 如胸围偏大怎么调线？/ 缝分留多少？' : lang === 'ru' ? 'Спросить AI: Как скорректировать грудь? Или зазор шва?' : 'Ask AI: How to offset chest? Or standard darts?',
    deleteConfirm: lang === 'zh' ? '确定删除该打版草稿？' : lang === 'ru' ? 'Удалить этот шаблон?' : 'Are you sure you want to delete this template?',
    deleteBtn: lang === 'zh' ? '删除' : lang === 'ru' ? 'Удалить' : 'Delete',
    unzip: lang === 'zh' ? '导入' : lang === 'ru' ? 'Импорт' : 'Import',
    expert: lang === 'zh' ? '专家模式' : lang === 'ru' ? 'Эксперт' : 'Professional'
  };

  return (
    <div id="cloud-sync-hub-panel" className="bg-gray-950/85 p-4 rounded-xl border border-gray-800 flex flex-col gap-4 text-gray-200">
      
      {/* SECTION 1: Projects History Cloud Gallery */}
      <div>
        <label className="text-xs font-bold text-gray-400 flex items-center gap-1.5 mb-2 leading-none">
          <History className="w-3.5 h-3.5 text-indigo-400" />
          {labels.cloudHistory}
        </label>
        
        <div className="flex flex-col gap-1.5 max-h-[140px] overflow-y-auto pr-1">
          {projects.map((proj) => (
            <div 
              key={proj.id}
              className={`flex items-center justify-between text-xs p-2.5 rounded-lg border transition ${
                proj.id === selectedProjectId 
                  ? 'bg-indigo-650/25 border-indigo-500 text-indigo-300 font-semibold' 
                  : 'bg-gray-905 border-gray-850 text-gray-400 hover:border-gray-700 hover:text-gray-200'
              }`}
            >
              <button 
                onClick={() => onSelectProject(proj.id)}
                className="flex-1 text-left flex flex-col gap-0.5"
                title={lang === 'zh' ? '载入该配置' : 'Load project template'}
              >
                <span>{proj.name}</span>
                <span className="text-[9px] text-gray-500 block font-mono">
                  {lang === 'zh' ? '品类:' : 'Sloper:'} {proj.patternType === 'uploaded' ? (lang === 'zh' ? '导入图纸' : 'Import Shape') : proj.patternType.toUpperCase()} / {lang === 'zh' ? '缩放:' : 'Scale:'} {proj.calibration.scale}x
                </span>
              </button>
              
              {projects.length > 1 && (
                <button
                  onClick={() => {
                    if (confirm(`${labels.deleteConfirm} "${proj.name}"`)) {
                      onDeleteProject(proj.id);
                    }
                  }}
                  className="text-[10px] text-red-500 hover:text-red-450 px-1.5 py-0.5 transition"
                >
                  {labels.deleteBtn}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <hr className="border-gray-800" />

      {/* SECTION 2: AI Tailor Dialog Wizard */}
      <div className="flex flex-col flex-1 gap-2 min-h-[200px]">
        <label className="text-xs font-bold text-gray-400 flex items-center justify-between">
          <span className="flex items-center gap-1.5 leading-none">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            {labels.aiAssistant}
          </span>
          <span className="text-[9px] text-indigo-400 border border-indigo-900/40 px-1.5 py-0.5 rounded-full bg-indigo-950/20">
            {labels.expert}
          </span>
        </label>

        {/* Message board area */}
        <div className="flex-1 bg-gray-900 rounded-lg border border-gray-850 p-2.5 overflow-y-auto font-sans h-[150px] text-xs flex flex-col gap-2.5">
          {messages.map((m) => (
            <div 
              key={m.id}
              className={`flex flex-col max-w-[85%] ${
                m.sender === 'user' ? 'self-end items-end' : 'self-start items-start'
              }`}
            >
              <span className="text-[9px] text-gray-600 mb-0.5 font-mono">{m.timestamp}</span>
              <div className={`p-2 rounded-xl leading-relaxed whitespace-pre-line ${
                m.sender === 'user' 
                  ? 'bg-indigo-600 text-white rounded-tr-none' 
                  : 'bg-gray-800 text-gray-300 rounded-tl-none border border-gray-750'
              }`}>
                {m.text}
              </div>
            </div>
          ))}
          {aiLoading && (
            <div className="self-start flex items-center gap-2 text-gray-500 text-[10px] font-mono animate-pulse">
              <RefreshCw className="w-3 h-3 animate-spin" />
              {labels.aiLoading}
            </div>
          )}
          <div ref={scrollRef}></div>
        </div>

        {/* Form panel */}
        <form onSubmit={handleSendMessage} className="flex gap-1.5">
          <input 
            type="text"
            placeholder={labels.placeholder}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            disabled={aiLoading}
            className="flex-1 bg-gray-900 text-xs px-2.5 py-2 rounded-lg border border-gray-800 focus:outline-none focus:border-indigo-500 text-gray-200 placeholder-gray-650"
          />
          <button
            type="submit"
            disabled={!inputMessage.trim() || aiLoading}
            className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg active:scale-95 transition disabled:opacity-40"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
