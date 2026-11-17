import {
  type EvaluatedCell,
  type EvaluatedRowStep,
  MAX_SHEET_ROWS,
  SHEET_COLS,
  SHEET_ROWS,
  type SheetCol,
  type SheetEvaluationResult,
  type SheetRawGrid,
} from '../types/chimera.ts';
import { fibonacciNumber, GOLDEN_ANGLE_RAD, INV_PHI, PHI } from './mathArtTheory.ts';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const COORD_RE = /^([A-F])([1-9]|[1-3][0-9]|4[0-8])$/;

export function clampFreq(hz: number): number {
  if (!Number.isFinite(hz)) return 220;
  return Math.max(20, Math.min(4000, hz));
}

export function clampGate(gate: number): number {
  if (!Number.isFinite(gate)) return 0;
  return Math.max(0, Math.min(1, gate));
}

export function clampFmIndex(idx: number): number {
  if (!Number.isFinite(idx)) return 0;
  return Math.max(0, Math.min(12, idx));
}

export function clampDecayMs(ms: number): number {
  if (!Number.isFinite(ms)) return 220;
  return Math.max(40, Math.min(900, ms));
}

export function clampModRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) return 2;
  return Math.max(0.25, Math.min(8, ratio));
}

export function freqToNoteName(hz: number): string {
  const safe = clampFreq(hz);
  const midi = Math.round(69 + 12 * Math.log2(safe / 440));
  const note = NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${note}${octave}`;
}

export function makeCoord(col: SheetCol, row: number): string {
  return `${col}${row}`;
}

type Token =
  | { type: 'num'; value: number }
  | { type: 'ident'; value: string }
  | { type: 'op'; value: string }
  | { type: 'paren'; value: '(' | ')' }
  | { type: 'comma' }
  | { type: 'colon' };

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let numStr = '';
      while (i < expr.length && /[0-9.]/.test(expr[i])) {
        numStr += expr[i++];
      }
      const val = Number(numStr);
      if (!Number.isFinite(val)) throw new Error('Invalid number');
      tokens.push({ type: 'num', value: val });
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let id = '';
      while (i < expr.length && /[A-Za-z0-9_]/.test(expr[i])) {
        id += expr[i++];
      }
      tokens.push({ type: 'ident', value: id.toUpperCase() });
      continue;
    }
    if (ch === '(' || ch === ')') {
      tokens.push({ type: 'paren', value: ch });
      i++;
      continue;
    }
    if (ch === ',') {
      tokens.push({ type: 'comma' });
      i++;
      continue;
    }
    if (ch === ':') {
      tokens.push({ type: 'colon' });
      i++;
      continue;
    }
    const two = expr.slice(i, i + 2);
    if (two === '<=' || two === '>=' || two === '!=' || two === '<>' || two === '==') {
      tokens.push({ type: 'op', value: two });
      i += 2;
      continue;
    }
    if ('+-*/^=<>'.includes(ch)) {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }
    throw new Error(`Unexpected token "${ch}"`);
  }
  return tokens;
}

function expandRange(startCoord: string, endCoord: string): string[] {
  const m1 = COORD_RE.exec(startCoord);
  const m2 = COORD_RE.exec(endCoord);
  if (!m1 || !m2) throw new Error(`Invalid range ${startCoord}:${endCoord}`);
  const c1 = SHEET_COLS.indexOf(m1[1] as SheetCol);
  const c2 = SHEET_COLS.indexOf(m2[1] as SheetCol);
  const r1 = Number(m1[2]);
  const r2 = Number(m2[2]);
  const coords: string[] = [];
  for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) {
    for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) {
      coords.push(`${SHEET_COLS[c]}${r}`);
    }
  }
  return coords;
}

export function evaluateSheet(
  grid: SheetRawGrid,
  rowCount = SHEET_ROWS,
): SheetEvaluationResult {
  const safeRows = Math.max(SHEET_ROWS, Math.min(MAX_SHEET_ROWS, Math.floor(rowCount)));
  const evaluated = new Map<string, EvaluatedCell>();
  const visiting = new Set<string>();
  const cycleCoords = new Set<string>();

  const evalCell = (coord: string): EvaluatedCell => {
    const existing = evaluated.get(coord);
    if (existing) return existing;

    const raw = (grid[coord] ?? '').trim();
    if (raw === '') {
      const empty: EvaluatedCell = { coord, raw, value: 0, isFormula: false };
      evaluated.set(coord, empty);
      return empty;
    }

    if (!raw.startsWith('=')) {
      const num = Number(raw);
      const cell: EvaluatedCell = Number.isFinite(num)
        ? { coord, raw, value: num, isFormula: false }
        : { coord, raw, value: 0, error: '#NAN!', isFormula: false };
      evaluated.set(coord, cell);
      return cell;
    }

    if (visiting.has(coord)) {
      cycleCoords.add(coord);
      return { coord, raw, value: 0, error: '#CYCLE!', isFormula: true };
    }

    visiting.add(coord);
    const matchCoord = COORD_RE.exec(coord);
    const currentColIdx = matchCoord ? SHEET_COLS.indexOf(matchCoord[1] as SheetCol) + 1 : 1;
    const currentRow = matchCoord ? Number(matchCoord[2]) : 1;

    try {
      const tokens = tokenize(raw.slice(1));
      let pos = 0;

      const peek = (): Token | undefined => tokens[pos];
      const consume = (): Token => tokens[pos++];
      const peekOp = (): string | null => {
        const t = peek();
        return t?.type === 'op' ? t.value : null;
      };
      const isCloseParen = (): boolean => {
        const t = peek();
        return t?.type === 'paren' && t.value === ')';
      };

      const parseComparison = (): number => {
        let left = parseAddSub();
        while (true) {
          const op = peekOp();
          if (!op || !['=', '==', '!=', '<>', '<', '<=', '>', '>='].includes(op)) break;
          consume();
          const right = parseAddSub();
          if (op === '=' || op === '==') left = left === right ? 1 : 0;
          else if (op === '!=' || op === '<>') left = left !== right ? 1 : 0;
          else if (op === '<') left = left < right ? 1 : 0;
          else if (op === '<=') left = left <= right ? 1 : 0;
          else if (op === '>') left = left > right ? 1 : 0;
          else if (op === '>=') left = left >= right ? 1 : 0;
        }
        return left;
      };

      const parseAddSub = (): number => {
        let left = parseMulDiv();
        while (true) {
          const op = peekOp();
          if (op !== '+' && op !== '-') break;
          consume();
          const right = parseMulDiv();
          left = op === '+' ? left + right : left - right;
        }
        return left;
      };

      const parseMulDiv = (): number => {
        let left = parsePow();
        while (true) {
          const op = peekOp();
          if (op !== '*' && op !== '/') break;
          consume();
          const right = parsePow();
          if (op === '/') {
            if (right === 0) throw new Error('#DIV/0!');
            left = left / right;
          } else {
            left = left * right;
          }
        }
        return left;
      };

      const parsePow = (): number => {
        let base = parseUnary();
        if (peekOp() === '^') {
          consume();
          const exp = parsePow();
          base = Math.pow(base, exp);
        }
        return base;
      };

      const parseUnary = (): number => {
        const op = peekOp();
        if (op === '-' || op === '+') {
          consume();
          const val = parseUnary();
          return op === '-' ? -val : val;
        }
        return parsePrimary();
      };

      const evalArgList = (): number[] => {
        const vals: number[] = [];
        if (isCloseParen()) {
          consume();
          return vals;
        }
        while (pos < tokens.length) {
          const t0 = tokens[pos];
          const t1 = tokens[pos + 1];
          const t2 = tokens[pos + 2];
          if (t0?.type === 'ident' && t1?.type === 'colon' && t2?.type === 'ident') {
            pos += 3;
            for (const c of expandRange(t0.value, t2.value)) {
              const res = evalCell(c);
              if (res.error) throw new Error(res.error);
              vals.push(res.value);
            }
          } else {
            vals.push(parseComparison());
          }
          if (peek()?.type === 'comma') {
            consume();
          } else {
            break;
          }
        }
        if (!isCloseParen()) {
          throw new Error('#SYNTAX!');
        }
        consume();
        return vals;
      };

      const parsePrimary = (): number => {
        const tok = peek();
        if (!tok) throw new Error('#SYNTAX!');
        if (tok.type === 'num') {
          consume();
          return tok.value;
        }
        if (tok.type === 'paren' && tok.value === '(') {
          consume();
          const val = parseComparison();
          if (!isCloseParen()) {
            throw new Error('#SYNTAX!');
          }
          consume();
          return val;
        }
        if (tok.type === 'ident') {
          consume();
          const name = tok.value;
          const nextTok = peek();
          if (
            name === 'PI' ||
            name === 'PHI' ||
            name === 'INV_PHI' ||
            name === 'GOLDEN_ANGLE' ||
            name === 'GOLDEN_ANGLE_RAD'
          ) {
            if (nextTok?.type === 'paren' && nextTok.value === '(') {
              consume();
              if (isCloseParen()) consume();
            }
            if (name === 'PHI') return PHI;
            if (name === 'INV_PHI') return INV_PHI;
            if (name === 'GOLDEN_ANGLE' || name === 'GOLDEN_ANGLE_RAD') return GOLDEN_ANGLE_RAD;
            return Math.PI;
          }
          if (nextTok?.type === 'paren' && nextTok.value === '(') {
            consume();
            const args = evalArgList();
            switch (name) {
              case 'ROW':
                return currentRow;
              case 'COL':
                return currentColIdx;
              case 'FIB':
              case 'FIBONACCI':
                return fibonacciNumber(args[0] ?? 0);
              case 'PERTURB':
              case 'WARP': {
                const v = args[0] ?? 0;
                const amt = Math.max(-1, Math.min(1, args[1] ?? 0.15));
                return v * (1 + Math.sin(currentRow * GOLDEN_ANGLE_RAD + currentColIdx * PHI) * amt);
              }
              case 'SUM':
                return args.reduce((a, b) => a + b, 0);
              case 'AVG':
                return args.length ? args.reduce((a, b) => a + b, 0) / args.length : 0;
              case 'MIN':
                return args.length ? Math.min(...args) : 0;
              case 'MAX':
                return args.length ? Math.max(...args) : 0;
              case 'SIN':
                return Math.sin(args[0] ?? 0);
              case 'COS':
                return Math.cos(args[0] ?? 0);
              case 'ABS':
                return Math.abs(args[0] ?? 0);
              case 'SQRT':
                return Math.sqrt(Math.max(0, args[0] ?? 0));
              case 'ROUND':
                return Math.round(args[0] ?? 0);
              case 'FLOOR':
                return Math.floor(args[0] ?? 0);
              case 'CEIL':
                return Math.ceil(args[0] ?? 0);
              case 'POW':
                return Math.pow(args[0] ?? 0, args[1] ?? 1);
              case 'MOD': {
                const divisor = args[1] ?? 1;
                if (divisor === 0) throw new Error('#DIV/0!');
                return (((args[0] ?? 0) % divisor) + divisor) % divisor;
              }
              case 'IF':
                return (args[0] ?? 0) !== 0 ? (args[1] ?? 0) : (args[2] ?? 0);
              default:
                throw new Error('#NAME?');
            }
          }
          if (COORD_RE.test(name)) {
            const ref = evalCell(name);
            if (ref.error) throw new Error(ref.error);
            return ref.value;
          }
          throw new Error('#REF!');
        }
        throw new Error('#SYNTAX!');
      };

      const result = parseComparison();
      if (pos < tokens.length) throw new Error('#SYNTAX!');
      if (!Number.isFinite(result)) throw new Error('#NUM!');

      const cell: EvaluatedCell = { coord, raw, value: result, isFormula: true };
      evaluated.set(coord, cell);
      visiting.delete(coord);
      return cell;
    } catch (err: unknown) {
      visiting.delete(coord);
      const errMsg = err instanceof Error ? err.message : '#ERR!';
      if (errMsg === '#CYCLE!') cycleCoords.add(coord);
      const cell: EvaluatedCell = {
        coord,
        raw,
        value: 0,
        error: errMsg.startsWith('#') ? errMsg : '#ERR!',
        isFormula: true,
      };
      evaluated.set(coord, cell);
      return cell;
    }
  };

  for (let r = 1; r <= safeRows; r++) {
    for (const c of SHEET_COLS) {
      evalCell(makeCoord(c, r));
    }
  }

  const cellsObj: Record<string, EvaluatedCell> = {};
  let errorCount = 0;
  for (const [k, v] of evaluated.entries()) {
    cellsObj[k] = v;
    if (v.error) errorCount++;
  }

  const steps: EvaluatedRowStep[] = [];
  for (let r = 1; r <= safeRows; r++) {
    const a = cellsObj[`A${r}`];
    const b = cellsObj[`B${r}`];
    const c = cellsObj[`C${r}`];
    const d = cellsObj[`D${r}`];
    const e = cellsObj[`E${r}`];
    const f = cellsObj[`F${r}`];
    const freqHz = clampFreq(a?.value ?? 220);
    const gate = clampGate(b?.value ?? 0);
    const fmIndex = clampFmIndex(c?.value ?? 1);
    const orbitX = Math.max(10, Math.min(100, Number.isFinite(d?.value) ? d.value : 50));
    const decayMs = clampDecayMs(e?.value ?? 220);
    const modRatio = clampModRatio(f?.value ?? 2);
    const hasError = Boolean(a?.error || b?.error || c?.error || d?.error || e?.error || f?.error);
    steps.push({
      row: r,
      freqHz,
      gate,
      fmIndex,
      orbitX,
      decayMs,
      modRatio,
      noteName: freqToNoteName(freqHz),
      hasError,
    });
  }

  return {
    cells: cellsObj,
    steps,
    stepCount: safeRows,
    errorCount,
    cycleCoords: Array.from(cycleCoords),
  };
}

export function serializeSheetToCsv(grid: SheetRawGrid, rowCount = SHEET_ROWS): string {
  const safeRows = Math.max(SHEET_ROWS, Math.min(MAX_SHEET_ROWS, Math.floor(rowCount)));
  const lines: string[] = [];
  for (let r = 1; r <= safeRows; r++) {
    const rowVals = SHEET_COLS.map((c) => {
      const raw = grid[makeCoord(c, r)] ?? '';
      if (raw.includes(',') || raw.includes('"') || raw.includes('\n')) {
        return `"${raw.replace(/"/g, '""')}"`;
      }
      return raw;
    });
    lines.push(rowVals.join(','));
  }
  return lines.join('\n');
}

export function parseCsvToSheet(csv: string): SheetRawGrid {
  const grid: SheetRawGrid = {};
  const lines = csv.replace(/\r\n/g, '\n').split('\n').slice(0, MAX_SHEET_ROWS);
  const count = Math.max(SHEET_ROWS, lines.length);

  for (let r = 0; r < count; r++) {
    const line = lines[r] ?? '';
    const fields: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    fields.push(cur);

    SHEET_COLS.forEach((col, cIdx) => {
      grid[makeCoord(col, r + 1)] = fields[cIdx] ?? '';
    });
  }
  return grid;
}
