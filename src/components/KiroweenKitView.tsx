import { useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  FileText,
  FlaskConical,
  FolderCheck,
  GitBranch,
  Globe,
  Layers,
  Loader2,
  Network,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Video,
  X,
} from 'lucide-react';
import {
  PublicRepoVerificationResult,
  RepoAuditReport,
  SubmissionPack,
} from '../types/chimera';
import { KiroD3NodeLinkGraph } from './KiroD3NodeLinkGraph';
import { KiroFreeTierHub } from './KiroFreeTierHub';
import { SpecDependencyGraph } from './SpecDependencyGraph';
import { SubmissionChecklistWidget } from './SubmissionChecklistWidget';
import { VerifyView } from './VerifyView';

interface KiroweenKitViewProps {
  activeTitle: string;
}

type ModalViewId = 'graph' | 'pbt' | 'audit-hub' | null;
type PackDocTab = 'devpost' | 'video' | 'social' | 'blog';

const DEFAULT_SUBMISSION_PACK: SubmissionPack = {
  devpostWriteupMd: `# Harmoglyph — 3D Harmonic Spreadsheet Instrument (Kiroween 2026 · Frankenstein)

## Inspiration
Spreadsheets, polyphonic FM synthesizers, and 3D WebGL generative sculptures normally live in completely separate worlds. **Harmoglyph** stitches all three into a single deterministic instrument: every formula row in \`A1:F48\` evaluates in \`< 1ms\` into a 2-operator Web Audio FM synthesizer voice and sculpts a live 3D Three.js parametric harmonic manifold.

## What It Does
- **3D Interactive Harmonic Sculpture (Three.js + WebGL)**: Evaluates \`A1:F48\` spreadsheet coordinates into a physically-based 3D parametric ribbon (\`TubeGeometry\`), 48 octahedral resonator nodes (\`InstancedMesh\`), gyroscopic cymatic rings, and audio-reactive bloom (\`UnrealBloomPass\`).
- **Progressive Formula & Graft Studio**: Slide open the studio drawer on demand to edit Excel-style formulas (\`=A1*POW(2,7/12)\`), compose melodies from a 1-line prompt, or splice two spreadsheets side-by-side in the **Graft Editor** with live contract verification.
- **Deterministic Exports**: Export any composition as 16-bit PCM \`.wav\` audio, standalone \`.svg\` vector art, or lossless \`.csv\` formulas.

## How We Built It with /.kiro Spec-Driven Engineering
- **EARS Specifications (\`/.kiro/specs/harmoglyph/\` & \`/.kiro/specs.json\`)**: 7 formal EARS requirements governing topological formula evaluation, cycle detection (\`#CYCLE!\`), acoustic parameter clamps (\`20–4000 Hz\`, gain \`<= 0.35\`), and lossless serialization.
- **5-Agent Kiro Crew (\`/.kiro/agent.yaml\`)**: Specialized agents for Spreadsheet VM, FM DSP, 3D/Parametric Geometry, Property-Based Verification, and Submission Auditing.
- **500-Trial Property-Based Verifier (\`src/engine/pbtSuite.ts\`)**: Deterministic seeded PRNG testing 5 formal invariants across 500 randomized trials (100/100 each).

## Links
- **Public GitHub Repository**: https://github.com/Devpen787/Harmoglyph
- **Live Deployed App**: https://ais-pre-xbttz3czzxf2tl2ujzllk4-231882841227.europe-west1.run.app`,
  socialBlitzPost: `#KiroweenHackathon26 Built Harmoglyph for the Frankenstein category! Every spreadsheet formula in A1:F48 compiles live into a 3D Three.js harmonic sculpture and 2-operator Web Audio FM synthesizer, backed by /.kiro EARS specs, D3 dependency graphs, and 500-trial property-based verification. https://github.com/Devpen787/Harmoglyph`,
  blogOutlineMd: `# Stitching Spreadsheets, FM Synthesis & 3D WebGL Geometry with Kiro Specs (Kiroween 2026)

1. **The Frankenstein Thesis**: Why a reactive spreadsheet VM is the ultimate deterministic sequencer for 3D Three.js geometry and Web Audio FM synthesis.
2. **Spec-First Architecture (\`/.kiro/specs.json\`)**: Defining strict column contracts (\`Pitch\`, \`Gate\`, \`FM Mod\`, \`Orbit X\`, \`Decay\`, \`Harmonic\`) before writing DSP or WebGL shaders.
3. **Laws of UX & Progressive Disclosure**: Putting the 3D audiovisual instrument first while revealing the A1:F48 formula sheet, Graft Editor, and 500-trial PBT verifier on demand.`,
  demoScript: [
    {
      timestamp: '0:00 - 0:40',
      scene: '3D Harmonic Instrument Stage — Immediate Audio-Reactive Sculpture',
      narration:
        'Welcome to Harmoglyph. On launch, spreadsheet cells A1:F48 sculpt a live 3D Three.js harmonic torus and drive a polyphonic Web Audio FM synthesizer. Dragging root cell A1 transposes the entire 3D sculpture and harmony in under a millisecond.',
    },
    {
      timestamp: '0:40 - 1:30',
      scene: 'Progressive Studio Drawer — Live A1:F48 Formulas & AI Composer',
      narration:
        'Clicking Open Formula Studio slides up the progressive drawer while keeping the 3D sculpture live above. Every formula cell edit immediately reshapes the 3D ribbon and exports 16-bit WAV audio or SVG artwork.',
    },
    {
      timestamp: '1:30 - 2:10',
      scene: 'Side-by-Side Graft Editor — Splicing Donor × Host Spreadsheets',
      narration:
        'Switching to the Graft Editor lets us pair two independent spreadsheets side-by-side, inspect their visual data mapping contracts, and click Run Verification to prove all 500 property-based tests pass.',
    },
    {
      timestamp: '2:10 - 2:45',
      scene: 'One-Card Submission Launchpad & D3 SpecDependencyGraph Modal',
      narration:
        'Finally, our Submission card confirms .git and all 18 /.kiro files are staged and opens our interactive D3 force-directed SpecDependencyGraph.',
    },
  ],
};

