/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Ensure database folders exist
const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'projects_db.json');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// Initial Data Seed
const defaultProfiles = [
  {
    id: 'profile-user',
    name: '我的体型身材 (主力档)',
    gender: 'female' as const,
    height: 165,
    chest: 90,
    waist: 72,
    hips: 95,
    shoulderWidth: 38,
    sleeveLength: 56,
    collarCirc: 36,
    updatedTime: new Date().toISOString()
  },
  {
    id: 'profile-mom',
    name: '妈妈的体型 (旗袍微调版)',
    gender: 'female' as const,
    height: 158,
    chest: 96,
    waist: 80,
    hips: 102,
    shoulderWidth: 40,
    sleeveLength: 52,
    collarCirc: 38,
    updatedTime: new Date().toISOString()
  },
  {
    id: 'profile-father',
    name: '爸爸的身材 (正装衬衫)',
    gender: 'male' as const,
    height: 175,
    chest: 104,
    waist: 92,
    hips: 105,
    shoulderWidth: 46,
    sleeveLength: 60,
    collarCirc: 41,
    updatedTime: new Date().toISOString()
  }
];

const defaultProjects = [
  {
    id: 'project-tshirt',
    name: '经典吸湿透气T恤 (自适应版)',
    patternType: 'tshirt',
    bodyProfileId: 'profile-user',
    customMeasurements: {},
    calibration: {
      scale: 1.5,
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
      theme: 'neon-green'
    },
    layers: [
      { id: 'calibration', name: '尺寸校准层 (Grid & Rulers)', visible: true, color: '#10b981', strokeWidth: 1.5 },
      { id: 'net', name: '衣服净样裁线 (Finished Outline)', visible: true, color: '#3b82f6', strokeWidth: 2 },
      { id: 'seam', name: '衣服带缝分裁剪线 (Cutting Outline)', visible: true, color: '#f43f5e', strokeWidth: 2 }
    ],
    updatedTime: new Date().toISOString()
  },
  {
    id: 'project-skirt',
    name: '优雅秋季A字半身裙',
    patternType: 'skirt',
    bodyProfileId: 'profile-user',
    customMeasurements: { waist: 74, hips: 98 },
    calibration: {
      scale: 1.5,
      rotation: 0.5,
      offsetX: 10,
      offsetY: -5,
      keystoneX: 0,
      keystoneY: 0,
      flipX: false,
      flipY: false,
      gridOn: true,
      gridInterval: 10,
      gridUnit: 'cm',
      theme: 'neon-yellow'
    },
    layers: [
      { id: 'calibration', name: '尺寸校准层 (Grid & Rulers)', visible: true, color: '#eab308', strokeWidth: 1.5 },
      { id: 'net', name: '半裙净样裁层', visible: true, color: '#3b82f6', strokeWidth: 2 },
      { id: 'seam', name: '半裙带缝分裁剪层', visible: true, color: '#ef4444', strokeWidth: 2.5 }
    ],
    updatedTime: new Date().toISOString()
  }
];

interface DBStructure {
  projects: any[];
  profiles: any[];
}

function loadDB(): DBStructure {
  try {
    if (fs.existsSync(DB_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
      return {
        projects: parsed.projects || defaultProjects,
        profiles: parsed.profiles || defaultProfiles,
      };
    }
  } catch (e) {
    console.error('Failed to load local DB file, rolling back to seed.', e);
  }
  return { projects: defaultProjects, profiles: defaultProfiles };
}

function saveDB(data: DBStructure) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save to local DB file');
  }
}

// Ensure database is bootstrapped right away
saveDB(loadDB());


// --- API ROUTES ---

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// GET profiles
app.get('/api/profiles', (req, res) => {
  const db = loadDB();
  res.json(db.profiles);
});

