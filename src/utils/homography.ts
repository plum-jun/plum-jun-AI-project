/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Solves a system of linear equations using Gaussian elimination.
 * Ax = b
 */
function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = b.length;
  for (let i = 0; i < n; i++) {
    // Search for maximum in this column
    let maxEl = Math.abs(A[i][i]);
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(A[k][i]) > maxEl) {
        maxEl = Math.abs(A[k][i]);
        maxRow = k;
      }
    }

    // Swap maximum row with current row
    const tempRow = A[maxRow];
    A[maxRow] = A[i];
    A[i] = tempRow;

    const tempB = b[maxRow];
    b[maxRow] = b[i];
    b[i] = tempB;

    // Make all rows below this one 0 in current column
    for (let k = i + 1; k < n; k++) {
      const c = -A[k][i] / A[i][i];
      for (let j = i; j < n; j++) {
        if (i === j) {
          A[k][j] = 0;
        } else {
          A[k][j] += c * A[i][j];
        }
      }
      b[k] += c * b[i];
    }
  }

  // Back substitution
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = b[i] / A[i][i];
    for (let k = i - 1; k >= 0; k--) {
      b[k] -= A[k][i] * x[i];
    }
  }
  return x;
}

/**
 * Computes the 3D perspective matrix to map a rectangle (width, height)
 * onto a quadrilateral defined by its 4 target corners.
 * Coordinates are: [x0,y0, x1,y1, x2,y2, x3,y3] starting from TL, TR, BR, BL
 */
export function getPerspectiveMatrix3d(
  w: number,
  h: number,
  corners: [number, number, number, number, number, number, number, number]
): string {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = corners;

  // Source corners
  const src = [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ];

  const dst = [
    [x0, y0],
    [x1, y1],
    [x2, y2],
    [x3, y3],
  ];

  // Set up the linear equations system A * h = B
  const A: number[][] = [];
  const B: number[] = [];

  for (let i = 0; i < 4; i++) {
    const sx = src[i][0];
    const sy = src[i][1];
    const dx = dst[i][0];
    const dy = dst[i][1];

    A.push([sx, sy, 1, 0, 0, 0, -sx * dx, -sy * dx]);
    B.push(dx);

    A.push([0, 0, 0, sx, sy, 1, -sx * dy, -sy * dy]);
    B.push(dy);
  }

  try {
    const hCoeffs = solveLinearSystem(A, B);
    
    // Homography elements:
    // [ h0, h1, h2 ]
    // [ h3, h4, h5 ]
    // [ h6, h7, 1  ]
    const h0 = hCoeffs[0];
    const h1 = hCoeffs[1];
    const h2 = hCoeffs[2];
    const h3 = hCoeffs[3];
    const h4 = hCoeffs[4];
    const h5 = hCoeffs[5];
    const h6 = hCoeffs[6];
    const h7 = hCoeffs[7];

    // CSS matrix3d is a 4x4 matrix in column-major order:
    // row 0: a00, a10, a20, a30  --> h0, h3, 0, h6
    // row 1: a01, a11, a21, a31  --> h1, h4, 0, h7
    // row 2: a02, a12, a22, a32  --> 0,  0,  1, 0
    // row 3: a03, a13, a23, a33  --> h2, h5, 0, 1
    
    // In CSS format: matrix3d(m00, m01, m02, m03, m10, m11, m12, m13, m20, m21, m22, m23, m30, m31, m32, m33)
    // where columns are listed in order: Col0, Col1, Col2, Col3
    // Col 0: h0, h3, 0, h6
    // Col 1: h1, h4, 0, h7
    // Col 2: 0,  0,  1, 0
    // Col 3: h2, h5, 0, 1
    
    return `matrix3d(
      ${h0.toFixed(9)}, ${h3.toFixed(9)}, 0, ${h6.toFixed(9)},
      ${h1.toFixed(9)}, ${h4.toFixed(9)}, 0, ${h7.toFixed(9)},
      0, 0, 1, 0,
      ${h2.toFixed(9)}, ${h5.toFixed(9)}, 0, 1
    )`;
  } catch (err) {
    console.error('Failed to compute perspective matrix, fallback to standard unity transform.');
    return 'matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)';
  }
}
