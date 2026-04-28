export type Matrix = number[][];

export interface SaddlePointResult {
  rowMins: number[];
  colMaxs: number[];
  maximin: number;
  minimax: number;
  hasSaddlePoint: boolean;
  saddlePoints: { row: number; col: number }[];
}

export function findSaddlePoint(matrix: Matrix): SaddlePointResult {
  const rows = matrix.length;
  const cols = matrix[0].length;

  const rowMins = matrix.map(row => Math.min(...row));
  const colMaxs = Array.from({ length: cols }, (_, colIdx) => 
    Math.max(...matrix.map(row => row[colIdx]))
  );

  const maximin = Math.max(...rowMins);
  const minimax = Math.min(...colMaxs);

  const saddlePoints = [];
  let hasSaddlePoint = false;

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      if (matrix[i][j] === maximin && matrix[i][j] === minimax) {
        hasSaddlePoint = true;
        saddlePoints.push({ row: i, col: j });
      }
    }
  }

  return { rowMins, colMaxs, maximin, minimax, hasSaddlePoint, saddlePoints };
}

export interface DominanceResult {
  reducedMatrix: Matrix;
  rowLabels: number[];
  colLabels: number[];
  eliminated: string[];
}

export function findDominance(matrix: Matrix): DominanceResult {
  let currentMatrix = matrix.map(row => [...row]);
  let rowLabels = Array.from({ length: matrix.length }, (_, i) => i);
  let colLabels = Array.from({ length: matrix[0].length }, (_, i) => i);
  let eliminated: string[] = [];

  let changed = true;
  while (changed) {
    changed = false;
    
    // Check dominated rows (Player A maximizes, so row i dominates row j if i >= j)
    for (let i = 0; i < currentMatrix.length; i++) {
      for (let j = 0; j < currentMatrix.length; j++) {
        if (i !== j) {
          let strictlyGreater = false;
          let allGreaterOrEqual = true;
          for (let k = 0; k < currentMatrix[0].length; k++) {
            if (currentMatrix[i][k] < currentMatrix[j][k]) {
              allGreaterOrEqual = false;
              break;
            }
            if (currentMatrix[i][k] > currentMatrix[j][k]) {
              strictlyGreater = true;
            }
          }
          if (allGreaterOrEqual && strictlyGreater) {
            eliminated.push(`Строка ${rowLabels[j] + 1} доминируется строкой ${rowLabels[i] + 1}`);
            currentMatrix.splice(j, 1);
            rowLabels.splice(j, 1);
            changed = true;
            break;
          }
        }
      }
      if (changed) break;
    }

    if (changed) continue;

    // Check dominated cols (Player B minimizes, so col i dominates col j if i <= j)
    for (let i = 0; i < currentMatrix[0].length; i++) {
      for (let j = 0; j < currentMatrix[0].length; j++) {
        if (i !== j) {
          let strictlyLess = false;
          let allLessOrEqual = true;
          for (let k = 0; k < currentMatrix.length; k++) {
            if (currentMatrix[k][i] > currentMatrix[k][j]) {
              allLessOrEqual = false;
              break;
            }
            if (currentMatrix[k][i] < currentMatrix[k][j]) {
              strictlyLess = true;
            }
          }
          // If strictly less or equal, col i is BETTER for Player B than col j. 
          // Thus we REMOVE col j.
          if (allLessOrEqual && strictlyLess) {
            // It means col i <= col j for all k. B minimises, so B prefers i over j.
            eliminated.push(`Столбец ${colLabels[j] + 1} доминируется столбцом ${colLabels[i] + 1}`);
            for (let k = 0; k < currentMatrix.length; k++) {
              currentMatrix[k].splice(j, 1);
            }
            colLabels.splice(j, 1);
            changed = true;
            break;
          }
        }
      }
      if (changed) break;
    }
  }

  return { reducedMatrix: currentMatrix, rowLabels, colLabels, eliminated };
}

// Algebraic solver for 2x2 matrix
export function solve2x2Mixed(matrix: Matrix): { p: number, q: number, v: number } | null {
  if (matrix.length !== 2 || matrix[0].length !== 2) return null;
  const a = matrix[0][0], b = matrix[0][1];
  const c = matrix[1][0], d = matrix[1][1];
  
  const bottom = (a + d) - (b + c);
  if (bottom === 0) return null; // Parallel, no single mixed equilibrium

  const p = (d - c) / bottom;
  const q = (d - b) / bottom;
  const v = (a * d - b * c) / bottom;

  return { p, q, v };
}

// Brown-Robinson Method
export interface BRSnapshot {
  iter: number;
  aChoice: number;
  bChoice: number;
  cumulativeA: number[];
  cumulativeB: number[];
  vMin: number;
  vMax: number;
  vAvg: number;
}

