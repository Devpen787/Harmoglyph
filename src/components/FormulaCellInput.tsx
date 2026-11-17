import {
  ClipboardEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  findFormulaHintByName,
  FormulaMathHint,
  getFormulaHints,
} from '../engine/mathArtTheory';
import { MathFoundationId } from '../types/chimera';

export type FormulaTokenKind =
  | 'eq'
  | 'fn'
  | 'const'
  | 'ref'
  | 'num'
  | 'op'
  | 'paren'
  | 'unknown'
  | 'ws'
  | 'plain';

export interface FormulaSyntaxToken {
  kind: FormulaTokenKind;
  text: string;
}

const CELL_COORD_RE = /^[A-F]([1-9]|[1-3][0-9]|4[0-8])$/i;

export function tokenizeFormulaSyntax(value: string): FormulaSyntaxToken[] {
  if (!value) return [];
  if (!value.startsWith('=')) {
    const trimmed = value.trim();
    const isNum = trimmed === '' || Number.isFinite(Number(trimmed));
    return [{ kind: isNum ? 'plain' : 'unknown', text: value }];
  }

  const tokens: FormulaSyntaxToken[] = [{ kind: 'eq', text: '=' }];
  let i = 1;

  while (i < value.length) {
    const ch = value[i];

    if (/\s/.test(ch)) {
      let ws = '';
      while (i < value.length && /\s/.test(value[i])) {
        ws += value[i++];
      }
      tokens.push({ kind: 'ws', text: ws });
      continue;
    }

    if (/[0-9.]/.test(ch)) {
      let num = '';
      while (i < value.length && /[0-9.]/.test(value[i])) {
        num += value[i++];
      }
      const valid = Number.isFinite(Number(num));
      tokens.push({ kind: valid ? 'num' : 'unknown', text: num });
      continue;
    }

    if (/[A-Za-z_]/.test(ch)) {
      let id = '';
      while (i < value.length && /[A-Za-z0-9_]/.test(value[i])) {
        id += value[i++];
      }
      const hint = findFormulaHintByName(id);
      if (hint) {
        tokens.push({
          kind: hint.kind === 'function' ? 'fn' : 'const',
          text: id,
        });
      } else if (CELL_COORD_RE.test(id)) {
        tokens.push({ kind: 'ref', text: id });
      } else {
        tokens.push({ kind: 'unknown', text: id });
      }
      continue;
    }

    if (ch === '(' || ch === ')') {
      tokens.push({ kind: 'paren', text: ch });
      i++;
      continue;
    }

    const two = value.slice(i, i + 2);
    if (two === '<=' || two === '>=' || two === '!=' || two === '<>' || two === '==') {
      tokens.push({ kind: 'op', text: two });
      i += 2;
      continue;
    }

    if ('+-*/^=<>,:'.includes(ch)) {
      tokens.push({ kind: 'op', text: ch });
      i++;
      continue;
    }

    tokens.push({ kind: 'unknown', text: ch });
    i++;
  }

  return tokens;
}

function tokenClassName(kind: FormulaTokenKind): string {
  switch (kind) {
    case 'eq':
      return 'text-[#8A99B8]';
    case 'fn':
      return 'text-[#00E5CC]';
    case 'const':
      return 'text-[#F59E0B]';
    case 'ref':
      return 'text-[#38BDF8]';
    case 'num':
      return 'text-[#EDF2F9]';
    case 'paren':
      return 'text-[#CBD5E1]';
    case 'op':
      return 'text-[#8A99B8]';
    case 'unknown':
      return 'text-[#F43F5E] underline decoration-dotted decoration-[#F43F5E]';
    default:
      return 'text-[#EDF2F9]';
  }
}

interface CaretFormulaContext {
  isFormula: boolean;
  prefix: string;
  tokenStart: number;
  tokenEnd: number;
  shouldShowHints: boolean;
  activeFnHint: FormulaMathHint | null;
}

