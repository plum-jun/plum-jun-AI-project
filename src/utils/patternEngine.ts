/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BodyProfile } from '../types';

export interface PatternPath {
  id: string;
  name: string;
  d: string; // SVG path string in millimeter space
  strokeType: 'cut' | 'fold' | 'stitch' | 'grid' | 'text';
  layerId: string; // matches size XS, S, M, L etc. or 'outline'/'seam'
  label?: string;
  labelPos?: { x: number; y: number };
}

export interface PatternDesign {
  width: number; // overall width in mm
  height: number; // overall height in mm
  paths: PatternPath[];
  testSquareSizeMm: number; // standard calibration box size (e.g. 50 or 100 for check)
}

/**
 * Standard parametric tailoring math
 * Coordinates are computed in Millimeters (1 unit = 1 mm)
 */
export function generateGarmentPattern(
  type: 'tshirt' | 'skirt' | 'pants' | 'vest',
  profile: BodyProfile,
  seamAllowanceMm: number = 10, // Default 10mm seam allowance
  easeAllowanceMm: number = 20, // Default 20mm chest/hip ease offset
): PatternDesign {
  // Convert cm to mm
  const H = profile.height * 10;
  const C = profile.chest * 10;
  const W = profile.waist * 10;
  const Hip = profile.hips * 10;
  const S = profile.shoulderWidth * 10;
  const SL = profile.sleeveLength * 10;
  const CC = profile.collarCirc * 10;

  const paths: PatternPath[] = [];

  // Add 100mm and 2in Calibration Squares at coordinates (50, 50)
  paths.push({
    id: 'calib-square-100',
    name: '100mm 物理尺寸校准方块 (10x10cm)',
    d: 'M 50 50 L 150 50 L 150 150 L 50 150 Z',
    strokeType: 'grid',
    layerId: 'calibration',
    label: '10cm x 10cm 校准块 / Calib Box',
    labelPos: { x: 100, y: 165 }
  });

  paths.push({
    id: 'calib-square-2in',
    name: '2英寸 校准方块 (50.8x50.8mm)',
    d: 'M 180 50 L 230.8 50 L 230.8 100.8 L 180 100.8 Z',
    strokeType: 'grid',
    layerId: 'calibration',
    label: '2" x 2" Box',
    labelPos: { x: 205, y: 115 }
  });

  if (type === 'tshirt') {
    // ---- FITTED/BASIC T-SHIRT (Top Bodice & Sleeve) ----
    // Front half bodice, back half bodice, sleeve layout.
    // Placement coordinate spaces:
    // Front Bodice: X: [100, 500], Y: [200, 900]
    // Back Bodice: X: [550, 950], Y: [200, 900]
    // Sleeve: X: [1000, 1350], Y: [200, 700]

    const ease = easeAllowanceMm / 4; // Ease per quarter pattern
    const qChest = (C / 4) + ease;
    const qWaist = (W / 4) + ease;
    const halfShoulder = S / 2;
    const shirtLength = H * 0.4; // approx 40% of height e.g. 68cm
    const armholeDepth = (C / 10) + 120; // classic tailoring formula
    const neckW = CC / 6 + 5;
    const neckDepthFront = CC / 6 + 15;
    const neckDepthBack = 25;

    // --- FRONT BODICE ---
    const fxBase = 100;
    const fyBase = 250;

    // Points relative to (fxBase, fyBase)
    // 1. Neck center back-top: (0, 0)
    // 2. Neck side shoulder-neck intersection: (neckW, 0)
    // 3. Neck center front: (0, neckDepthFront)
    // 4. Shoulder tip: (halfShoulder, 40) (shoulder slope is 40mm)
    // 5. Bust point outer: (qChest, armholeDepth)
    // 6. Waist point outer: (qWaist, shirtLength * 0.7)
    // 7. Hem point outer: (qChest + 10, shirtLength)
    // 8. Hem center front: (0, shirtLength)

    // Vector Paths - Net Pattern Body
    const netFrontPath = `
      M ${fxBase} ${fyBase + neckDepthFront}
      Q ${fxBase + neckW * 0.7} ${fyBase + neckDepthFront * 0.9} ${fxBase + neckW} ${fyBase}
      L ${fxBase + halfShoulder} ${fyBase + 35}
      Q ${fxBase + halfShoulder - 30} ${fyBase + armholeDepth * 0.6} ${fxBase + qChest} ${fyBase + armholeDepth}
      C ${fxBase + qChest - 10} ${fyBase + shirtLength * 0.65} ${fxBase + qWaist} ${fyBase + shirtLength * 0.7} ${fxBase + qChest + 5} ${fyBase + shirtLength}
      L ${fxBase} ${fyBase + shirtLength}
      Z
    `.replace(/\s+/g, ' ');

    paths.push({
      id: 'tshirt-front-net',
      name: '前片 净样线 (Front Center Half)',
      d: netFrontPath,
      strokeType: 'stitch',
      layerId: 'net',
      label: '前片 1/2 对折裁线 / FRONT PANEL (1/2 Fold)',
      labelPos: { x: fxBase + qChest / 2, y: fyBase + shirtLength / 2 }
    });

    // Seam Allowance outer outline (Adding 10mm seam allowance to neckline, shoulder, armhole, side, hem)
    const slFrontPath = `
      M ${fxBase} ${fyBase + neckDepthFront + seamAllowanceMm}
      Q ${fxBase + neckW * 0.7} ${fyBase + neckDepthFront * 0.9 + seamAllowanceMm} ${fxBase + neckW + seamAllowanceMm * 0.3} ${fyBase - seamAllowanceMm}
      L ${fxBase + halfShoulder + seamAllowanceMm * 0.5} ${fyBase + 25}
      Q ${fxBase + halfShoulder - 15} ${fyBase + armholeDepth * 0.6} ${fxBase + qChest + seamAllowanceMm} ${fyBase + armholeDepth + seamAllowanceMm * 0.5}
      C ${fxBase + qChest - 10 + seamAllowanceMm} ${fyBase + shirtLength * 0.65} ${fxBase + qWaist + seamAllowanceMm} ${fyBase + shirtLength * 0.7} ${fxBase + qChest + 5 + seamAllowanceMm} ${fyBase + shirtLength + seamAllowanceMm}
      L ${fxBase} ${fyBase + shirtLength + seamAllowanceMm}
      Z
    `.replace(/\s+/g, ' ');

    paths.push({
      id: 'tshirt-front-seam',
      name: '前片 裁剪线 (Front Seam Allow)',
      d: slFrontPath,
      strokeType: 'cut',
      layerId: 'seam',
    });

    // --- BACK BODICE ---
    const bxBase = 550;
    const byBase = 250;

    const netBackPath = `
      M ${bxBase} ${byBase + neckDepthBack}
      Q ${bxBase + neckW * 0.7} ${byBase + neckDepthBack * 0.5} ${bxBase + neckW} ${byBase}
      L ${bxBase + halfShoulder} ${byBase + 35}
      Q ${bxBase + halfShoulder - 30} ${byBase + armholeDepth * 0.6} ${bxBase + qChest} ${byBase + armholeDepth}
      C ${bxBase + qChest - 10} ${byBase + shirtLength * 0.65} ${bxBase + qWaist} ${byBase + shirtLength * 0.7} ${bxBase + qChest + 5} ${byBase + shirtLength}
      L ${bxBase} ${byBase + shirtLength}
      Z
    `.replace(/\s+/g, ' ');

    paths.push({
      id: 'tshirt-back-net',
      name: '后片 净样线 (Back Center Half)',
      d: netBackPath,
      strokeType: 'stitch',
      layerId: 'net',
      label: '后片 1/2 对折裁线 / BACK PANEL (1/2 Fold)',
      labelPos: { x: bxBase + qChest / 2, y: byBase + shirtLength / 2 }
    });

    const slBackPath = `
      M ${bxBase} ${byBase + neckDepthBack - seamAllowanceMm}
      Q ${bxBase + neckW * 0.7} ${byBase + neckDepthBack * 0.5 - seamAllowanceMm} ${bxBase + neckW + seamAllowanceMm * 0.3} ${byBase - seamAllowanceMm}
      L ${bxBase + halfShoulder + seamAllowanceMm * 0.5} ${byBase + 25}
      Q ${bxBase + halfShoulder - 15} ${byBase + armholeDepth * 0.6} ${bxBase + qChest + seamAllowanceMm} ${byBase + armholeDepth + seamAllowanceMm * 0.5}
      C ${bxBase + qChest - 10 + seamAllowanceMm} ${byBase + shirtLength * 0.65} ${bxBase + qWaist + seamAllowanceMm} ${byBase + shirtLength * 0.7} ${bxBase + qChest + 5 + seamAllowanceMm} ${byBase + shirtLength + seamAllowanceMm}
      L ${bxBase} ${byBase + shirtLength + seamAllowanceMm}
      Z
    `.replace(/\s+/g, ' ');

    paths.push({
      id: 'tshirt-back-seam',
      name: '后片 裁剪线 (Back Seam Allow)',
      d: slBackPath,
      strokeType: 'cut',
      layerId: 'seam',
    });

    // --- SLEEVE ---
    const sxBase = 1000;
    const syBase = 250;
    const capHeight = armholeDepth * 0.6;
    const wristCirc = (C * 0.15) + 60; // Standard proportion
    const halfSleeveW = (C / 10) + 50;

    const netSleevePath = `
      M ${sxBase + halfSleeveW} ${syBase}
      C ${sxBase + halfSleeveW * 0.8} ${syBase - capHeight} ${sxBase + halfSleeveW * 0.3} ${syBase - capHeight * 0.8} ${sxBase} ${syBase - capHeight}
      C ${sxBase - halfSleeveW * 0.3} ${syBase - capHeight * 0.8} ${sxBase - halfSleeveW * 0.8} ${syBase - capHeight} ${sxBase - halfSleeveW} ${syBase}
      L ${sxBase - wristCirc / 2} ${syBase + SL}
      L ${sxBase + wristCirc / 2} ${syBase + SL}
      Z
    `.replace(/\s+/g, ' ');

    paths.push({
      id: 'tshirt-sleeve-net',
      name: '袖片 净样线 (Sleeve Symmetry)',
      d: netSleevePath,
      strokeType: 'stitch',
      layerId: 'net',
      label: '袖子 两片 / SLEEVE (Cut 2)',
      labelPos: { x: sxBase, y: syBase + SL / 3 }
    });

    const slSleevePath = `
      M ${sxBase + halfSleeveW + seamAllowanceMm} ${syBase}
      C ${sxBase + (halfSleeveW + seamAllowanceMm) * 0.8} ${syBase - capHeight - seamAllowanceMm} ${sxBase + (halfSleeveW + seamAllowanceMm) * 0.3} ${syBase - capHeight - seamAllowanceMm * 0.8} ${sxBase} ${syBase - capHeight - seamAllowanceMm}
      C ${sxBase - (halfSleeveW + seamAllowanceMm) * 0.3} ${syBase - capHeight - seamAllowanceMm * 0.8} ${sxBase - (halfSleeveW + seamAllowanceMm) * 0.8} ${syBase - capHeight - seamAllowanceMm} ${sxBase - halfSleeveW - seamAllowanceMm} ${syBase}
      L ${sxBase - wristCirc / 2 - seamAllowanceMm} ${syBase + SL + seamAllowanceMm}
      L ${sxBase + wristCirc / 2 + seamAllowanceMm} ${syBase + SL + seamAllowanceMm}
      Z
    `.replace(/\s+/g, ' ');

    paths.push({
      id: 'tshirt-sleeve-seam',
      name: '袖片 裁剪线 (Sleeve Seam Allow)',
      d: slSleevePath,
      strokeType: 'cut',
      layerId: 'seam',
    });

  } else if (type === 'skirt') {
    // ---- BASICS A-LINE SKIRT PATTERN ----
    // Front half panel, back half panel.
    // Placement coordinate spaces:
    // Front Panel: X: [100, 500], Y: [200, 850]
    // Back Panel:  X: [550, 950], Y: [200, 850]

    const skirtLength = H * 0.35 + 50; // Custom length ~ 55-65cm
    const hipDepth = 180; // Standard 180mm from waist
    const easeh = easeAllowanceMm / 4;
    const qWaistNet = (W / 4) + 15; // with dart ease
    const qHipNet = (Hip / 4) + easeh;

    // --- FRONT SKIRT PANEL ---
    const fxBase = 100;
    const fyBase = 250;
    const hemWidthFront = qHipNet + 80; // A-line flare out

    const netSkirtFront = `
      M ${fxBase} ${fyBase + 5}
      Q ${fxBase + qWaistNet * 0.5} ${fyBase} ${fxBase + qWaistNet} ${fyBase + 8}
      Q ${fxBase + qHipNet * 0.95} ${fyBase + hipDepth} ${fxBase + hemWidthFront} ${fyBase + skirtLength}
      L ${fxBase} ${fyBase + skirtLength}
      Z
    `.replace(/\s+/g, ' ');

    paths.push({
      id: 'skirt-front-net',
      name: '前裙片 净样线 (A-Line Front 1/2)',
      d: netSkirtFront,
      strokeType: 'stitch',
      layerId: 'net',
      label: '裙前片 (对折) / FRONT SKIRT (Fold)',
      labelPos: { x: fxBase + qHipNet / 2, y: fyBase + skirtLength / 2 }
    });

    // Seam Allowance Front
    const slSkirtFront = `
      M ${fxBase} ${fyBase + 5 - seamAllowanceMm}
      Q ${fxBase + qWaistNet * 0.5} ${fyBase - seamAllowanceMm} ${fxBase + qWaistNet + seamAllowanceMm * 0.5} ${fyBase + 8 - seamAllowanceMm * 0.5}
      Q ${fxBase + qHipNet * 0.95 + seamAllowanceMm} ${fyBase + hipDepth} ${fxBase + hemWidthFront + seamAllowanceMm} ${fyBase + skirtLength + seamAllowanceMm}
      L ${fxBase} ${fyBase + skirtLength + seamAllowanceMm}
      Z
    `.replace(/\s+/g, ' ');

    paths.push({
      id: 'skirt-front-seam',
      name: '前裙片 裁剪线 (Front Seam Allow)',
      d: slSkirtFront,
      strokeType: 'cut',
      layerId: 'seam',
    });

    // --- BACK SKIRT PANEL (With Darts and zipper opening allowance) ---
    // Dart details: dart tip at hip line / 2
    const bxBase = 550;
    const byBase = 250;
    const hemWidthBack = qHipNet + 70;
    const dartCenter = qWaistNet * 0.45;
    const dartW = 24; // 2.4cm dart width
    const dartDepth = 110;

    const netSkirtBack = `
      M ${bxBase} ${byBase + 8}
      L ${bxBase + dartCenter - dartW / 2} ${byBase + 5}
      L ${bxBase + dartCenter} ${byBase + dartDepth}
      L ${bxBase + dartCenter + dartW / 2} ${byBase + 4}
      Q ${bxBase + qWaistNet * 0.8} ${byBase + 2} ${bxBase + qWaistNet} ${byBase + 10}
      Q ${bxBase + qHipNet * 0.95} ${byBase + hipDepth} ${bxBase + hemWidthBack} ${byBase + skirtLength}
      L ${bxBase} ${byBase + skirtLength}
      Z
    `.replace(/\s+/g, ' ');

    paths.push({
      id: 'skirt-back-net',
      name: '后裙片 净样线 (A-Line Back 1/2)',
      d: netSkirtBack,
      strokeType: 'stitch',
      layerId: 'net',
      label: '裙后片 (裁单侧x2) / BACK SKIRT (Cut 2)',
      labelPos: { x: bxBase + qHipNet / 2, y: byBase + skirtLength / 2 }
    });

    // Adding seam allowance with dart folded representation
    const slSkirtBack = `
      M ${bxBase - seamAllowanceMm} ${byBase + 8}
      L ${bxBase + dartCenter - dartW / 2} ${byBase + 5 - seamAllowanceMm}
      L ${bxBase + dartCenter + dartW / 2} ${byBase + 4 - seamAllowanceMm}
      Q ${bxBase + qWaistNet * 0.8} ${byBase + 2 - seamAllowanceMm} ${bxBase + qWaistNet + seamAllowanceMm * 0.5} ${byBase + 10 - seamAllowanceMm * 0.5}
      Q ${bxBase + qHipNet * 0.95 + seamAllowanceMm} ${byBase + hipDepth} ${bxBase + hemWidthBack + seamAllowanceMm} ${byBase + skirtLength + seamAllowanceMm}
      L ${bxBase - seamAllowanceMm} ${byBase + skirtLength + seamAllowanceMm}
      Z
    `.replace(/\s+/g, ' ');

    paths.push({
      id: 'skirt-back-seam',
      name: '后裙片 裁剪线 (Back Seam Allow)',
      d: slSkirtBack,
      strokeType: 'cut',
      layerId: 'seam',
    });

  } else if (type === 'pants') {
    // ---- BASICS FITTED PANTS/SHORTS PATTERN ----
    // Multi size shorts/pants generator.
    // Front scale: X: [100, 550], Y: [200, 800]
    // Back scale:  X: [600, 1100], Y: [200, 800]

    const outseam = H * 0.25 + 100; // Shorts leg length
    const crDepth = (Hip / 4) + 60; // crotch depth formula
    const qWaist = (W / 4) + 20;
    const qHip = (Hip / 4) + 15;
    const crExtensionsFront = Hip / 16; // Crotch extension Front
    const crExtensionsBack = Hip / 8; // Crotch extension Back

    // --- FRONT TROUSER PANEL ---
    const fxBase = 100;
    const fyBase = 250;

    paths.push({
      id: 'pants-front-net',
      name: '前裤片 净样线 (Front Leg Panel)',
      d: `
        M ${fxBase} ${fyBase}
        L ${fxBase + qWaist} ${fyBase}
        L ${fxBase + qHip} ${fyBase + crDepth * 0.8}
        Q ${fxBase + qHip - 5} ${fyBase + crDepth * 0.95} ${fxBase + qHip + crExtensionsFront} ${fyBase + crDepth}
        L ${fxBase + qHip + crExtensionsFront * 0.6} ${fyBase + outseam}
        L ${fxBase + 40} ${fyBase + outseam}
        Z
      `.replace(/\s+/g, ' '),
      strokeType: 'stitch',
      layerId: 'net',
      label: '前裤片 裁剪2片 / PANTS FRONT (Cut 2)',
      labelPos: { x: fxBase + qHip / 2 + 10, y: fyBase + outseam / 2 }
    });

    const slPantsFront = `
      M ${fxBase - seamAllowanceMm} ${fyBase - seamAllowanceMm}
      L ${fxBase + qWaist + seamAllowanceMm * 0.5} ${fyBase - seamAllowanceMm}
      L ${fxBase + qHip + seamAllowanceMm} ${fyBase + crDepth * 0.8}
      Q ${fxBase + qHip + seamAllowanceMm - 5} ${fyBase + crDepth * 0.95 + seamAllowanceMm * 0.5} ${fxBase + qHip + crExtensionsFront + seamAllowanceMm} ${fyBase + crDepth + seamAllowanceMm}
      L ${fxBase + qHip + crExtensionsFront * 0.6 + seamAllowanceMm} ${fyBase + outseam + seamAllowanceMm}
      L ${fxBase + 40 - seamAllowanceMm} ${fyBase + outseam + seamAllowanceMm}
      Z
    `.replace(/\s+/g, ' ');

    paths.push({
      id: 'pants-front-seam',
      name: '前裤片 裁剪线 (Front Seam Allow)',
      d: slPantsFront,
      strokeType: 'cut',
      layerId: 'seam',
    });

    // --- BACK TROUSER PANEL ---
    const bxBase = 600;
    const byBase = 250;

    paths.push({
      id: 'pants-back-net',
      name: '后裤片 净样线 (Back Leg Panel)',
      d: `
        M ${bxBase} ${byBase + 30}
        L ${bxBase + qWaist - 10} ${byBase}
        L ${bxBase + qHip} ${byBase + crDepth * 0.7}
        Q ${bxBase + qHip + 10} ${byBase + crDepth * 0.95} ${bxBase + qHip + crExtensionsBack} ${byBase + crDepth}
        L ${bxBase + qHip + crExtensionsBack * 0.5} ${byBase + outseam}
        L ${bxBase + 20} ${byBase + outseam}
        Z
      `.replace(/\s+/g, ' '),
      strokeType: 'stitch',
      layerId: 'net',
      label: '后裤片 裁剪2片 / PANTS BACK (Cut 2)',
      labelPos: { x: bxBase + qHip / 2, y: byBase + outseam / 2 }
    });

    const slPantsBack = `
      M ${bxBase - seamAllowanceMm} ${byBase + 30 - seamAllowanceMm}
      L ${bxBase + qWaist - 10 + seamAllowanceMm * 0.5} ${byBase - seamAllowanceMm}
      L ${bxBase + qHip + seamAllowanceMm} ${byBase + crDepth * 0.7}
      Q ${bxBase + qHip + 10 + seamAllowanceMm} ${byBase + crDepth * 0.95 + seamAllowanceMm * 0.5} ${bxBase + qHip + crExtensionsBack + seamAllowanceMm} ${byBase + crDepth + seamAllowanceMm}
      L ${bxBase + qHip + crExtensionsBack * 0.5 + seamAllowanceMm} ${byBase + outseam + seamAllowanceMm}
      L ${bxBase + 20 - seamAllowanceMm} ${byBase + outseam + seamAllowanceMm}
      Z
    `.replace(/\s+/g, ' ');

    paths.push({
      id: 'pants-back-seam',
      name: '后裤片 裁剪线 (Back Seam Allow)',
      d: slPantsBack,
      strokeType: 'cut',
      layerId: 'seam',
    });

  } else {
    // ---- TAILORED VEST PATTERN ----
    // Front half panel, back half panel.
    // Front panel: X: [100, 500], Y: [200, 850]
    // Back panel: X: [550, 950], Y: [200, 850]

    const vestLength = H * 0.33; // ~ 50-55cm
    const vHeight = vestLength;
    const neckW = CC / 6;
    const neckDepth = 150; // Vest V-Neck drop
    const armholeDepth = (C / 10) + 140;
    const qChest = (C / 4) + 10;
    const qWaist = (W / 4) + 15; // with bodice suppression
    const halfShoulder = S / 2 - 15; // sleeveless narrow shoulder

    const fxBase = 100;
    const fyBase = 250;

    // V-neck fitted front half with pointed hem
    paths.push({
      id: 'vest-front-net',
      name: '前马甲片 净样线 (Vest Front)',
      d: `
        M ${fxBase} ${fyBase + neckDepth}
        L ${fxBase + neckW} ${fyBase}
        L ${fxBase + halfShoulder} ${fyBase + 30}
        Q ${fxBase + halfShoulder - 40} ${fyBase + armholeDepth * 0.6} ${fxBase + qChest} ${fyBase + armholeDepth}
        L ${fxBase + qWaist} ${fyBase + vHeight * 0.8}
        L ${fxBase + qWaist - 10} ${fyBase + vHeight}
        L ${fxBase + 40} ${fyBase + vHeight + 50}
        L ${fxBase} ${fyBase + vHeight}
        Z
      `.replace(/\s+/g, ' '),
      strokeType: 'stitch',
      layerId: 'net',
      label: '前马甲片 裁剪两部 / VEST FRONT (Cut 2)',
      labelPos: { x: fxBase + qChest / 2, y: fyBase + vHeight / 2 }
    });

    const slVestFront = `
      M ${fxBase - seamAllowanceMm} ${fyBase + neckDepth + seamAllowanceMm}
      L ${fxBase + neckW} ${fyBase - seamAllowanceMm}
      L ${fxBase + halfShoulder + seamAllowanceMm * 0.5} ${fyBase + 30 - seamAllowanceMm * 0.5}
      Q ${fxBase + halfShoulder - 40} ${fyBase + armholeDepth * 0.6} ${fxBase + qChest + seamAllowanceMm} ${fyBase + armholeDepth + seamAllowanceMm}
      L ${fxBase + qWaist + seamAllowanceMm} ${fyBase + vHeight * 0.8}
      L ${fxBase + qWaist - 10 + seamAllowanceMm} ${fyBase + vHeight + seamAllowanceMm}
      L ${fxBase + 40} ${fyBase + vHeight + 50 + seamAllowanceMm}
      L ${fxBase - seamAllowanceMm} ${fyBase + vHeight + seamAllowanceMm}
      Z
    `.replace(/\s+/g, ' ');

    paths.push({
      id: 'vest-front-seam',
      name: '前马甲片 裁剪线 (Vest Front Seam)',
      d: slVestFront,
      strokeType: 'cut',
      layerId: 'seam',
    });

    // Back Panel
    const bxBase = 550;
    const byBase = 250;

    paths.push({
      id: 'vest-back-net',
      name: '后马甲片 净样线 (Vest Back)',
      d: `
        M ${bxBase} ${byBase + 25}
        Q ${bxBase + neckW * 0.7} ${byBase + 10} ${bxBase + neckW} ${byBase}
        L ${bxBase + halfShoulder} ${byBase + 30}
        Q ${bxBase + halfShoulder - 40} ${byBase + armholeDepth * 0.6} ${bxBase + qChest} ${byBase + armholeDepth}
        L ${bxBase + qWaist} ${byBase + vHeight * 0.85}
        L ${bxBase} ${byBase + vHeight * 0.9}
        Z
      `.replace(/\s+/g, ' '),
      strokeType: 'stitch',
      layerId: 'net',
      label: '后马甲片 (对折) / VEST BACK (Fold)',
      labelPos: { x: bxBase + qChest / 2, y: byBase + vHeight / 2 }
    });

    const slVestBack = `
      M ${bxBase} ${byBase + 25 - seamAllowanceMm}
      Q ${bxBase + neckW * 0.7} ${byBase + 10 - seamAllowanceMm} ${bxBase + neckW + seamAllowanceMm * 0.3} ${byBase - seamAllowanceMm}
      L ${bxBase + halfShoulder + seamAllowanceMm * 0.5} ${byBase + 30 - seamAllowanceMm * 0.5}
      Q ${bxBase + halfShoulder - 40} ${byBase + armholeDepth * 0.6} ${bxBase + qChest + seamAllowanceMm} ${byBase + armholeDepth + seamAllowanceMm}
      L ${bxBase + qWaist + seamAllowanceMm} ${byBase + vHeight * 0.85 + seamAllowanceMm}
      L ${bxBase} ${byBase + vHeight * 0.9 + seamAllowanceMm}
      Z
    `.replace(/\s+/g, ' ');

    paths.push({
      id: 'vest-back-seam',
      name: '后马甲片 裁剪线 (Vest Back Seam)',
      d: slVestBack,
      strokeType: 'cut',
      layerId: 'seam',
    });
  }

  // Calculate overall SVG dimensions (typically 1500mm x 1000mm)
  return {
    width: 1500,
    height: 1000,
    paths,
    testSquareSizeMm: 100
  };
}