export function solveBrownRobinson(matrix: Matrix, iterations: number = 1000): {
  history: BRSnapshot[],
  pOpt: number[],
  qOpt: number[],
  vApprox: number
} {
  const rows = matrix.length;
  const cols = matrix[0].length;
  
  let currentA = 0; // arbitrarily start A with row 0
  let currentB = 0;
  
  const aChoiceFreq = new Array(rows).fill(0);
  const bChoiceFreq = new Array(cols).fill(0);
  
  const cumulativeA = new Array(cols).fill(0);
  const cumulativeB = new Array(rows).fill(0);
  
  const history: BRSnapshot[] = [];
  
  for (let iter = 1; iter <= iterations; iter++) {
    // A plays currentA
    aChoiceFreq[currentA]++;
    for (let c = 0; c < cols; c++) {
      cumulativeA[c] += matrix[currentA][c];
    }
    
    // B's best response: minimizes over cumulativeA
    currentB = cumulativeA.indexOf(Math.min(...cumulativeA));
    
    // B plays currentB
    bChoiceFreq[currentB]++;
    for (let r = 0; r < rows; r++) {
      cumulativeB[r] += matrix[r][currentB];
    }
    
    // A's best response for next iter: maximizes over cumulativeB
    currentA = cumulativeB.indexOf(Math.max(...cumulativeB));
    
    const vMin = Math.min(...cumulativeA) / iter;
    const vMax = Math.max(...cumulativeB) / iter;
    const vAvg = (vMin + vMax) / 2;
    
    if (iter <= 10 || iter % Math.ceil(iterations / 20) === 0 || iter === iterations) {
      history.push({
        iter,
        aChoice: currentA,
        bChoice: currentB,
        cumulativeA: [...cumulativeA],
        cumulativeB: [...cumulativeB],
        vMin,
        vMax,
        vAvg
      });
    }
  }
  
  return {
    history,
    pOpt: aChoiceFreq.map(x => x / iterations),
    qOpt: bChoiceFreq.map(x => x / iterations),
    vApprox: history[history.length - 1].vAvg
  };
}

// Simple Simplex Solver for Payoff Matrix (assumes all elements > 0)
export function solveSimplex(matrix: Matrix) {
  // We solve Player B's problem: Minimize Z = y1 + y2 + ... ym
  // Subject to matrix * y >= 1, y >= 0
  // Which is equivalent to Maximize -Z 
  // Standard form: Maximize C = -y1 -y2. But we can use dual:
  // Player A problem: Maximize Z = x1 + x2 ... xn
  // Subject to x * matrix <= 1, x >= 0
  
  const rows = matrix.length;
  const cols = matrix[0].length;
  
  // Tableau size: rows (constraints) = cols of matrix
  // vars = rows of matrix
  // rows of tableau = cols
  // cols of tableau = rows + cols + 1
  
  let tableau = Array.from({length: cols + 1}, () => new Array(rows + cols + 1).fill(0));
  
  // Set up A matrix
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      tableau[i][j] = matrix[j][i];
    }
    // slack
    tableau[i][rows + i] = 1;
    // RHS
    tableau[i][rows + cols] = 1;
  }
  
  // Objective row (Z) minimize x_i, so C = 1,1,1.... Z - sum(x) = 0
  // We maximize sum(x) => Z - x1 - x2 ... = 0
  for (let j = 0; j < rows; j++) {
    tableau[cols][j] = -1;
  }
  
  let iter = 0;
  while (iter < 100) {
    iter++;
    // Find pivot column (most negative in obj row)
    let minVal = 0;
    let pivotCol = -1;
    for (let j = 0; j < rows + cols; j++) {
      if (tableau[cols][j] < minVal) {
        minVal = tableau[cols][j];
        pivotCol = j;
      }
    }
    if (pivotCol === -1) break; // Optimal
    
    // Find pivot row (min ratio > 0)
    let minRatio = Infinity;
    let pivotRow = -1;
    for (let i = 0; i < cols; i++) {
      if (tableau[i][pivotCol] > 0) {
        let ratio = tableau[i][rows + cols] / tableau[i][pivotCol];
        if (ratio < minRatio) {
          minRatio = ratio;
          pivotRow = i;
        }
      }
    }
    
    if (pivotRow === -1) break; // Unbounded? Should not happen for game theory
    
    // Pivot
    let pivotVal = tableau[pivotRow][pivotCol];
    for (let j = 0; j <= rows + cols; j++) {
      tableau[pivotRow][j] /= pivotVal;
    }
    for (let i = 0; i <= cols; i++) {
      if (i !== pivotRow) {
        let factor = tableau[i][pivotCol];
        for (let j = 0; j <= rows + cols; j++) {
          tableau[i][j] -= factor * tableau[pivotRow][j];
        }
      }
    }
  }
  
  // Extract solution
  let Z = tableau[cols][rows + cols];
  let v = 1 / Z;
  
  // To find probabilities p for Player A (primal vars)
  let p = new Array(rows).fill(0);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      if (Math.abs(tableau[i][j] - 1) < 1e-9) {
        let isBasic = true;
        for (let k = 0; k <= cols; k++) {
          if (k !== i && Math.abs(tableau[k][j]) > 1e-9) {
            isBasic = false; break;
          }
        }
        if (isBasic) {
          p[j] = tableau[i][rows + cols] * v;
        }
      }
    }
  }
  
  // Dual prices (shadow prices) for Player B probabilities
  let q = new Array(cols).fill(0);
  for (let j = 0; j < cols; j++) {
    q[j] = tableau[cols][rows + j] * v;
  }
  
  return { p, q, v };
}