function getCaretFormulaContext(value: string, caret: number): CaretFormulaContext {
  if (!value.startsWith('=')) {
    return {
      isFormula: false,
      prefix: '',
      tokenStart: caret,
      tokenEnd: caret,
      shouldShowHints: false,
      activeFnHint: null,
    };
  }

  const safeCaret = Math.max(1, Math.min(value.length, caret));
  const before = value.slice(0, safeCaret);

  // Check if user is mid-identifier right before the caret
  const idMatch = /([A-Za-z_][A-Za-z0-9_]*)$/.exec(before);
  const prefix = idMatch ? idMatch[1] : '';
  const tokenStart = idMatch ? safeCaret - prefix.length : safeCaret;

  // Find enclosing open function call for signature call-tip
  let depth = 0;
  let activeFnHint: FormulaMathHint | null = null;
  for (let idx = before.length - 1; idx >= 1; idx--) {
    const c = before[idx];
    if (c === ')') {
      depth++;
    } else if (c === '(') {
      if (depth === 0) {
        const fnMatch = /([A-Za-z_][A-Za-z0-9_]*)$/.exec(before.slice(0, idx));
        if (fnMatch) {
          const found = findFormulaHintByName(fnMatch[1]);
          if (found?.kind === 'function') {
            activeFnHint = found;
          }
        }
        break;
      }
      depth--;
    }
  }

  const justStartedFormula = safeCaret === 1 && value === '=';
  const isCellCoord = prefix.length > 0 && CELL_COORD_RE.test(prefix);
  const isExactTypedHint =
    prefix.length > 0 &&
    Boolean(findFormulaHintByName(prefix)) &&
    value[safeCaret] === '(';

  const shouldShowHints =
    justStartedFormula || (prefix.length > 0 && !isCellCoord && !isExactTypedHint);

  return {
    isFormula: true,
    prefix,
    tokenStart,
    tokenEnd: safeCaret,
    shouldShowHints,
    activeFnHint,
  };
}

interface PopoverCoords {
  left: number;
  top?: number;
  bottom?: number;
}

interface FormulaCellInputProps {
  value: string;
  onChange: (nextValue: string) => void;
  onFocus?: () => void;
  foundation: MathFoundationId;
  ariaLabel: string;
  hasError?: boolean;
  variant?: 'cell' | 'bar';
  placeholder?: string;
  autoFocus?: boolean;
}

