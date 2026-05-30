/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface BodyProfile {
  id: string;
  name: string;
  gender: 'female' | 'male' | 'unisex';
  height: number; // in cm
  chest: number; // in cm
  waist: number; // in cm
  hips: number; // in cm
  shoulderWidth: number; // in cm
  sleeveLength: number; // in cm
  collarCirc: number; // in cm
  backLength?: number; // back waist length (cm)
  updatedTime: string;
}

export type GarmentPatternType = 'tshirt' | 'skirt' | 'pants' | 'vest';

export type ContrastTheme = 'classic' | 'neon-green' | 'neon-red' | 'neon-yellow' | 'solarized' | 'blueprint';

export interface CalibrationSettings {
  scale: number; // pixels per mm (normally around 1 to 5)
  rotation: number; // in degrees
  offsetX: number; // in mm
  offsetY: number; // in mm
  keystoneX: number; // aspect horizontal skew/warp (factor)
  keystoneY: number; // aspect vertical skew/warp (factor)
  flipX: boolean;
  flipY: boolean;
  gridOn: boolean;
  gridInterval: number; // in mm (e.g. 10, 50, 25.4)
  gridUnit: 'cm' | 'inch';
  theme: ContrastTheme;
  perspectiveCorners?: [number, number, number, number, number, number, number, number]; // TL.x, TL.y, TR.x, TR.y, BR.x, BR.y, BL.x, BL.y
  cornersModeOn?: boolean;
  imageFit?: 'fill' | 'contain';
  imageCorners?: [number, number, number, number, number, number, number, number]; // Image warping TL, TR, BR, BL corners
  imageCornersModeOn?: boolean;
}

export interface PatternLayer {
  id: string;
  name: string;
  visible: boolean;
  color: string;
  strokeWidth: number;
}

export interface ProjectData {
  id: string;
  name: string;
  patternType: GarmentPatternType | 'uploaded';
  bodyProfileId: string;
  customMeasurements: Partial<BodyProfile>;
  calibration: CalibrationSettings;
  layers: PatternLayer[];
  pdfFileName?: string;
  pdfPageCount?: number;
  pdfCurrentPage?: number;
  updatedTime: string;
}

export interface AiMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}