// POST profile
app.post('/api/profiles', (req, res) => {
  const db = loadDB();
  const newProfile = req.body;
  if (!newProfile.id) {
    newProfile.id = 'profile-' + Date.now();
  }
  newProfile.updatedTime = new Date().toISOString();

  const idx = db.profiles.findIndex(p => p.id === newProfile.id);
  if (idx >= 0) {
    db.profiles[idx] = newProfile;
  } else {
    db.profiles.push(newProfile);
  }

  saveDB(db);
  res.json({ success: true, profile: newProfile });
});

// DELETE profile
app.delete('/api/profiles/:id', (req, res) => {
  const db = loadDB();
  db.profiles = db.profiles.filter(p => p.id !== req.params.id);
  // Also clean projects pointing to this profile optionally or repoint to unisex
  saveDB(db);
  res.json({ success: true });
});

// GET projects
app.get('/api/projects', (req, res) => {
  const db = loadDB();
  res.json(db.projects);
});

// POST project
app.post('/api/projects', (req, res) => {
  const db = loadDB();
  const newProj = req.body;
  if (!newProj.id) {
    newProj.id = 'project-' + Date.now();
  }
  newProj.updatedTime = new Date().toISOString();

  const idx = db.projects.findIndex(p => p.id === newProj.id);
  if (idx >= 0) {
    db.projects[idx] = newProj;
  } else {
    db.projects.push(newProj);
  }

  saveDB(db);
  res.json({ success: true, project: newProj });
});

// DELETE project
app.delete('/api/projects/:id', (req, res) => {
  const db = loadDB();
  db.projects = db.projects.filter(p => p.id !== req.params.id);
  saveDB(db);
  res.json({ success: true });
});

// --- GOOGLE GEMINI AI ASSISTANT ---
// Uses the recommended @google/genai SDK strictly from server side with process.env.GEMINI_API_KEY
app.post('/api/gemini/assist', async (req, res) => {
  try {
    const { messages, currentProfile, currentPatternType } = req.body;
    
    if (!process.env.GEMINI_API_KEY) {
      return res.status(200).json({
        reply: "😊 您好！我是您的智能云缝纫助理。由于当前运行环境未检测到 GEMINI_API_KEY，我暂以本地模拟专家模式为您解答。您可以在 Settings > Secrets 栏目中添加密钥以开通高性能AI制图功能。\n\n针对您的提问，裁缝制图中的缝分对齐通常建议：胸围、臀围预留 2-3cm 的宽松量，夏季T恤缝分选择 1cm 宽，双针包边领口选用 0.8cm，这样在打印投影及实际缝纫时体验最佳。"
      });
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    // Structure conversation context
    const systemPrompt = `你是一位专业的数字缝纫、服装打版和家用投影仪裁剪对齐专家。
由于用户正在使用具有“智能裁剪投影仪 (Pattern Projector)”功能的系统，该系统支持实时在线自适应调整、尺寸参数微调、以及1:1的数码投影对发布料裁剪。
请结合以下上下文：
- 当前选择的样片种类: ${currentPatternType || '未选择'}
- 当前选中的用户身材数据: ${JSON.stringify(currentProfile || '默认体型')}
请提供专业、简练、并且具有对裁剪裁剪友好的指导。回复时要亲切、注重实用性（如缝边建议、布料选材、投影对齐时的防偏技巧、体型大版微调指南等），并字数保持在250字以内，采用Markdown格式排版。`;

    const chatHistory = messages.map((m: any) => ({
      role: m.sender === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }]
    }));

    // Generate output
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: [
        { role: 'user', parts: [{ text: `请指导我有关：${messages[messages.length - 1].text}` }] }
      ],
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
      }
    });

    const replyText = response.text || "未能生成回应，请重试。";
    res.json({ reply: replyText });

  } catch (error: any) {
    console.error('Gemini API Error:', error);
    res.status(500).json({ error: 'AI 服务处理时发生异常，请稍后再试。' });
  }
});


// --- INTEGRATING VITE MIDDLEWARE ---
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Sewing Projector Server] running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
