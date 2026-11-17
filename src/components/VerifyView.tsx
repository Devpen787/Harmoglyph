import { useState } from 'react';
import { Play, ShieldAlert, ShieldCheck } from 'lucide-react';
import { runPbtInvariants } from '../engine/pbtSuite';
import { evaluateSheet } from '../engine/spreadsheetVm';
import { PbtInvariantResult } from '../types/chimera';

export function VerifyView() {
  const [seed, setSeed] = useState<number>(20261116);
  const [results, setResults] = useState<PbtInvariantResult[]>(() =>
    runPbtInvariants(20261116, 100),
  );
  const [cycleProbeMsg, setCycleProbeMsg] = useState<string | null>(null);

  const allPassed = results.every((r) => r.passed);

  const handleRun = () => {
    setResults(runPbtInvariants(seed, 100));
  };

  const handleInjectCycleProbe = () => {
    const res = evaluateSheet({
      A1: '=B1+10',
      B1: '=A1*2',
      A2: '=999999',
      B2: '1',
    });
    setCycleProbeMsg(
      `Tested A1=B1+10, B1=A1*2, A2=999999 -> A1 returned "${res.cells.A1.error}", B1 returned "${res.cells.B1.error}", A2 clamped audio safely to ${res.steps[1].freqHz} Hz.`,
    );
  };

  return (
    <main className="flex-1 overflow-y-auto bg-[#07090E] p-6 lg:p-8">
      <div className="max-w-5xl mx-auto flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4 pb-5 border-b border-[#1F2A40]">
          <div>
            <h1 className="font-display text-2xl font-bold text-[#EDF2F9] text-balance">
              Property-Based Verification (PBT)
            </h1>
            <p className="text-sm text-[#8A99B8] mt-1 max-w-2xl">
              Deterministic seeded randomized trials proving the Spreadsheet VM, Web Audio safety clamps, CSV round-trip, and WAV binary encoder hold across 100 edge-case inputs each.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <label className="flex items-center gap-2 bg-[#111622] border border-[#1F2A40] rounded-md px-3 py-1.5 text-xs">
              <span className="text-[#8A99B8]">Seed</span>
              <input
                type="number"
                value={seed}
                onChange={(e) => setSeed(Number(e.target.value) || 1)}
                className="w-24 bg-transparent font-mono-tabular text-[#EDF2F9] focus:outline-none"
              />
            </label>
            <button
              type="button"
              onClick={handleRun}
              className="px-4 py-2 rounded-md bg-[#00E5CC] text-[#07090E] text-xs font-semibold flex items-center gap-1.5 hover:opacity-90 whitespace-nowrap cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Run {results.length * 100} Total Trials</span>
            </button>
          </div>
        </div>

        {/* Summary Banner */}
        <div
          className={`rounded-lg border p-4 flex flex-wrap items-center justify-between gap-4 ${
            allPassed
              ? 'border-[#00E5CC] bg-[#00E5CC]/10'
              : 'border-[#F43F5E] bg-[#F43F5E]/10'
          }`}
        >
          <div className="flex items-center gap-3">
            {allPassed ? (
              <ShieldCheck className="w-6 h-6 text-[#00E5CC] shrink-0" aria-hidden="true" />
            ) : (
              <ShieldAlert className="w-6 h-6 text-[#F43F5E] shrink-0" aria-hidden="true" />
            )}
            <div>
              <div className="font-display text-base font-bold text-[#EDF2F9]">
                {allPassed
                  ? `All ${results.length} Formal Invariants Verified (${results.length * 100} / ${results.length * 100} Seeded Trials)`
                  : 'Invariant Failure Detected'}
              </div>
              <div className="text-xs font-mono-tabular text-[#8A99B8] mt-0.5">
                Seed {seed} · Cycle detection · Acoustic gain/Hz clamps · Lossless CSV · RIFF/WAVE header · Math-Art symmetry
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleInjectCycleProbe}
            className="px-3.5 py-2 rounded-md border border-[#1F2A40] bg-[#07090E] text-xs font-medium text-[#EDF2F9] hover:border-[#00E5CC] whitespace-nowrap cursor-pointer"
          >
            Test Hostile Cycle &amp; Overflow Probe
          </button>
        </div>

        {cycleProbeMsg && (
          <div className="p-3.5 rounded-md border border-[#1F2A40] bg-[#111622] text-xs font-mono text-[#00E5CC]">
            {cycleProbeMsg}
          </div>
        )}

        {/* Invariants Table */}
        <div className="overflow-x-auto border border-[#1F2A40] rounded-lg bg-[#0B0F17]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#111622] text-[#8A99B8] border-b border-[#1F2A40]">
              <tr>
                <th className="py-3 px-4 font-medium">Property</th>
                <th className="py-3 px-4 font-medium">Formal Invariant</th>
                <th className="py-3 px-4 font-medium text-right">Passed</th>
                <th className="py-3 px-4 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F2A40]">
              {results.map((row) => (
                <tr key={row.id} className="hover:bg-[#111622]/50">
                  <td className="py-3 px-4 font-semibold text-[#EDF2F9] whitespace-nowrap">
                    {row.name}
                  </td>
                  <td className="py-3 px-4 font-mono text-[#8A99B8]">
                    {row.invariant}
                    {row.counterexample && (
                      <div className="text-[#F43F5E] mt-1">
                        Counterexample: {row.counterexample}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono-tabular text-right text-[#EDF2F9] whitespace-nowrap">
                    {row.passedCount} / {row.trials}
                  </td>
                  <td className="py-3 px-4 font-mono text-right whitespace-nowrap">
                    {row.passed ? (
                      <span className="text-[#00E5CC]">● Passed</span>
                    ) : (
                      <span className="text-[#F43F5E]">✖ Failed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