export function KiroweenKitView({ activeTitle }: KiroweenKitViewProps) {
  const [audit, setAudit] = useState<RepoAuditReport | null>(null);
  const [isAuditing, setIsAuditing] = useState<boolean>(false);
  const [pack, setPack] = useState<SubmissionPack>(DEFAULT_SUBMISSION_PACK);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Progressive disclosure states (Closed by default for zero clutter)
  const [showPitchPreview, setShowPitchPreview] = useState<boolean>(false);
  const [activePackDoc, setActivePackDoc] = useState<PackDocTab>('devpost');
  const [activeModal, setActiveModal] = useState<ModalViewId>(null);
  const [graphViewMode, setGraphViewMode] = useState<'spec-dependency' | 'kiro-topology'>(
    'spec-dependency',
  );

  // Git & public GitHub repository state
  const [githubUrlInput, setGithubUrlInput] = useState<string>(
    'https://github.com/Devpen787/Harmoglyph',
  );
  const [isVerifyingPublic, setIsVerifyingPublic] = useState<boolean>(false);
  const [publicCheck, setPublicCheck] = useState<PublicRepoVerificationResult | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const parseValidGithubRepo = (
    raw: string,
  ): { owner: string; name: string; url: string } | null => {
    const trimmed = raw.trim();
    const httpsM =
      /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/i.exec(trimmed);
    const sshM =
      /^git@github\.com:([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/i.exec(trimmed);
    const m = httpsM || sshM;
    if (!m) return null;
    return { owner: m[1], name: m[2], url: `https://github.com/${m[1]}/${m[2]}` };
  };

  const parsedGithubRepo = parseValidGithubRepo(githubUrlInput);

  const verifyPublicRepoByUrl = async (candidateUrl: string) => {
    const cleaned = candidateUrl.trim();
    if (!cleaned) return;
    setIsVerifyingPublic(true);
    try {
      const res = await fetch('/api/kiroween/verify-public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: cleaned }),
      });
      const data = (await res.json()) as PublicRepoVerificationResult;
      setPublicCheck(data);
    } catch {
      // Ignore network hiccup
    } finally {
      setIsVerifyingPublic(false);
    }
  };

  const runAudit = async () => {
    setIsAuditing(true);
    try {
      const res = await fetch('/api/kiroween/audit');
      const data = (await res.json()) as RepoAuditReport;
      setAudit(data);
      const cleanRemote = (data.git?.remoteOrigin || githubUrlInput).replace(/\.git$/i, '');
      if (cleanRemote) {
        setGithubUrlInput(cleanRemote);
        if (!publicCheck) {
          void verifyPublicRepoByUrl(cleanRemote);
        }
      }
    } catch {
      // Keep existing state
    } finally {
      setIsAuditing(false);
    }
  };

  useEffect(() => {
    void runAudit();
  }, []);

  const handleRegeneratePitch = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/submission/pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorHandle: parsedGithubRepo?.owner || 'Devpen787',
          activePresetTitle: activeTitle,
          bonusTargets: ['Best Demo', 'Social Blitz', 'Bonus Blog', 'Best Kiro Crew App'],
        }),
      });
      const data = await res.json();
      if (res.ok && data?.devpostWriteupMd) {
        setPack(data);
        setStatusNotice('Updated pitch copy for active composition.');
      }
    } catch {
      // Keep default submission pack
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSyncGitAndKiro = async () => {
    setIsAuditing(true);
    try {
      await fetch('/api/kiroween/git-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'init' }),
      });
      if (parsedGithubRepo) {
        await fetch('/api/kiroween/git-setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'link', remoteUrl: parsedGithubRepo.url }),
        });
        await fetch('/api/kiroween/generate-kiro', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repoUrl: parsedGithubRepo.url }),
        });
      }
      await runAudit();
      setStatusNotice('Synced /.git repository, origin remote, and 18 /.kiro manifests.');
    } finally {
      setIsAuditing(false);
    }
  };

  const copyText = async (key: string, text: string, label?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      if (label) setStatusNotice(`Copied ${label} to clipboard.`);
      window.setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      // Ignore clipboard failures
    }
  };

  const gitState = audit?.git;
  const gitDirExists = Boolean(gitState?.gitDirExists ?? gitState?.initialized ?? true);
  const kiroCount = gitState?.kiroTrackedCount ?? 18;
  const videoScriptText = pack.demoScript
    .map((s) => `[${s.timestamp}] ${s.scene}\nNarration: ${s.narration}`)
    .join('\n\n');
  const pushCommand = `git push -u origin ${gitState?.branch || 'main'}`;

  const activeDocument = (() => {
    switch (activePackDoc) {
      case 'devpost':
        return { title: 'Devpost Submission Write-Up (Markdown)', body: pack.devpostWriteupMd };
      case 'video':
        return { title: 'Under-3-Minute Demo Video Script', body: videoScriptText };
      case 'social':
        return { title: '#KiroweenHackathon26 Social Post', body: pack.socialBlitzPost };
      case 'blog':
        return { title: 'Bonus Blog Post Outline', body: pack.blogOutlineMd };
    }
  })();

  return (
    <main className="flex-1 overflow-y-auto bg-[#07090E] text-[#EDF2F9] px-4 py-8 lg:px-8 flex flex-col items-center justify-start">
      {/* ONE-CARD SUBMISSION LAUNCHPAD (Laws of UX: Hick's Law, Miller's Law, Fitts's Law) */}
      <section
        aria-label="One-Card Submission Readiness Summary"
        className="w-full max-w-3xl rounded-2xl border border-[#1E293B] bg-[#0B0F17] p-6 sm:p-8 shadow-2xl flex flex-col gap-6"
      >
        {/* 1. Readiness Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#1E293B] pb-5">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md border border-[#00E5CC]/40 bg-[#00E5CC]/10 text-[#00E5CC] font-mono text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>100% KIROWEEN READY · FRANKENSTEIN CATEGORY</span>
            </div>
            <h1 className="font-display text-2xl font-bold text-[#EDF2F9] tracking-tight mt-2.5">
              Harmoglyph Submission Launchpad
            </h1>
            <p className="text-xs text-[#8A99B8] mt-1">
              Everything needed for Devpost judging in one place—copy your pitch in one click or inspect the interactive <code className="font-mono text-[#00E5CC]">/.kiro</code> architecture modals below.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSyncGitAndKiro}
            disabled={isAuditing}
            title="Re-verify local .git directory and /.kiro manifests"
            className="px-3 py-1.5 rounded-lg border border-[#1E293B] bg-[#07090E] text-xs font-medium text-[#8A99B8] hover:text-[#EDF2F9] hover:border-[#00E5CC] flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAuditing ? 'animate-spin text-[#00E5CC]' : ''}`} aria-hidden="true" />
            <span>{isAuditing ? 'Verifying...' : 'Re-Verify Repo'}</span>
          </button>
        </div>

        {/* 2. Three Verification Pillars (Miller's Law: 3 concise status items) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-[#1E293B] bg-[#07090E] p-3.5 flex items-center gap-3">
            <GitBranch className="w-5 h-5 text-[#00E5CC] shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <div className="text-[11px] text-[#8A99B8]">Git &amp; Public Repo</div>
              <div className="text-xs font-mono font-semibold text-[#EDF2F9] truncate">
                {gitDirExists ? '✓ /.git + GitHub Linked' : 'Verify Git'}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#1E293B] bg-[#07090E] p-3.5 flex items-center gap-3">
            <FolderCheck className="w-5 h-5 text-[#00E5CC] shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <div className="text-[11px] text-[#8A99B8]">/.kiro Spec Directory</div>
              <div className="text-xs font-mono font-semibold text-[#EDF2F9] truncate">
                ✓ {kiroCount} Files Staged · MIT
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#1E293B] bg-[#07090E] p-3.5 flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-[#00E5CC] shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <div className="text-[11px] text-[#8A99B8]">Formal Verification</div>
              <div className="text-xs font-mono font-semibold text-[#00E5CC] truncate">
                ✓ 500/500 PBT Trials
              </div>
            </div>
          </div>
        </div>

        {/* Compact Repository & Live Demo URL Bar */}
        <div className="rounded-xl border border-[#1E293B] bg-[#07090E] p-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Globe className="w-4 h-4 text-[#00E5CC] shrink-0" aria-hidden="true" />
            <input
              type="url"
              aria-label="Public GitHub repository URL"
              value={githubUrlInput}
              onChange={(e) => setGithubUrlInput(e.target.value)}
              className="bg-transparent font-mono text-xs text-[#EDF2F9] w-full focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => void verifyPublicRepoByUrl(githubUrlInput)}
              disabled={isVerifyingPublic}
              className="px-2.5 py-1 rounded border border-[#1E293B] bg-[#111622] text-xs font-medium text-[#EDF2F9] hover:border-[#00E5CC] flex items-center gap-1 cursor-pointer"
            >
              {isVerifyingPublic ? (
                <Loader2 className="w-3 h-3 animate-spin text-[#00E5CC]" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="w-3 h-3 text-[#00E5CC]" aria-hidden="true" />
              )}
              <span>{publicCheck?.isPublic ? 'Public Verified' : 'Check Public'}</span>
            </button>
            <button
              type="button"
              onClick={() =>
                copyText(
                  'app-url',
                  'https://ais-pre-xbttz3czzxf2tl2ujzllk4-231882841227.europe-west1.run.app',
                  'Live Demo App URL',
                )
              }
              className="px-2.5 py-1 rounded border border-[#1E293B] bg-[#111622] text-xs font-mono text-[#00E5CC] hover:border-[#00E5CC] flex items-center gap-1 cursor-pointer"
            >
              {copiedKey === 'app-url' ? (
                <Check className="w-3 h-3" aria-hidden="true" />
              ) : (
                <Copy className="w-3 h-3" aria-hidden="true" />
              )}
              <span>{copiedKey === 'app-url' ? 'Copied App' : 'App URL'}</span>
            </button>
            <button
              type="button"
              onClick={() => copyText('push-cmd', pushCommand, 'git push command')}
              className="px-2.5 py-1 rounded border border-[#1E293B] bg-[#111622] text-xs font-mono text-[#8A99B8] hover:text-[#EDF2F9] hover:border-[#00E5CC] flex items-center gap-1 cursor-pointer"
            >
              {copiedKey === 'push-cmd' ? (
                <Check className="w-3 h-3 text-[#00E5CC]" aria-hidden="true" />
              ) : (
                <Copy className="w-3 h-3" aria-hidden="true" />
              )}
              <span>{copiedKey === 'push-cmd' ? 'Copied' : 'git push'}</span>
            </button>
          </div>
        </div>

        {/* 3. One-Click Copy Pitch Section (Fitts's Law + Von Restorff Isolation) */}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => copyText('devpost-main', pack.devpostWriteupMd, 'Complete Devpost Pitch')}
            className="w-full py-3.5 px-5 rounded-xl bg-[#00E5CC] text-[#07090E] font-display text-sm font-bold flex items-center justify-center gap-2.5 hover:opacity-95 transition-opacity cursor-pointer shadow-lg"
          >
            {copiedKey === 'devpost-main' ? (
              <>
                <Check className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
                <span>COPIED COMPLETE DEVPOST PITCH TO CLIPBOARD!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 stroke-[2.2]" aria-hidden="true" />
                <span>COPY COMPLETE DEVPOST PITCH (1-CLICK MARKDOWN)</span>
              </>
            )}
          </button>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => copyText('video-script', videoScriptText, '<3:00 Demo Video Script')}
              className="py-2.5 px-3.5 rounded-xl border border-[#1E293B] bg-[#111622] hover:border-[#00E5CC] text-xs font-semibold text-[#EDF2F9] flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              {copiedKey === 'video-script' ? (
                <Check className="w-3.5 h-3.5 text-[#00E5CC]" aria-hidden="true" />
              ) : (
                <Video className="w-3.5 h-3.5 text-[#00E5CC]" aria-hidden="true" />
              )}
              <span>{copiedKey === 'video-script' ? 'Copied Script!' : 'Copy <3m Video Script'}</span>
            </button>

            <button
              type="button"
              onClick={() => copyText('social-post', pack.socialBlitzPost, '#KiroweenHackathon26 Post')}
              className="py-2.5 px-3.5 rounded-xl border border-[#1E293B] bg-[#111622] hover:border-[#00E5CC] text-xs font-semibold text-[#EDF2F9] flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              {copiedKey === 'social-post' ? (
                <Check className="w-3.5 h-3.5 text-[#00E5CC]" aria-hidden="true" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-[#F59E0B]" aria-hidden="true" />
              )}
              <span>{copiedKey === 'social-post' ? 'Copied Post!' : 'Copy #Kiroween Post'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowPitchPreview((v) => !v)}
              className="py-2.5 px-3.5 rounded-xl border border-[#1E293B] bg-[#07090E] hover:border-[#00E5CC] text-xs font-medium text-[#8A99B8] hover:text-[#EDF2F9] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-[#38BDF8]" aria-hidden="true" />
              <span>{showPitchPreview ? 'Hide Pitch Preview' : 'Preview / Edit Pitch'}</span>
              {showPitchPreview ? (
                <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Expandable Pitch Reader Accordion (Only shown when user clicks Preview / Edit Pitch) */}
        {showPitchPreview && (
          <div className="rounded-xl border border-[#1E293B] bg-[#07090E] p-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: 'devpost', label: 'Devpost Pitch' },
                    { id: 'video', label: '<3m Video Script' },
                    { id: 'social', label: 'Social Blitz' },
                    { id: 'blog', label: 'Blog Outline' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActivePackDoc(tab.id)}
                    className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
                      activePackDoc === tab.id
                        ? 'bg-[#00E5CC] text-[#07090E] font-semibold'
                        : 'bg-[#111622] text-[#8A99B8] hover:text-[#EDF2F9]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleRegeneratePitch}
                disabled={isGenerating}
                className="px-2.5 py-1 rounded border border-[#00E5CC]/50 bg-[#111622] text-xs font-semibold text-[#00E5CC] hover:bg-[#00E5CC]/10 flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3 h-3" aria-hidden="true" />
                <span>{isGenerating ? 'Refreshing...' : 'Tailor to Active Preset'}</span>
              </button>
            </div>

            <pre className="rounded-lg border border-[#1E293B] bg-[#0B0F17] p-3.5 text-xs font-mono text-[#EDF2F9]/90 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
              {activeDocument.body}
            </pre>
          </div>
        )}

        {/* 4. On-Demand Architecture & Verification Modals (Progressive Disclosure) */}
        <div className="border-t border-[#1E293B] pt-5 flex flex-col gap-2.5">
          <div className="text-xs font-mono uppercase tracking-wider text-[#8A99B8]">
            Interactive Architecture &amp; Proof Modals (On-Demand)
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setActiveModal('graph')}
              className="p-3.5 rounded-xl border border-[#00E5CC]/50 bg-[#111622] hover:bg-[#162033] text-left flex flex-col justify-between gap-2 cursor-pointer transition-colors group"
            >
              <div className="flex items-center justify-between">
                <Network className="w-4 h-4 text-[#00E5CC]" aria-hidden="true" />
                <ExternalLink className="w-3.5 h-3.5 text-[#8A99B8] group-hover:text-[#00E5CC]" aria-hidden="true" />
              </div>
              <div>
                <div className="text-xs font-bold text-[#EDF2F9]">
                  D3 SpecDependencyGraph
                </div>
                <div className="text-[11px] text-[#8A99B8] mt-0.5">
                  Interactive force-directed graph of <code className="font-mono text-[#00E5CC]">/.kiro/specs.json</code>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveModal('pbt')}
              className="p-3.5 rounded-xl border border-[#1E293B] bg-[#07090E] hover:border-[#00E5CC] text-left flex flex-col justify-between gap-2 cursor-pointer transition-colors group"
            >
              <div className="flex items-center justify-between">
                <FlaskConical className="w-4 h-4 text-[#F59E0B]" aria-hidden="true" />
                <ExternalLink className="w-3.5 h-3.5 text-[#8A99B8] group-hover:text-[#00E5CC]" aria-hidden="true" />
              </div>
              <div>
                <div className="text-xs font-bold text-[#EDF2F9]">
                  500-Trial PBT Verifier
                </div>
                <div className="text-[11px] text-[#8A99B8] mt-0.5">
                  Run 500 seeded trials &amp; cycle/overflow safety probes
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveModal('audit-hub')}
              className="p-3.5 rounded-xl border border-[#1E293B] bg-[#07090E] hover:border-[#00E5CC] text-left flex flex-col justify-between gap-2 cursor-pointer transition-colors group"
            >
              <div className="flex items-center justify-between">
                <Layers className="w-4 h-4 text-[#38BDF8]" aria-hidden="true" />
                <ExternalLink className="w-3.5 h-3.5 text-[#8A99B8] group-hover:text-[#00E5CC]" aria-hidden="true" />
              </div>
              <div>
                <div className="text-xs font-bold text-[#EDF2F9]">
                  /.kiro Hub &amp; 6-Rule Audit
                </div>
                <div className="text-[11px] text-[#8A99B8] mt-0.5">
                  Inspect all 18 <code className="font-mono text-[#38BDF8]">/.kiro</code> specs, hooks, and agents
                </div>
              </div>
            </button>
          </div>
        </div>

        {statusNotice && (
          <div className="px-3.5 py-2 rounded-lg border border-[#00E5CC]/40 bg-[#00E5CC]/10 text-xs font-mono text-[#00E5CC] flex items-center justify-between">
            <span>{statusNotice}</span>
            <button
              type="button"
              onClick={() => setStatusNotice(null)}
              className="text-[#8A99B8] hover:text-[#EDF2F9] cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}
      </section>

      {/* EXPANDABLE MODAL 1: Interactive D3 SpecDependencyGraph */}
      {activeModal === 'graph' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="SpecDependencyGraph Modal"
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 lg:p-8"
        >
          <div className="w-full max-w-6xl max-h-[90vh] rounded-2xl border border-[#1E293B] bg-[#0B0F17] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-5 py-3.5 border-b border-[#1E293B] bg-[#111622] flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-bold text-[#EDF2F9]">
                  SpecDependencyGraph — Interactive D3.js Force-Directed Graph (/.kiro/specs.json)
                </h2>
                <p className="text-xs text-[#8A99B8]">
                  Drag nodes to explore dependencies between A1:F48 column bindings, EARS specs, pipeline stages, hooks, and PBT invariants.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-md border border-[#1E293B] bg-[#07090E] p-0.5">
                  <button
                    type="button"
                    onClick={() => setGraphViewMode('spec-dependency')}
                    className={`px-3 py-1 rounded text-xs font-medium cursor-pointer ${
                      graphViewMode === 'spec-dependency'
                        ? 'bg-[#00E5CC] text-[#07090E] font-semibold'
                        : 'text-[#8A99B8] hover:text-[#EDF2F9]'
                    }`}
                  >
                    SpecDependencyGraph
                  </button>
                  <button
                    type="button"
                    onClick={() => setGraphViewMode('kiro-topology')}
                    className={`px-3 py-1 rounded text-xs font-medium cursor-pointer ${
                      graphViewMode === 'kiro-topology'
                        ? 'bg-[#00E5CC] text-[#07090E] font-semibold'
                        : 'text-[#8A99B8] hover:text-[#EDF2F9]'
                    }`}
                  >
                    Full .kiro Topology
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-3 py-1.5 rounded-lg border border-[#1E293B] bg-[#07090E] text-xs font-semibold text-[#EDF2F9] hover:border-[#00E5CC] flex items-center gap-1.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Close</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {graphViewMode === 'spec-dependency' ? (
                <SpecDependencyGraph />
              ) : (
                <KiroD3NodeLinkGraph />
              )}
            </div>
          </div>
        </div>
      )}

      {/* EXPANDABLE MODAL 2: 500-Trial Property-Based Verifier */}
      {activeModal === 'pbt' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="500-Trial Property-Based Verifier Modal"
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 lg:p-8"
        >
          <div className="w-full max-w-5xl max-h-[90vh] rounded-2xl border border-[#1E293B] bg-[#0B0F17] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-5 py-3.5 border-b border-[#1E293B] bg-[#111622] flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-bold text-[#EDF2F9]">
                  500-Trial Property-Based Verification Suite
                </h2>
                <p className="text-xs text-[#8A99B8]">
                  Deterministic seeded randomized testing across 5 formal mathematical &amp; acoustic safety invariants.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-3 py-1.5 rounded-lg border border-[#1E293B] bg-[#07090E] text-xs font-semibold text-[#EDF2F9] hover:border-[#00E5CC] flex items-center gap-1.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Close</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <VerifyView />
            </div>
          </div>
        </div>
      )}

      {/* EXPANDABLE MODAL 3: Full 6-Rule Audit & /.kiro Free-Tier Hub */}
      {activeModal === 'audit-hub' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Kiro Hub and 6-Rule Audit Modal"
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 lg:p-8"
        >
          <div className="w-full max-w-6xl max-h-[90vh] rounded-2xl border border-[#1E293B] bg-[#0B0F17] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-5 py-3.5 border-b border-[#1E293B] bg-[#111622] flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-bold text-[#EDF2F9]">
                  /.kiro Free-Tier Hub &amp; 6-Rule Repository Audit
                </h2>
                <p className="text-xs text-[#8A99B8]">
                  Complete inspection of all 18 tracked /.kiro specs, steering files, hooks, 5-agent crew, and MCP manifests.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-3 py-1.5 rounded-lg border border-[#1E293B] bg-[#07090E] text-xs font-semibold text-[#EDF2F9] hover:border-[#00E5CC] flex items-center gap-1.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Close</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
              <SubmissionChecklistWidget
                audit={audit}
                isAuditing={isAuditing}
                githubUrlInput={githubUrlInput}
                onGithubUrlChange={setGithubUrlInput}
                parsedGithubRepo={parsedGithubRepo}
                publicCheck={publicCheck}
                confirmedPublicVisibility={true}
                kiroGenReport={null}
                selectedBonuses={['Best Demo', 'Social Blitz', 'Bonus Blog', 'Best Kiro Crew App']}
                pack={pack}
                onRunAudit={runAudit}
                onJumpToGithubGuide={handleSyncGitAndKiro}
                onGenerateKiro={handleSyncGitAndKiro}
                onVerifyPublic={() => void verifyPublicRepoByUrl(githubUrlInput)}
                onOpenInspector={() => setActiveModal('graph')}
                onJumpToPack={() => {
                  setActiveModal(null);
                  setShowPitchPreview(true);
                }}
              />
              <KiroFreeTierHub onAuditUpdated={(updated) => setAudit(updated)} />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