export function FormulaCellInput({
  value,
  onChange,
  onFocus,
  foundation,
  ariaLabel,
  hasError = false,
  variant = 'cell',
  placeholder,
  autoFocus = false,
}: FormulaCellInputProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const [isFocused, setIsFocused] = useState(false);
  const [caretPos, setCaretPos] = useState(value.length);
  const [dismissedAtValue, setDismissedAtValue] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [popoverCoords, setPopoverCoords] = useState<PopoverCoords | null>(null);

  const syncScroll = useCallback(() => {
    if (inputRef.current && overlayRef.current) {
      overlayRef.current.scrollLeft = inputRef.current.scrollLeft;
    }
  }, []);

  const refreshCaret = useCallback(() => {
    if (!inputRef.current) return;
    setCaretPos(inputRef.current.selectionStart ?? value.length);
    syncScroll();
  }, [syncScroll, value.length]);

  useEffect(() => {
    syncScroll();
  }, [value, syncScroll]);

  useEffect(() => {
    if (!autoFocus) return;
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    const len = input.value.length;
    input.setSelectionRange(len, len);
  }, [autoFocus]);

  const context = useMemo(
    () => getCaretFormulaContext(value, caretPos),
    [value, caretPos],
  );

  const hints = useMemo(() => {
    if (!isFocused || !context.isFormula || !context.shouldShowHints) return [];
    const list = getFormulaHints(context.prefix, foundation);
    return list.slice(0, 6);
  }, [isFocused, context.isFormula, context.shouldShowHints, context.prefix, foundation]);

  const isPopoverOpen =
    isFocused &&
    dismissedAtValue !== value &&
    (hints.length > 0 || context.activeFnHint !== null);

  useEffect(() => {
    setSelectedIndex(0);
  }, [context.prefix, value]);

  const updatePopoverPosition = useCallback(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const estimatedHeight = hints.length > 0 ? 236 : 56;
    const spaceBelow = window.innerHeight - rect.bottom;
    const maxWidth = 340;
    const clampedLeft = Math.max(8, Math.min(rect.left, window.innerWidth - maxWidth - 8));

    if (spaceBelow < estimatedHeight && rect.top > estimatedHeight) {
      setPopoverCoords({
        left: clampedLeft,
        bottom: window.innerHeight - rect.top + 4,
      });
    } else {
      setPopoverCoords({
        left: clampedLeft,
        top: rect.bottom + 4,
      });
    }
  }, [hints.length]);

  useEffect(() => {
    if (!isPopoverOpen) return;
    updatePopoverPosition();
    window.addEventListener('scroll', updatePopoverPosition, true);
    window.addEventListener('resize', updatePopoverPosition);
    return () => {
      window.removeEventListener('scroll', updatePopoverPosition, true);
      window.removeEventListener('resize', updatePopoverPosition);
    };
  }, [isPopoverOpen, updatePopoverPosition]);

  const applyHint = useCallback(
    (hint: FormulaMathHint) => {
      const before = value.slice(0, context.tokenStart);
      const after = value.slice(context.tokenEnd);
      // Avoid duplicate parens if user already typed '(' right after cursor
      const insertText =
        hint.kind === 'function' && after.startsWith('(')
          ? hint.name
          : hint.insertText;
      const nextValue = `${before}${insertText}${after}`;
      const nextCursor =
        before.length +
        insertText.length -
        (insertText === hint.insertText ? hint.cursorBackOffset : 0);

      setDismissedAtValue(null);
      onChange(nextValue);

      requestAnimationFrame(() => {
        const input = inputRef.current;
        if (!input) return;
        input.focus();
        input.setSelectionRange(nextCursor, nextCursor);
        setCaretPos(nextCursor);
        syncScroll();
      });
    },
    [value, context.tokenStart, context.tokenEnd, onChange, syncScroll],
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (hints.length > 0 && dismissedAtValue !== value) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % hints.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + hints.length) % hints.length);
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const chosen = hints[selectedIndex] ?? hints[0];
        if (chosen) applyHint(chosen);
        return;
      }
      if (e.key === 'Enter' && context.prefix.length > 0) {
        const chosen = hints[selectedIndex] ?? hints[0];
        if (chosen && chosen.name !== context.prefix.toUpperCase()) {
          e.preventDefault();
          applyHint(chosen);
          return;
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setDismissedAtValue(value);
        return;
      }
    } else if (e.key === 'Escape' && isPopoverOpen) {
      e.preventDefault();
      setDismissedAtValue(value);
    }
  };

  const handlePaste = (_e: ClipboardEvent<HTMLInputElement>) => {
    requestAnimationFrame(refreshCaret);
  };

  const tokens = useMemo(() => tokenizeFormulaSyntax(value), [value]);

  const inputSizingClass =
    variant === 'bar'
      ? 'px-2.5 py-1 text-xs leading-[18px]'
      : 'px-0 py-0 text-xs leading-[18px]';

  return (
    <div ref={wrapperRef} className="relative flex-1 min-w-0">
      <div className="relative w-full overflow-hidden">
        {/* Syntax-Highlighted Mirror Layer */}
        <div
          ref={overlayRef}
          aria-hidden="true"
          className={`pointer-events-none select-none font-mono-tabular tracking-[0.01em] whitespace-pre overflow-hidden ${inputSizingClass}`}
        >
          {value.length === 0 ? (
            <span className="text-[#5E6E8E]">{placeholder ?? '\u00A0'}</span>
          ) : (
            tokens.map((tok, idx) => (
              <span
                key={idx}
                className={
                  hasError && !value.startsWith('=')
                    ? 'text-[#F43F5E]'
                    : tokenClassName(tok.kind)
                }
              >
                {tok.text}
              </span>
            ))
          )}
        </div>

        {/* Transparent Editable Input Layer */}
        <input
          ref={inputRef}
          type="text"
          aria-label={ariaLabel}
          value={value}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          onFocus={(e) => {
            setIsFocused(true);
            setDismissedAtValue(null);
            setCaretPos(e.currentTarget.selectionStart ?? value.length);
            onFocus?.();
          }}
          onBlur={() => {
            setIsFocused(false);
          }}
          onChange={(e) => {
            setDismissedAtValue(null);
            setCaretPos(e.currentTarget.selectionStart ?? e.target.value.length);
            onChange(e.target.value);
          }}
          onClick={refreshCaret}
          onKeyUp={refreshCaret}
          onKeyDown={handleKeyDown}
          onScroll={syncScroll}
          onPaste={handlePaste}
          className={`absolute inset-0 w-full h-full bg-transparent font-mono-tabular tracking-[0.01em] text-transparent caret-[#00E5CC] selection:bg-[#00E5CC]/25 focus:outline-none ${inputSizingClass}`}
        />
      </div>

      {/* Formula Auto-Completion & Signature Hint Popover */}
      {isPopoverOpen && popoverCoords && (
        <div
          role="listbox"
          aria-label="Formula function suggestions"
          style={{
            position: 'fixed',
            left: popoverCoords.left,
            ...(popoverCoords.top !== undefined ? { top: popoverCoords.top } : {}),
            ...(popoverCoords.bottom !== undefined ? { bottom: popoverCoords.bottom } : {}),
            zIndex: 80,
          }}
          className="w-[340px] max-w-[calc(100vw-16px)] rounded-md border border-[#1F2A40] bg-[#0B0F17] shadow-2xl overflow-hidden text-xs"
        >
          {context.activeFnHint && (
            <div className="px-2.5 py-1.5 bg-[#111622] border-b border-[#1F2A40] flex flex-col gap-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] font-semibold text-[#00E5CC]">
                  {context.activeFnHint.signature}
                </span>
                <span className="text-[10px] text-[#8A99B8]">
                  {context.activeFnHint.source}
                </span>
              </div>
              <span className="text-[11px] text-[#8A99B8] leading-snug">
                {context.activeFnHint.summary}
              </span>
            </div>
          )}

          {hints.length > 0 && (
            <>
              <div className="divide-y divide-[#1F2A40]/70 max-h-[210px] overflow-y-auto">
                {hints.map((hint, idx) => {
                  const active = idx === selectedIndex;
                  return (
                    <button
                      key={hint.name}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        applyHint(hint);
                      }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full text-left px-2.5 py-1.5 flex flex-col gap-0.5 transition-colors cursor-pointer ${
                        active ? 'bg-[#161D2E]' : 'hover:bg-[#111622]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`font-mono text-[11px] font-semibold ${
                            hint.kind === 'function' ? 'text-[#00E5CC]' : 'text-[#F59E0B]'
                          }`}
                        >
                          {hint.signature}
                        </span>
                        <span className="text-[10px] text-[#8A99B8] whitespace-nowrap shrink-0">
                          {hint.foundationAffinity
                            ? `${hint.foundationAffinity} · ${hint.source}`
                            : hint.source}
                        </span>
                      </div>
                      <span className="text-[11px] text-[#8A99B8] truncate">
                        {hint.summary}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="px-2.5 py-1 bg-[#111622] border-t border-[#1F2A40] flex items-center justify-between text-[10px] text-[#8A99B8]">
                <span>Tab insert · ↑↓ navigate</span>
                <span>Esc dismiss</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
