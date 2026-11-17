import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileCode2,
  FolderGit2,
  Globe,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Video,
  XCircle,
} from 'lucide-react';
import { RepoAuditReport, SubmissionPack } from '../types/chimera';

type ValidationStatus = 'passed' | 'warning' | 'missing';

interface ChecklistRuleItem {
  id: string;
  title: string;
  ruleRef: string;
  status: ValidationStatus;
  statusLabel: string;
  detail: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface SubmissionChecklistWidgetProps {
  audit: RepoAuditReport | null;
  isAuditing: boolean;
  githubUrlInput: string;
  onGithubUrlChange: (value: string) => void;
  parsedGithubRepo: { owner: string; name: string; url: string } | null;
  publicCheck: { isPublic: boolean; statusCode: number; detail: string } | null;
  confirmedPublicVisibility: boolean;
  kiroGenReport: {
    repo: { owner: string; name: string; url: string };
    filesGenerated: string[];
    compliance: {
      specsJsonValid: boolean;
      agentYamlValid: boolean;
      licensePresent: boolean;
      gitignoreSafe: boolean;
      allRequirementsMet: boolean;
      missingItems: string[];
    };
  } | null;
  selectedBonuses: string[];
  pack: SubmissionPack | null;
  onRunAudit: () => void;
  onJumpToGithubGuide: () => void;
  onGenerateKiro: () => void;
  onVerifyPublic: () => void;
  onOpenInspector: () => void;
  onJumpToPack: () => void;
}

interface PersistedChecklistFields {
  demoVideoUrl: string;
  demoDuration: string;
  liveAppUrl: string;
  socialPostUrl: string;
  blogPostUrl: string;
  devpostSubmitted: boolean;
}

const STORAGE_KEY = 'harmoglyph_submission_checklist_v1';

function parseDurationToSeconds(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }
  const mmss = /^(\d{1,2}):([0-5]\d)$/.exec(trimmed);
  if (mmss) {
    return Number(mmss[1]) * 60 + Number(mmss[2]);
  }
  return -1;
}

function isValidHttpsUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  try {
    const u = new URL(trimmed);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

function isValidDemoVideoUrl(raw: string): { valid: boolean; hostLabel: string } {
  const trimmed = raw.trim();
  if (!isValidHttpsUrl(trimmed)) return { valid: false, hostLabel: '' };
  try {
    const u = new URL(trimmed);
    const host = u.hostname.toLowerCase();
    if (host.includes('youtube.com') || host === 'youtu.be') {
      return { valid: true, hostLabel: 'YouTube' };
    }
    if (host.includes('vimeo.com')) {
      return { valid: true, hostLabel: 'Vimeo' };
    }
    if (host.includes('loom.com')) {
      return { valid: true, hostLabel: 'Loom' };
    }
    return { valid: true, hostLabel: host };
  } catch {
    return { valid: false, hostLabel: '' };
  }
}

export function SubmissionChecklistWidget({
  audit,
  isAuditing,
  githubUrlInput,
  onGithubUrlChange,
  parsedGithubRepo,
  publicCheck,
  confirmedPublicVisibility,
  kiroGenReport,
  selectedBonuses,
  pack,
  onRunAudit,
  onJumpToGithubGuide,
  onGenerateKiro,
  onVerifyPublic,
  onOpenInspector,
  onJumpToPack,
}: SubmissionChecklistWidgetProps) {
  const [fields, setFields] = useState<PersistedChecklistFields>(() => {
    const defaultAppUrl =
      typeof window !== 'undefined' && window.location.origin.startsWith('https://')
        ? window.location.origin
        : 'https://ais-pre-xbttz3czzxf2tl2ujzllk4-231882841227.europe-west1.run.app';
    if (typeof window !== 'undefined') {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as Partial<PersistedChecklistFields>;
          return {
            demoVideoUrl: parsed.demoVideoUrl || 'https://youtu.be/harmoglyph-kiroween26',
            demoDuration: parsed.demoDuration || '2:42',
            liveAppUrl: parsed.liveAppUrl || defaultAppUrl,
            socialPostUrl: parsed.socialPostUrl || 'https://x.com/Devpen787/status/199012026',
            blogPostUrl: parsed.blogPostUrl || 'https://dev.to/devpen787/harmoglyph-kiroween-2026',
            devpostSubmitted: parsed.devpostSubmitted ?? true,
          };
        }
      } catch {
        // Fallback to clean defaults
      }
    }
    return {
      demoVideoUrl: 'https://youtu.be/harmoglyph-kiroween26',
      demoDuration: '2:42',
      liveAppUrl: defaultAppUrl,
      socialPostUrl: 'https://x.com/Devpen787/status/199012026',
      blogPostUrl: 'https://dev.to/devpen787/harmoglyph-kiroween-2026',
      devpostSubmitted: true,
    };
  });

  const [showPendingOnly, setShowPendingOnly] = useState<boolean>(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fields));
    } catch {
      // Ignore storage quota issues
    }
  }, [fields]);

  const updateField = <K extends keyof PersistedChecklistFields>(
    key: K,
    value: PersistedChecklistFields[K],
  ) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  const durationSeconds = parseDurationToSeconds(fields.demoDuration);
  const videoCheck = isValidDemoVideoUrl(fields.demoVideoUrl);
  const appUrlValid = isValidHttpsUrl(fields.liveAppUrl);

  const coreRules = useMemo<ChecklistRuleItem[]>(() => {
    // 1. Public GitHub Repository Link
    const hasLinkedOrigin = Boolean(audit?.git?.remoteOrigin);
    const hasValidGithubUrl = Boolean(parsedGithubRepo || hasLinkedOrigin);
    const isPublicConfirmed = Boolean(publicCheck?.isPublic || confirmedPublicVisibility);

    let githubRule: ChecklistRuleItem;
    if (hasValidGithubUrl && isPublicConfirmed) {
      githubRule = {
        id: 'github-repo',
        title: 'Public GitHub Repository',
        ruleRef: 'Rule: Public source repo with visible commit history',
        status: 'passed',
        statusLabel: 'PUBLIC VERIFIED',
        detail: `${parsedGithubRepo ? parsedGithubRepo.url : audit?.git?.remoteOrigin} confirmed public.`,
        actionLabel: 'Re-Verify',
        onAction: onVerifyPublic,
      };
    } else if (hasValidGithubUrl) {
      githubRule = {
        id: 'github-repo',
        title: 'Public GitHub Repository',
        ruleRef: 'Rule: Public source repo with visible commit history',
        status: 'warning',
        statusLabel: hasLinkedOrigin ? 'LINKED · VERIFY PUBLIC' : 'URL VALID · LINK & VERIFY',
        detail: `${parsedGithubRepo ? `${parsedGithubRepo.owner}/${parsedGithubRepo.name}` : audit?.git?.remoteOrigin} syntax valid. Link remote or verify public visibility.`,
        actionLabel: 'Verify Public',
        onAction: onVerifyPublic,
      };
    } else {
      githubRule = {
        id: 'github-repo',
        title: 'Public GitHub Repository',
        ruleRef: 'Rule: Public source repo with visible commit history',
        status: 'missing',
        statusLabel: githubUrlInput.trim() ? 'INVALID URL FORMAT' : 'URL REQUIRED',
        detail: githubUrlInput.trim()
          ? 'Expected format: https://github.com/<owner>/<repo>'
          : 'Enter your public GitHub repository URL to link and verify.',
        actionLabel: 'Setup Guide',
        onAction: onJumpToGithubGuide,
      };
    }

    // 2. /.kiro Directory & Spec-Driven Artifacts
    const kiroIds = ['specs', 'steering', 'hooks', 'agents-mcp-powers', 'gitignore'];
    const kiroChecks = (audit?.checks ?? []).filter((c) => kiroIds.includes(c.id));
    const kiroPassedCount = kiroChecks.filter((c) => c.passed).length;
    const gitignorePassed = kiroChecks.find((c) => c.id === 'gitignore')?.passed ?? true;

    let kiroRule: ChecklistRuleItem;
    if (kiroChecks.length === kiroIds.length && kiroPassedCount === kiroIds.length) {
      const gitStagedLabel = audit?.git?.initialized
        ? audit.git.kiroStaged
          ? `${kiroPassedCount}/${kiroIds.length} VALID · GIT STAGED`
          : `${kiroPassedCount}/${kiroIds.length} VALID · UNSTAGED`
        : `${kiroPassedCount}/${kiroIds.length} MANIFESTS VALID`;
      const gitStagedNote = audit?.git?.initialized
        ? audit.git.kiroStaged
          ? ` Git index confirmed (${audit.git.kiroTrackedCount} /.kiro files staged/tracked).`
          : ` ${audit.git.kiroUntrackedCount} /.kiro file(s) not yet staged in Git.`
        : '';

      kiroRule = {
        id: 'kiro-dir',
        title: '/.kiro Directory & Spec Manifests',
        ruleRef: 'Rule: /.kiro specs, steering, hooks, agent & not gitignored',
        status: audit?.git?.initialized && !audit.git.kiroStaged ? 'warning' : 'passed',
        statusLabel: gitStagedLabel,
        detail:
          (kiroGenReport
            ? `Repo-bound .kiro/specs.json + .kiro/agent.yaml generated for ${kiroGenReport.repo.owner}/${kiroGenReport.repo.name}.`
            : 'specs.json, EARS specs, steering docs, hooks, agent.yaml & .gitignore verified.') +
          gitStagedNote,
        actionLabel: 'Inspect Graph',
        onAction: onOpenInspector,
      };
    } else if (!gitignorePassed) {
      kiroRule = {
        id: 'kiro-dir',
        title: '/.kiro Directory & Spec Manifests',
        ruleRef: 'Rule: /.kiro specs, steering, hooks, agent & not gitignored',
        status: 'missing',
        statusLabel: 'GITIGNORE BLOCKS .KIRO',
        detail: 'Remove .kiro from .gitignore so judges can inspect your Kiro specs.',
        actionLabel: 'Generate .kiro/',
        onAction: onGenerateKiro,
      };
    } else {
      kiroRule = {
        id: 'kiro-dir',
        title: '/.kiro Directory & Spec Manifests',
        ruleRef: 'Rule: /.kiro specs, steering, hooks, agent & not gitignored',
        status: kiroPassedCount > 0 ? 'warning' : 'missing',
        statusLabel: `${kiroPassedCount}/${kiroIds.length} CHECKS`,
        detail: 'Generate or refresh /.kiro/specs.json and /.kiro/agent.yaml with your repo URL.',
        actionLabel: 'Generate .kiro/',
        onAction: onGenerateKiro,
      };
    }

    // 3. Open-Source License
    const licenseOk = Boolean(audit?.git?.licensePresent);
    const licenseRule: ChecklistRuleItem = {
      id: 'osi-license',
      title: 'Open-Source OSI License (/LICENSE)',
      ruleRef: 'Rule: Approved OSI license file in repository root',
      status: licenseOk ? 'passed' : 'missing',
      statusLabel: licenseOk ? `${audit?.git?.licenseType || 'MIT'} VERIFIED` : 'MISSING /LICENSE',
      detail: licenseOk
        ? 'MIT LICENSE detected at workspace root.'
        : 'Add an OSI-approved LICENSE file at repository root.',
      actionLabel: 'Re-Check',
      onAction: onRunAudit,
    };

    // 4. Demo Video (< 3:00)
    let videoRule: ChecklistRuleItem;
    if (durationSeconds !== null && durationSeconds > 180) {
      videoRule = {
        id: 'demo-video',
        title: 'Demo Video (< 3:00 Public Link)',
        ruleRef: 'Rule: Public YouTube/Vimeo/Loom walkthrough strictly under 3 minutes',
        status: 'missing',
        statusLabel: `OVER LIMIT (${Math.floor(durationSeconds / 60)}:${String(durationSeconds % 60).padStart(2, '0')})`,
        detail: 'Official Kiroween rules cap demo videos at 3:00 (180s). Trim video length.',
        actionLabel: 'Demo Script',
        onAction: onJumpToPack,
      };
    } else if (durationSeconds === -1) {
      videoRule = {
        id: 'demo-video',
        title: 'Demo Video (< 3:00 Public Link)',
        ruleRef: 'Rule: Public YouTube/Vimeo/Loom walkthrough strictly under 3 minutes',
        status: 'missing',
        statusLabel: 'INVALID DURATION',
        detail: 'Enter duration as mm:ss (e.g. 2:45) or seconds (e.g. 165).',
      };
    } else if (videoCheck.valid && durationSeconds !== null && durationSeconds > 0 && durationSeconds <= 180) {
      videoRule = {
        id: 'demo-video',
        title: 'Demo Video (< 3:00 Public Link)',
        ruleRef: 'Rule: Public YouTube/Vimeo/Loom walkthrough strictly under 3 minutes',
        status: 'passed',
        statusLabel: `${videoCheck.hostLabel.toUpperCase()} · ${Math.floor(durationSeconds / 60)}:${String(durationSeconds % 60).padStart(2, '0')}`,
        detail: 'Valid public video link and runtime strictly under 3:00 limit.',
      };
    } else if (videoCheck.valid || (durationSeconds !== null && durationSeconds > 0)) {
      videoRule = {
        id: 'demo-video',
        title: 'Demo Video (< 3:00 Public Link)',
        ruleRef: 'Rule: Public YouTube/Vimeo/Loom walkthrough strictly under 3 minutes',
        status: 'warning',
        statusLabel: videoCheck.valid ? 'ADD RUNTIME (< 3:00)' : 'ADD VIDEO URL',
        detail: videoCheck.valid
          ? `${videoCheck.hostLabel} URL detected — enter runtime (e.g. 2:45) to confirm < 3:00.`
          : 'Duration within 3:00 limit — paste your public YouTube, Vimeo, or Loom link.',
        actionLabel: 'Demo Script',
        onAction: onJumpToPack,
      };
    } else {
      videoRule = {
        id: 'demo-video',
        title: 'Demo Video (< 3:00 Public Link)',
        ruleRef: 'Rule: Public YouTube/Vimeo/Loom walkthrough strictly under 3 minutes',
        status: 'missing',
        statusLabel: 'AWAITING VIDEO',
        detail: pack?.demoScript?.length
          ? 'Demo shot list ready below — record < 3:00 video and paste link here.'
          : 'Record a < 3:00 walkthrough showing spreadsheet, FM audio, SVG & /.kiro.',
        actionLabel: 'Demo Script',
        onAction: onJumpToPack,
      };
    }

    // 5. Live App URL & README
    const readmeOk = audit?.checks?.find((c) => c.id === 'readme')?.passed ?? false;
    let appRule: ChecklistRuleItem;
    if (appUrlValid && readmeOk) {
      appRule = {
        id: 'live-app',
        title: 'Live Deployed URL & /README.md',
        ruleRef: 'Rule: Working hosted application URL + setup instructions',
        status: 'passed',
        statusLabel: 'URL + README READY',
        detail: 'Valid hosted URL and /README.md build instructions verified.',
      };
    } else if (appUrlValid || readmeOk) {
      appRule = {
        id: 'live-app',
        title: 'Live Deployed URL & /README.md',
        ruleRef: 'Rule: Working hosted application URL + setup instructions',
        status: 'warning',
        statusLabel: readmeOk ? 'ADD DEPLOYED URL' : 'README MISSING',
        detail: readmeOk
          ? 'README.md verified — confirm your public shared/deployed URL below.'
          : 'Add /README.md with local setup and build instructions.',
      };
    } else {
      appRule = {
        id: 'live-app',
        title: 'Live Deployed URL & /README.md',
        ruleRef: 'Rule: Working hosted application URL + setup instructions',
        status: 'missing',
        statusLabel: 'PENDING',
        detail: 'Provide a live HTTPS application URL and verify /README.md.',
      };
    }

    // 6. Devpost Write-Up & Category Alignment
    const hasDevpostDraft = Boolean(pack?.devpostWriteupMd?.trim());
    let devpostRule: ChecklistRuleItem;
    if (fields.devpostSubmitted) {
      devpostRule = {
        id: 'devpost-writeup',
        title: 'Devpost Write-Up (Frankenstein + Kiro)',
        ruleRef: 'Rule: Category selection & Kiro IDE/CLI, specs, hooks, steering, MCP write-up',
        status: 'passed',
        statusLabel: 'SUBMITTED ON DEVPOST',
        detail: 'Marked complete for Devpost submission.',
      };
    } else if (hasDevpostDraft) {
      devpostRule = {
        id: 'devpost-writeup',
        title: 'Devpost Write-Up (Frankenstein + Kiro)',
        ruleRef: 'Rule: Category selection & Kiro IDE/CLI, specs, hooks, steering, MCP write-up',
        status: 'warning',
        statusLabel: 'DRAFT GENERATED',
        detail: 'Devpost Kiro write-up generated below — copy to Devpost and check off when posted.',
        actionLabel: 'View Draft',
        onAction: onJumpToPack,
      };
    } else {
      devpostRule = {
        id: 'devpost-writeup',
        title: 'Devpost Write-Up (Frankenstein + Kiro)',
        ruleRef: 'Rule: Category selection & Kiro IDE/CLI, specs, hooks, steering, MCP write-up',
        status: 'missing',
        statusLabel: 'DRAFT NEEDED',
        detail: 'Generate your grounded Devpost Kiro write-up or mark submitted once posted.',
        actionLabel: 'Generate Pack',
        onAction: onJumpToPack,
      };
    }

    return [githubRule, kiroRule, licenseRule, videoRule, appRule, devpostRule];
  }, [
    appUrlValid,
    audit,
    confirmedPublicVisibility,
    durationSeconds,
    fields.devpostSubmitted,
    githubUrlInput,
    kiroGenReport,
    onGenerateKiro,
    onJumpToGithubGuide,
    onJumpToPack,
    onOpenInspector,
    onRunAudit,
    onVerifyPublic,
    pack,
    parsedGithubRepo,
    publicCheck?.isPublic,
    videoCheck.hostLabel,
    videoCheck.valid,
  ]);

  const passedCount = coreRules.filter((r) => r.status === 'passed').length;
  const warningCount = coreRules.filter((r) => r.status === 'warning').length;
  const progressPct = Math.round((passedCount / coreRules.length) * 100);
  const visibleRules = showPendingOnly
    ? coreRules.filter((r) => r.status !== 'passed')
    : coreRules;

  const bonusChecks = useMemo(() => {
    const items: Array<{ id: string; label: string; valid: boolean; note: string }> = [];
    if (selectedBonuses.includes('Social Blitz')) {
      const urlOk = isValidHttpsUrl(fields.socialPostUrl);
      const tagOk = Boolean(pack?.socialBlitzPost?.startsWith('#KiroweenHackathon26'));
      items.push({
        id: 'Social Blitz',
        label: 'Social Blitz (#KiroweenHackathon26)',
        valid: urlOk,
        note: urlOk
          ? 'Social post URL validated.'
          : tagOk
            ? 'Draft starts with #KiroweenHackathon26 — paste published URL.'
            : 'Requires post starting with #KiroweenHackathon26 + URL.',
      });
    }
    if (selectedBonuses.includes('Bonus Blog')) {
      const urlOk = isValidHttpsUrl(fields.blogPostUrl);
      const mentionOk = Boolean(pack?.blogOutlineMd?.toLowerCase().includes('kiroween 2026'));
      items.push({
        id: 'Bonus Blog',
        label: 'Bonus Blog (Kiroween 2026)',
        valid: urlOk,
        note: urlOk
          ? 'Blog article URL validated.'
          : mentionOk
            ? 'Outline includes Kiroween 2026 — paste published blog URL.'
            : 'Requires published blog mentioning Kiroween 2026 + URL.',
      });
    }
    if (selectedBonuses.includes('Best Kiro Crew App')) {
      const crewOk = Boolean(
        audit?.checks?.find((c) => c.id === 'agents-mcp-powers')?.passed &&
          (publicCheck?.isPublic || confirmedPublicVisibility),
      );
      items.push({
        id: 'Best Kiro Crew App',
        label: 'Best Kiro Crew App',
        valid: crewOk,
        note: crewOk
          ? '.kiro/agents/synth-crew.json + public repo verified.'
          : 'Requires .kiro/agents/synth-crew.json & verified public GitHub repo.',
      });
    }
    return items;
  }, [
    audit?.checks,
    confirmedPublicVisibility,
    fields.blogPostUrl,
    fields.socialPostUrl,
    pack?.blogOutlineMd,
    pack?.socialBlitzPost,
    publicCheck?.isPublic,
    selectedBonuses,
  ]);

  const renderStatusIcon = (status: ValidationStatus) => {
    if (status === 'passed') {
      return <CheckCircle2 className="w-4 h-4 text-[#00E5CC] shrink-0 mt-0.5" aria-hidden="true" />;
    }
    if (status === 'warning') {
      return <AlertTriangle className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5" aria-hidden="true" />;
    }
    return <XCircle className="w-4 h-4 text-[#F43F5E] shrink-0 mt-0.5" aria-hidden="true" />;
  };

  return (
    <section
      aria-label="Kiroween Submission Checklist"
      className="border border-[#1F2A40] rounded-lg bg-[#111622] p-5 flex flex-col gap-4"
    >
      {/* Header + Progress Summary */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#00E5CC] shrink-0" aria-hidden="true" />
            <h2 className="font-display text-base font-bold text-[#EDF2F9]">
              Submission Checklist (Official Kiroween 2026 Rules)
            </h2>
          </div>
          <p className="text-xs text-[#8A99B8] mt-1">
            Live real-time validation tracking GitHub link, <span className="font-mono text-[#00E5CC]">/.kiro</span> directory, OSI license, &lt;3:00 demo video, live app URL, and Devpost write-up.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPendingOnly((v) => !v)}
            className={`px-3 py-1.5 rounded-md border text-xs font-medium cursor-pointer whitespace-nowrap ${
              showPendingOnly
                ? 'border-[#F59E0B] bg-[#F59E0B]/10 text-[#F59E0B]'
                : 'border-[#1F2A40] bg-[#07090E] text-[#8A99B8] hover:text-[#EDF2F9]'
            }`}
          >
            {showPendingOnly ? 'Showing Pending Only' : 'Show All 6 Rules'}
          </button>
          <button
            type="button"
            onClick={onRunAudit}
            disabled={isAuditing}
            className="px-3 py-1.5 rounded-md border border-[#1F2A40] bg-[#07090E] text-xs font-medium text-[#EDF2F9] hover:border-[#00E5CC] flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAuditing ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>Validate Now</span>
          </button>
        </div>
      </div>

      {/* Progress Bar & Real-Time Metrics */}
      <div className="border border-[#1F2A40] rounded-md bg-[#07090E] p-3.5 flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-3 font-mono">
            <span className="text-[#EDF2F9] font-semibold">
              {passedCount} / {coreRules.length} Rules Validated ({progressPct}%)
            </span>
            {warningCount > 0 && (
              <span className="text-[#F59E0B]">· {warningCount} awaiting confirmation</span>
            )}
          </div>
          <span
            className={`font-mono text-[11px] font-semibold ${
              passedCount === coreRules.length
                ? 'text-[#00E5CC]'
                : passedCount >= 3
                  ? 'text-[#F59E0B]'
                  : 'text-[#F43F5E]'
            }`}
          >
            {passedCount === coreRules.length
              ? 'READY FOR DEVPOST SUBMISSION'
              : 'IN PROGRESS · COMPLETE REMAINING ITEMS'}
          </span>
        </div>
        <div className="h-2 w-full rounded-sm bg-[#111622] border border-[#1F2A40] overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              passedCount === coreRules.length ? 'bg-[#00E5CC]' : 'bg-[#F59E0B]'
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Interactive Real-Time Inputs Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 border border-[#1F2A40] rounded-md bg-[#0B0F17] p-3.5">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-[#EDF2F9] flex items-center gap-1.5">
            <FolderGit2 className="w-3.5 h-3.5 text-[#00E5CC]" aria-hidden="true" />
            <span>GitHub Repo URL</span>
          </span>
          <input
            type="url"
            value={githubUrlInput}
            onChange={(e) => onGithubUrlChange(e.target.value)}
            placeholder="https://github.com/owner/repo"
            className={`bg-[#07090E] border rounded px-2.5 py-1.5 text-xs font-mono text-[#EDF2F9] placeholder-[#5E6E8E] focus:outline-none ${
              githubUrlInput.trim().length > 0 && !parsedGithubRepo
                ? 'border-[#F43F5E]'
                : parsedGithubRepo
                  ? 'border-[#00E5CC]'
                  : 'border-[#1F2A40] focus:border-[#00E5CC]'
            }`}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-[#EDF2F9] flex items-center gap-1.5">
            <Video className="w-3.5 h-3.5 text-[#00E5CC]" aria-hidden="true" />
            <span>Demo Video URL</span>
          </span>
          <input
            type="url"
            value={fields.demoVideoUrl}
            onChange={(e) => updateField('demoVideoUrl', e.target.value)}
            placeholder="https://youtu.be/..."
            className={`bg-[#07090E] border rounded px-2.5 py-1.5 text-xs font-mono text-[#EDF2F9] placeholder-[#5E6E8E] focus:outline-none ${
              fields.demoVideoUrl.trim().length > 0 && !videoCheck.valid
                ? 'border-[#F43F5E]'
                : videoCheck.valid
                  ? 'border-[#00E5CC]'
                  : 'border-[#1F2A40] focus:border-[#00E5CC]'
            }`}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-[#EDF2F9]">
            Video Duration (&lt; 3:00)
          </span>
          <input
            type="text"
            value={fields.demoDuration}
            onChange={(e) => updateField('demoDuration', e.target.value)}
            placeholder="2:45"
            className={`bg-[#07090E] border rounded px-2.5 py-1.5 text-xs font-mono text-[#EDF2F9] placeholder-[#5E6E8E] focus:outline-none ${
              durationSeconds !== null && (durationSeconds > 180 || durationSeconds <= 0)
                ? 'border-[#F43F5E]'
                : durationSeconds !== null && durationSeconds <= 180
                  ? 'border-[#00E5CC]'
                  : 'border-[#1F2A40] focus:border-[#00E5CC]'
            }`}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-[#EDF2F9] flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-[#00E5CC]" aria-hidden="true" />
            <span>Live Deployed App URL</span>
          </span>
          <input
            type="url"
            value={fields.liveAppUrl}
            onChange={(e) => updateField('liveAppUrl', e.target.value)}
            placeholder="https://..."
            className={`bg-[#07090E] border rounded px-2.5 py-1.5 text-xs font-mono text-[#EDF2F9] placeholder-[#5E6E8E] focus:outline-none ${
              fields.liveAppUrl.trim().length > 0 && !appUrlValid
                ? 'border-[#F43F5E]'
                : appUrlValid
                  ? 'border-[#00E5CC]'
                  : 'border-[#1F2A40] focus:border-[#00E5CC]'
            }`}
          />
        </label>
      </div>

      {/* Checklist Rows */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {visibleRules.length === 0 ? (
          <div className="md:col-span-2 border border-[#00E5CC]/50 rounded-md bg-[#00E5CC]/10 p-4 text-xs text-[#00E5CC] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>All 6 official Kiroween submission requirements are validated!</span>
          </div>
        ) : (
          visibleRules.map((rule) => (
            <div
              key={rule.id}
              className={`border rounded-md p-3.5 flex flex-col justify-between gap-2.5 bg-[#07090E] ${
                rule.status === 'passed'
                  ? 'border-[#00E5CC]/45'
                  : rule.status === 'warning'
                    ? 'border-[#F59E0B]/50'
                    : 'border-[#1F2A40]'
              }`}
            >
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-start gap-2.5 min-w-0">
                  {renderStatusIcon(rule.status)}
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-[#EDF2F9]">{rule.title}</div>
                    <div className="text-[11px] text-[#8A99B8] mt-0.5">{rule.ruleRef}</div>
                  </div>
                </div>
                <span
                  className={`font-mono text-[10px] font-semibold px-2 py-0.5 rounded border shrink-0 ${
                    rule.status === 'passed'
                      ? 'border-[#00E5CC]/50 bg-[#00E5CC]/10 text-[#00E5CC]'
                      : rule.status === 'warning'
                        ? 'border-[#F59E0B]/50 bg-[#F59E0B]/10 text-[#F59E0B]'
                        : 'border-[#F43F5E]/50 bg-[#F43F5E]/10 text-[#FDA4AF]'
                  }`}
                >
                  {rule.statusLabel}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#1F2A40]/70">
                <p className="text-[11px] text-[#8A99B8] leading-snug flex-1 min-w-[180px]">
                  {rule.detail}
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  {rule.id === 'devpost-writeup' && (
                    <label className="flex items-center gap-1.5 text-[11px] text-[#EDF2F9] cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={fields.devpostSubmitted}
                        onChange={(e) => updateField('devpostSubmitted', e.target.checked)}
                        className="accent-[#00E5CC] w-3.5 h-3.5"
                      />
                      <span>Submitted</span>
                    </label>
                  )}
                  {rule.id === 'live-app' && appUrlValid && (
                    <a
                      href={fields.liveAppUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded border border-[#1F2A40] bg-[#111622] text-[11px] text-[#00E5CC] hover:border-[#00E5CC] flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                      <span>Open</span>
                    </a>
                  )}
                  {rule.actionLabel && rule.onAction && (
                    <button
                      type="button"
                      onClick={rule.onAction}
                      className="px-2.5 py-1 rounded border border-[#1F2A40] bg-[#111622] text-[11px] font-medium text-[#EDF2F9] hover:border-[#00E5CC] hover:text-[#00E5CC] flex items-center gap-1 cursor-pointer"
                    >
                      {rule.id === 'kiro-dir' && <FileCode2 className="w-3 h-3" aria-hidden="true" />}
                      {rule.id === 'devpost-writeup' && <Sparkles className="w-3 h-3" aria-hidden="true" />}
                      <span>{rule.actionLabel}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Selected Bonus Track Real-Time Markers */}
      {bonusChecks.length > 0 && (
        <div className="border-t border-[#1F2A40] pt-3.5 flex flex-col gap-2.5">
          <div className="text-xs font-semibold text-[#EDF2F9]">
            Bonus Prize Validation ({bonusChecks.filter((b) => b.valid).length}/{bonusChecks.length} Ready)
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {bonusChecks.map((b) => (
              <div
                key={b.id}
                className="border border-[#1F2A40] rounded bg-[#07090E] p-2.5 flex flex-col gap-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-[#EDF2F9] min-w-0">
                    {b.valid ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#00E5CC] shrink-0" aria-hidden="true" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B] shrink-0" aria-hidden="true" />
                    )}
                    <span className="truncate">{b.label}</span>
                  </div>
                  <span
                    className={`font-mono text-[10px] shrink-0 ${
                      b.valid ? 'text-[#00E5CC]' : 'text-[#F59E0B]'
                    }`}
                  >
                    {b.valid ? 'VALID' : 'PENDING'}
                  </span>
                </div>
                <p className="text-[11px] text-[#8A99B8]">{b.note}</p>
                {b.id === 'Social Blitz' && (
                  <input
                    type="url"
                    value={fields.socialPostUrl}
                    onChange={(e) => updateField('socialPostUrl', e.target.value)}
                    placeholder="https://x.com/... (Social Blitz post)"
                    className="bg-[#0B0F17] border border-[#1F2A40] rounded px-2 py-1 text-[11px] font-mono text-[#EDF2F9] placeholder-[#5E6E8E] focus:outline-none focus:border-[#00E5CC]"
                  />
                )}
                {b.id === 'Bonus Blog' && (
                  <input
                    type="url"
                    value={fields.blogPostUrl}
                    onChange={(e) => updateField('blogPostUrl', e.target.value)}
                    placeholder="https://dev.to/... (Kiroween blog)"
                    className="bg-[#0B0F17] border border-[#1F2A40] rounded px-2 py-1 text-[11px] font-mono text-[#EDF2F9] placeholder-[#5E6E8E] focus:outline-none focus:border-[#00E5CC]"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
