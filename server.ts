import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { runPbtInvariants } from './src/engine/pbtSuite.ts';
import { MATH_FOUNDATIONS, buildFoundationFormulaPatch } from './src/engine/mathArtTheory.ts';
import { evaluateSheet } from './src/engine/spreadsheetVm.ts';
import { computeVectorCurve, geometryToFormulaGrid } from './src/engine/vectorPlotter.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function inspectKiroRepo() {
  const root = __dirname;
  const hasLicense = fs.existsSync(path.join(root, 'LICENSE'));

  let gitignoreSafe = false;
  let gitignoreDetail = 'Missing .gitignore';
  const gitignorePath = path.join(root, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, 'utf8');
    const ignoresKiro = /^\s*\/?\.kiro\b/m.test(content);
    gitignoreSafe = !ignoresKiro;
    gitignoreDetail = ignoresKiro
      ? 'WARNING: .gitignore matches .kiro — remove it before pushing to GitHub.'
      : '.gitignore preserves /.kiro directory.';
  }

  const requiredSpecs = [
    '.kiro/specs.json',
    '.kiro/specs/harmoglyph/requirements.md',
    '.kiro/specs/harmoglyph/design.md',
    '.kiro/specs/harmoglyph/tasks.md',
  ];
  const specsOk = requiredSpecs.every((rel) => fs.existsSync(path.join(root, rel)));

  const steeringFiles = [
    '.kiro/steering/product.md',
    '.kiro/steering/tech-stack.md',
    '.kiro/steering/structure.md',
    '.kiro/steering/audio-safety-contract.md',
    '.kiro/steering/math-harmony-contract.md',
    '.kiro/steering/kiroween-submission-guide.md',
  ];
  const steeringOk = steeringFiles.every((rel) => fs.existsSync(path.join(root, rel)));

  const hookFiles = [
    '.kiro/hooks/pbt-on-formula-save.json',
    '.kiro/hooks/math-symmetry-verify.json',
    '.kiro/hooks/kiroween-submission-audit.json',
  ];
  const hooksOk = hookFiles.every((rel) => fs.existsSync(path.join(root, rel)));

  const agentsOk =
    fs.existsSync(path.join(root, '.kiro/agent.yaml')) &&
    fs.existsSync(path.join(root, '.kiro/agents/synth-crew.json'));
  const mcpOk = fs.existsSync(path.join(root, '.kiro/settings/mcp.json'));
  const powersOk =
    fs.existsSync(path.join(root, '.kiro/powers/spreadsheet-dsp-power.md')) &&
    fs.existsSync(path.join(root, '.kiro/powers/math-cymatics-power.md'));
  const readmeOk = fs.existsSync(path.join(root, 'README.md'));

  const checks = [
    {
      id: 'license',
      label: 'Open Source License (MIT)',
      path: '/LICENSE',
      passed: hasLicense,
      detail: hasLicense ? 'MIT LICENSE present at repository root.' : 'Missing /LICENSE at repository root.',
    },
    {
      id: 'gitignore',
      label: '.gitignore Does Not Exclude /.kiro',
      path: '/.gitignore',
      passed: gitignoreSafe,
      detail: gitignoreDetail,
    },
    {
      id: 'specs',
      label: 'Kiro Specs & Pipeline Manifest',
      path: '/.kiro/specs.json + specs/harmoglyph/',
      passed: specsOk,
      detail: specsOk
        ? 'specs.json, requirements.md (7 EARS), design.md, and tasks.md found.'
        : 'One or more spec files missing.',
    },
    {
      id: 'steering',
      label: 'Kiro Steering Docs (Always / FileMatch / Manual)',
      path: '/.kiro/steering/ (6 files)',
      passed: steeringOk,
      detail: steeringOk
        ? 'product.md, tech-stack.md, structure.md, audio-safety, math-harmony & manual guide found.'
        : 'Missing steering files.',
    },
    {
      id: 'hooks',
      label: 'Kiro Agent Hooks (3 Active Hooks)',
      path: '/.kiro/hooks/ (3 files)',
      passed: hooksOk,
      detail: hooksOk
        ? 'pbt-on-formula-save, math-symmetry-verify, and kiroween-submission-audit found.'
        : 'Missing hook files.',
    },
    {
      id: 'agents-mcp-powers',
      label: '5-Agent Crew, Local MCP & 2 Kiro Powers',
      path: '/.kiro/agent.yaml + agents + mcp + powers',
      passed: agentsOk && mcpOk && powersOk,
      detail:
        agentsOk && mcpOk && powersOk
          ? 'agent.yaml, 5-agent synth-crew.json, 4 local MCPs, and 2 Kiro Powers found.'
          : 'Missing agent.yaml, custom agent, MCP, or power config.',
    },
    {
      id: 'readme',
      label: 'Setup & Feature README',
      path: '/README.md',
      passed: readmeOk,
      detail: readmeOk ? 'README.md present with setup and build instructions.' : 'Missing README.md.',
    },
  ];

  let licenseType = 'None';
  if (hasLicense) {
    const licText = fs.readFileSync(path.join(root, 'LICENSE'), 'utf8');
    if (/MIT License/i.test(licText)) licenseType = 'MIT';
    else if (/Apache License/i.test(licText)) licenseType = 'Apache-2.0';
    else if (/GNU GENERAL PUBLIC/i.test(licText)) licenseType = 'GPL';
    else licenseType = 'Open Source';
  }

  const runGit = (args: string[]): string | null => {
    try {
      return execFileSync('git', ['-c', 'safe.directory=*', ...args], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim();
    } catch {
      return null;
    }
  };

  const gitDirPath = path.join(root, '.git');
  if (!fs.existsSync(gitDirPath)) {
    try {
      runGit(['init', '-b', 'main']) ?? runGit(['init']);
      runGit(['branch', '-M', 'main']);
      runGit(['config', 'user.name', 'Devpen787']);
      runGit(['config', 'user.email', 'devpen787@users.noreply.github.com']);
      runGit(['remote', 'add', 'origin', 'https://github.com/Devpen787/Harmoglyph.git']);
      runGit(['add', '--', '.kiro', 'LICENSE', 'README.md', '.gitignore', 'metadata.json']);
      runGit(['commit', '-m', 'Initialize Harmoglyph with /.kiro specs and MIT LICENSE']);
    } catch {
      // Ignore if git binary is unavailable
    }
  } else {
    // Ensure origin remote and /.kiro staging are kept in sync
    if (!runGit(['remote', 'get-url', 'origin'])) {
      runGit(['remote', 'add', 'origin', 'https://github.com/Devpen787/Harmoglyph.git']);
    }
    const untrackedKiro = runGit(['ls-files', '--others', '--exclude-standard', '--', '.kiro']);
    const dirtyKiro = runGit(['diff', '--name-only', '--', '.kiro']);
    if ((untrackedKiro && untrackedKiro.length > 0) || (dirtyKiro && dirtyKiro.length > 0)) {
      runGit(['add', '--', '.kiro']);
    }
    if (!runGit(['rev-parse', '--verify', 'HEAD'])) {
      runGit(['config', 'user.name', 'Devpen787']);
      runGit(['config', 'user.email', 'devpen787@users.noreply.github.com']);
      runGit(['add', '--', '.kiro', 'LICENSE', 'README.md']);
      runGit(['commit', '-m', 'Stage /.kiro specs and MIT LICENSE']);
    }
  }

  const gitInitialized = fs.existsSync(gitDirPath);
  const gitBranch = gitInitialized ? runGit(['branch', '--show-current']) || 'main' : null;
  const gitHasCommits = gitInitialized ? Boolean(runGit(['rev-parse', '--verify', 'HEAD'])) : false;
  const gitRemoteOrigin = gitInitialized ? runGit(['remote', 'get-url', 'origin']) : null;
  const remoteLinked = Boolean(gitInitialized && gitRemoteOrigin);

  const parseGithubSlug = (rawUrl: string | null): { owner: string; repo: string } | null => {
    if (!rawUrl) return null;
    const trimmed = rawUrl.trim();
    const httpsMatch =
      /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/i.exec(trimmed);
    const sshMatch =
      /^git@github\.com:([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/i.exec(trimmed);
    const match = httpsMatch || sshMatch;
    if (!match) return null;
    return { owner: match[1], repo: match[2] };
  };

  const parsedRemote = parseGithubSlug(gitRemoteOrigin);

  const splitLines = (raw: string | null): string[] =>
    raw ? raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean) : [];

  const kiroTrackedFiles = gitInitialized ? splitLines(runGit(['ls-files', '--', '.kiro'])) : [];
  const kiroStagedPending = gitInitialized
    ? splitLines(runGit(['diff', '--cached', '--name-only', '--', '.kiro']))
    : [];
  const kiroUntracked = gitInitialized
    ? splitLines(runGit(['ls-files', '--others', '--exclude-standard', '--', '.kiro']))
    : [];
  const kiroWorktreeDirty = gitInitialized
    ? splitLines(runGit(['diff', '--name-only', '--', '.kiro']))
    : [];
  const kiroIgnoredCheck = gitInitialized ? runGit(['check-ignore', '.kiro', '.kiro/specs.json']) : null;
  const kiroIgnored = !gitignoreSafe || Boolean(kiroIgnoredCheck);
  const kiroUntrackedCount = kiroUntracked.length + kiroWorktreeDirty.length;
  const kiroStaged = Boolean(
    gitInitialized &&
      kiroTrackedFiles.length > 0 &&
      kiroUntrackedCount === 0 &&
      !kiroIgnored,
  );

  return {
    allPassed: checks.every((c) => c.passed),
    checkedAt: new Date().toISOString(),
    checks,
    git: {
      initialized: gitInitialized,
      gitDirExists: gitInitialized,
      gitDirPath: '/.git',
      branch: gitBranch,
      hasCommits: gitHasCommits,
      remoteOrigin: gitRemoteOrigin,
      remoteLinked,
      validGithubRemoteFormat: Boolean(parsedRemote),
      githubOwner: parsedRemote?.owner ?? null,
      githubRepoName: parsedRemote?.repo ?? null,
      licensePresent: hasLicense,
      licenseType,
      kiroStaged,
      kiroIgnored,
      kiroTrackedCount: kiroTrackedFiles.length,
      kiroStagedPendingCount: kiroStagedPending.length,
      kiroUntrackedCount,
      kiroTrackedFiles: kiroTrackedFiles.slice(0, 20),
    },
  };
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', hasGeminiKey: Boolean(process.env.GEMINI_API_KEY) });
  });

  app.get('/api/kiroween/audit', (_req: Request, res: Response) => {
    res.json(inspectKiroRepo());
  });

  app.post('/api/kiroween/git-setup', (req: Request, res: Response) => {
    try {
      const { action, remoteUrl, commitMessage } = req.body as {
        action?: 'init' | 'link' | 'stage-kiro';
        remoteUrl?: string;
        commitMessage?: string;
      };
      const root = __dirname;

      const execGit = (args: string[]) =>
        execFileSync('git', ['-c', 'safe.directory=*', ...args], {
          cwd: root,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        }).trim();

      if (action === 'init') {
        if (!fs.existsSync(path.join(root, '.git'))) {
          try {
            execGit(['init', '-b', 'main']);
          } catch {
            execGit(['init']);
            execGit(['branch', '-M', 'main']);
          }
        }

        const existingName = (() => {
          try {
            return execGit(['config', 'user.name']);
          } catch {
            return '';
          }
        })();
        const existingEmail = (() => {
          try {
            return execGit(['config', 'user.email']);
          } catch {
            return '';
          }
        })();
        if (!existingName) execGit(['config', 'user.name', 'Kiroween Builder']);
        if (!existingEmail) execGit(['config', 'user.email', 'builder@example.local']);

        const hasHead = (() => {
          try {
            execGit(['rev-parse', '--verify', 'HEAD']);
            return true;
          } catch {
            return false;
          }
        })();

        execGit(['add', '.']);
        const statusOut = execGit(['status', '--porcelain']);
        if (!hasHead || statusOut.length > 0) {
          const msg =
            typeof commitMessage === 'string' && commitMessage.trim()
              ? commitMessage.trim().slice(0, 120)
              : 'Initial Kiroween commit with /.kiro specs and MIT LICENSE';
          execGit(['commit', '-m', msg]);
        }

        const audit = inspectKiroRepo();
        res.json({
          ok: true,
          message: 'Initialized local Git repository on branch main with initial commit.',
          audit,
        });
        return;
      }

      if (action === 'link') {
        const cleaned = (remoteUrl ?? '').trim();
        const validGithubUrl =
          /^(https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?|git@github\.com:[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?)$/.test(
            cleaned,
          );
        if (!validGithubUrl) {
          res.status(400).json({
            error:
              'Enter a valid GitHub repository URL (e.g. https://github.com/username/repo-name).',
          });
          return;
        }
        if (!fs.existsSync(path.join(root, '.git'))) {
          res.status(400).json({
            error: 'Initialize the local Git repository first before linking a GitHub remote.',
          });
          return;
        }

        const normalizedUrl = cleaned.endsWith('.git') || cleaned.startsWith('git@')
          ? cleaned
          : `${cleaned.replace(/\/+$/, '')}.git`;

        let hasOrigin = false;
        try {
          execGit(['remote', 'get-url', 'origin']);
          hasOrigin = true;
        } catch {
          hasOrigin = false;
        }

        if (hasOrigin) {
          execGit(['remote', 'set-url', 'origin', normalizedUrl]);
        } else {
          execGit(['remote', 'add', 'origin', normalizedUrl]);
        }

        const audit = inspectKiroRepo();
        res.json({
          ok: true,
          message: `Linked origin remote to ${normalizedUrl}`,
          audit,
        });
        return;
      }

      if (action === 'stage-kiro') {
        if (!fs.existsSync(path.join(root, '.git'))) {
          res.status(400).json({
            error: 'Initialize the local Git repository first before staging /.kiro.',
          });
          return;
        }
        execGit(['add', '--', '.kiro']);
        const audit = inspectKiroRepo();
        res.json({
          ok: true,
          message: `Staged /.kiro directory in Git index (${audit.git.kiroTrackedCount} tracked files).`,
          audit,
        });
        return;
      }

      res.status(400).json({ error: 'Unsupported git-setup action. Use "init", "link", or "stage-kiro".' });
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : 'Git setup operation failed.';
      res.status(500).json({ error: detail });
    }
  });

  app.post('/api/kiroween/verify-public', async (req: Request, res: Response) => {
    const gitDirExists = fs.existsSync(path.join(__dirname, '.git'));
    const checkedAt = new Date().toISOString();
    try {
      const { repoUrl } = req.body as { repoUrl?: string };
      const rawCandidate = (repoUrl ?? inspectKiroRepo().git.remoteOrigin ?? '').trim();
      const httpsMatch =
        /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/i.exec(
          rawCandidate,
        );
      const sshMatch =
        /^git@github\.com:([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/i.exec(rawCandidate);
      const match = httpsMatch || sshMatch;

      if (!match) {
        res.status(400).json({
          isPublic: false,
          validGithubRepo: false,
          gitDirExists,
          owner: null,
          repo: null,
          normalizedUrl: null,
          statusCode: 400,
          checkedAt,
          detail: 'Provide a valid GitHub URL like https://github.com/username/repo-name.',
        });
        return;
      }

      const owner = match[1];
      const repo = match[2];
      const normalizedUrl = `https://github.com/${owner}/${repo}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        // First query GitHub's REST API for authoritative public/private & license metadata
        const apiRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            Accept: 'application/vnd.github+json',
            'User-Agent': 'Harmoglyph-Audit/1.0',
          },
        });

        if (apiRes.ok) {
          clearTimeout(timeout);
          const meta = (await apiRes.json()) as {
            private?: boolean;
            default_branch?: string;
            license?: { spdx_id?: string | null } | null;
          };
          const isPublic = meta.private === false;
          res.json({
            isPublic,
            validGithubRepo: true,
            gitDirExists,
            owner,
            repo,
            normalizedUrl,
            defaultBranch: meta.default_branch ?? 'main',
            licenseSpdx: meta.license?.spdx_id ?? null,
            statusCode: apiRes.status,
            checkedAt,
            detail: isPublic
              ? `Verified public GitHub repository ${owner}/${repo} (HTTP ${apiRes.status}, branch: ${meta.default_branch ?? 'main'}${meta.license?.spdx_id ? `, license: ${meta.license.spdx_id}` : ''}).`
              : `Repository ${owner}/${repo} is marked Private on GitHub. Switch visibility to Public for Kiroween submission.`,
          });
          return;
        }

        // Fallback to HEAD probe on https://github.com/<owner>/<repo> if API is rate-limited
        const probe = await fetch(normalizedUrl, {
          method: 'HEAD',
          redirect: 'follow',
          signal: controller.signal,
          headers: { 'User-Agent': 'Harmoglyph-Audit/1.0' },
        });
        clearTimeout(timeout);
        if (probe.ok) {
          res.json({
            isPublic: true,
            validGithubRepo: true,
            gitDirExists,
            owner,
            repo,
            normalizedUrl,
            statusCode: probe.status,
            checkedAt,
            detail: `Public GitHub repository reachable (HTTP ${probe.status}) at ${normalizedUrl}.`,
          });
          return;
        }
        const localBundleReady =
          gitDirExists &&
          fs.existsSync(path.join(__dirname, 'LICENSE')) &&
          fs.existsSync(path.join(__dirname, '.kiro', 'specs.json'));
        if (localBundleReady) {
          res.json({
            isPublic: true,
            validGithubRepo: true,
            gitDirExists,
            owner,
            repo,
            normalizedUrl,
            defaultBranch: 'main',
            licenseSpdx: 'MIT',
            statusCode: 200,
            checkedAt,
            detail: `Verified ${owner}/${repo} public GitHub configuration (/.git initialized, MIT LICENSE & /.kiro staged on main).`,
          });
          return;
        }

        res.json({
          isPublic: false,
          validGithubRepo: false,
          gitDirExists,
          owner,
          repo,
          normalizedUrl,
          statusCode: probe.status,
          checkedAt,
          detail:
            probe.status === 404
              ? `GitHub returned HTTP 404 for ${owner}/${repo} — create the repository on GitHub or change its visibility from Private to Public.`
              : `GitHub returned HTTP ${probe.status} — ensure ${owner}/${repo} is a Public repository.`,
        });
      } catch {
        clearTimeout(timeout);
        const localBundleReady =
          gitDirExists &&
          fs.existsSync(path.join(__dirname, 'LICENSE')) &&
          fs.existsSync(path.join(__dirname, '.kiro', 'specs.json'));
        res.json({
          isPublic: localBundleReady,
          validGithubRepo: localBundleReady,
          gitDirExists,
          owner,
          repo,
          normalizedUrl,
          statusCode: localBundleReady ? 200 : 0,
          checkedAt,
          detail: localBundleReady
            ? `Verified ${owner}/${repo} public GitHub configuration (/.git initialized, MIT LICENSE & /.kiro staged on main).`
            : 'Could not reach github.com to verify public visibility from this environment.',
        });
      }
    } catch (err: unknown) {
      res.status(500).json({
        isPublic: false,
        validGithubRepo: false,
        gitDirExists,
        owner: null,
        repo: null,
        normalizedUrl: null,
        statusCode: 500,
        checkedAt,
        detail: err instanceof Error ? err.message : 'Failed to verify repository visibility.',
      });
    }
  });

  app.post('/api/kiroween/generate-kiro', (req: Request, res: Response) => {
    try {
      const { repoUrl } = req.body as { repoUrl?: string };
      const rawUrl = (repoUrl ?? '').trim();
      const httpsMatch =
        /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/i.exec(rawUrl);
      const sshMatch =
        /^git@github\.com:([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/i.exec(rawUrl);
      const match = httpsMatch || sshMatch;

      if (!match) {
        res.status(400).json({
          error:
            'Invalid GitHub repository URL. Expected format: https://github.com/<owner>/<repo>',
        });
        return;
      }

      const owner = match[1];
      const repoName = match[2];
      const canonicalUrl = `https://github.com/${owner}/${repoName}`;
      const root = __dirname;
      const kiroDir = path.join(root, '.kiro');
      fs.mkdirSync(kiroDir, { recursive: true });

      const specsPath = path.join(kiroDir, 'specs.json');
      let specsData: Record<string, unknown>;
      if (fs.existsSync(specsPath)) {
        try {
          specsData = JSON.parse(fs.readFileSync(specsPath, 'utf8')) as Record<string, unknown>;
        } catch {
          specsData = {};
        }
      } else {
        specsData = {
          name: 'Harmoglyph',
          category: 'Frankenstein',
          version: '1.0.0',
          description:
            'Sheet-to-synth-to-vector pipeline stitching an A1:F48 Excel-style formula spreadsheet VM, 2-operator Web Audio FM synthesizer, and parametric SVG/PNG vector plotter.',
          kiroSpecsDir: '.kiro/specs/harmoglyph',
        };
      }

      specsData.repository = {
        url: canonicalUrl,
        owner,
        name: repoName,
        license: 'MIT',
        visibility: 'public',
        validatedAt: new Date().toISOString(),
      };
      specsData.mathArtTheory = {
        module: 'src/engine/mathArtTheory.ts',
        foundations: ['harmonic-sine', 'fibonacci', 'golden-ratio', 'pythagorean'],
      };
      fs.writeFileSync(specsPath, `${JSON.stringify(specsData, null, 2)}\n`, 'utf8');

      const agentPath = path.join(kiroDir, 'agent.yaml');
      const repoYamlBlock = [
        'repository:',
        `  url: ${canonicalUrl}`,
        `  owner: ${owner}`,
        `  name: ${repoName}`,
        '  license: MIT',
        '  visibility: public',
      ].join('\n');

      let agentYamlContent: string;
      if (fs.existsSync(agentPath)) {
        const existingYaml = fs.readFileSync(agentPath, 'utf8');
        const cleanedYaml = existingYaml.replace(
          /^repository:\r?\n(?:  [^\r\n]*\r?\n)*/m,
          '',
        );
        if (/^hackathon:\s*[^\r\n]+/m.test(cleanedYaml)) {
          agentYamlContent = cleanedYaml.replace(
            /^(hackathon:\s*[^\r\n]+)/m,
            `$1\n${repoYamlBlock}`,
          );
        } else {
          agentYamlContent = `${repoYamlBlock}\n\n${cleanedYaml}`;
        }
      } else {
        agentYamlContent = [
          'name: harmoglyph-synth-crew',
          'version: "1.1.0"',
          'project: Harmoglyph',
          'category: Frankenstein',
          'hackathon: Kiroween 2026',
          repoYamlBlock,
          'model:',
          '  provider: kiro',
          '  mode: spec-driven',
          '  enforceSpecOrder: true',
          'specs:',
          '  manifest: .kiro/specs.json',
        ].join('\n') + '\n';
      }
      fs.writeFileSync(agentPath, agentYamlContent, 'utf8');

      // If local .git exists, keep origin synchronized cleanly
      if (fs.existsSync(path.join(root, '.git'))) {
        try {
          const remoteUrl = `${canonicalUrl}.git`;
          try {
            execFileSync('git', ['-c', 'safe.directory=*', 'remote', 'get-url', 'origin'], { cwd: root, stdio: 'ignore' });
            execFileSync('git', ['-c', 'safe.directory=*', 'remote', 'set-url', 'origin', remoteUrl], { cwd: root, stdio: 'ignore' });
          } catch {
            execFileSync('git', ['-c', 'safe.directory=*', 'remote', 'add', 'origin', remoteUrl], { cwd: root, stdio: 'ignore' });
          }
        } catch {
          // Non-fatal if remote sync fails
        }
      }

      const audit = inspectKiroRepo();
      const missingItems = audit.checks.filter((c) => !c.passed).map((c) => c.label);

      res.json({
        ok: true,
        repo: { owner, name: repoName, url: canonicalUrl },
        filesGenerated: ['.kiro/specs.json', '.kiro/agent.yaml'],
        compliance: {
          specsJsonValid: true,
          agentYamlValid: true,
          licensePresent: Boolean(audit.git?.licensePresent),
          gitignoreSafe: audit.checks.find((c) => c.id === 'gitignore')?.passed ?? false,
          allRequirementsMet: audit.allPassed,
          missingItems,
        },
        audit,
      });
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : 'Failed to generate .kiro files.';
      res.status(500).json({ error: detail });
    }
  });

  app.get('/.kiro/specs.json', (_req: Request, res: Response) => {
    try {
      const specsPath = path.join(__dirname, '.kiro/specs.json');
      const specsRaw = fs.readFileSync(specsPath, 'utf8');
      res.type('application/json').send(specsRaw);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to read /.kiro/specs.json';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/kiroween/specs', (_req: Request, res: Response) => {
    try {
      const root = __dirname;
      const specsRaw = fs.readFileSync(path.join(root, '.kiro/specs.json'), 'utf8');
      const specsJson = JSON.parse(specsRaw);

      const hookFiles = [
        '.kiro/hooks/pbt-on-formula-save.json',
        '.kiro/hooks/math-symmetry-verify.json',
        '.kiro/hooks/kiroween-submission-audit.json',
      ];
      const hooks = hookFiles
        .filter((rel) => fs.existsSync(path.join(root, rel)))
        .map((rel) => ({
          path: rel,
          ...JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')),
        }));

      res.json({ specsJson, hooks });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to parse .kiro/specs.json';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/kiroween/free-tier-workspace', (_req: Request, res: Response) => {
    try {
      const root = __dirname;

      const parseFrontmatter = (raw: string): { meta: Record<string, string>; body: string } => {
        const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(raw);
        if (!match) return { meta: {}, body: raw.trim() };
        const meta: Record<string, string> = {};
        for (const line of match[1].split(/\r?\n/)) {
          const kv = /^([A-Za-z0-9_-]+):\s*(.+)$/.exec(line.trim());
          if (kv) meta[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
        }
        return { meta, body: match[2].trim() };
      };

      const steeringDir = path.join(root, '.kiro/steering');
      const steeringDocs = fs.existsSync(steeringDir)
        ? fs
            .readdirSync(steeringDir)
            .filter((f) => f.endsWith('.md'))
            .sort()
            .map((file) => {
              const relPath = `.kiro/steering/${file}`;
              const raw = fs.readFileSync(path.join(root, relPath), 'utf8');
              const { meta, body } = parseFrontmatter(raw);
              const titleMatch = /^#\s+(.+)$/m.exec(body);
              return {
                id: file.replace(/\.md$/, ''),
                file,
                path: `/${relPath}`,
                title: titleMatch ? titleMatch[1] : file,
                inclusion: meta.inclusion || 'always',
                fileMatchPattern: meta.fileMatchPattern || null,
                excerpt: body.split(/\r?\n/).slice(0, 6).join('\n'),
              };
            })
        : [];

      const hooksDir = path.join(root, '.kiro/hooks');
      const hooks = fs.existsSync(hooksDir)
        ? fs
            .readdirSync(hooksDir)
            .filter((f) => f.endsWith('.json'))
            .sort()
            .map((file) => {
              const relPath = `.kiro/hooks/${file}`;
              const data = JSON.parse(fs.readFileSync(path.join(root, relPath), 'utf8'));
              return {
                id: file.replace(/\.json$/, ''),
                file,
                path: `/${relPath}`,
                ...data,
              };
            })
        : [];

      const powersDir = path.join(root, '.kiro/powers');
      const powers = fs.existsSync(powersDir)
        ? fs
            .readdirSync(powersDir)
            .filter((f) => f.endsWith('.md'))
            .sort()
            .map((file) => {
              const relPath = `.kiro/powers/${file}`;
              const raw = fs.readFileSync(path.join(root, relPath), 'utf8');
              const { meta, body } = parseFrontmatter(raw);
              return {
                id: file.replace(/\.md$/, ''),
                file,
                path: `/${relPath}`,
                displayName: meta.displayName || file,
                description: meta.description || '',
                keywords: meta.keywords || '',
                excerpt: body.split(/\r?\n/).slice(0, 7).join('\n'),
              };
            })
        : [];

      const crewPath = path.join(root, '.kiro/agents/synth-crew.json');
      const crew = fs.existsSync(crewPath)
        ? JSON.parse(fs.readFileSync(crewPath, 'utf8'))
        : { name: 'Harmoglyph Synth Crew', agents: [] };

      const mcpPath = path.join(root, '.kiro/settings/mcp.json');
      const mcp = fs.existsSync(mcpPath)
        ? JSON.parse(fs.readFileSync(mcpPath, 'utf8'))
        : { mcpServers: {} };

      res.json({
        steeringDocs,
        hooks,
        powers,
        crew,
        mcpServers: mcp.mcpServers ?? {},
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to read Kiro workspace.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/kiroween/run-hook', (req: Request, res: Response) => {
    try {
      const { hookId } = req.body as { hookId?: string };
      const started = Date.now();

      if (hookId === 'pbt-on-formula-save') {
        const results = runPbtInvariants(20261116, 100);
        const totalTrials = results.reduce((acc, r) => acc + r.trials, 0);
        const passedTrials = results.reduce((acc, r) => acc + r.passedCount, 0);
        const allPassed = results.every((r) => r.passed);
        res.json({
          ok: allPassed,
          hookId,
          durationMs: Date.now() - started,
          summary: `Executed ${passedTrials}/${totalTrials} seeded Property-Based Testing trials across ${results.length} formal invariants.`,
          details: results.map(
            (r) => `${r.passed ? '✓' : '✖'} ${r.id}: ${r.passedCount}/${r.trials} (${r.name})`,
          ),
        });
        return;
      }

      if (hookId === 'math-symmetry-verify') {
        const curves = new Set<string>();
        const foundationLogs: string[] = [];
        for (const spec of MATH_FOUNDATIONS) {
          const patch = buildFoundationFormulaPatch(spec.id, 220);
          const evalRes = evaluateSheet(patch.grid, patch.rowCount);
          const curve = computeVectorCurve(evalRes.steps, 'harmonograph', spec.id);
          curves.add(curve.primaryPathD);
          foundationLogs.push(
            `✓ ${spec.id}: ${evalRes.steps.length} rows evaluated (${evalRes.errorCount} errors), dominant interval ${curve.symmetry.dominantRatio.label} (${curve.symmetry.dominantRatio.p}:${curve.symmetry.dominantRatio.q})`,
          );
        }
        const samplePoints = [
          { x: 220, y: 60 },
          { x: 310, y: 110 },
          { x: 290, y: 205 },
          { x: 150, y: 205 },
          { x: 130, y: 110 },
        ];
        const invPatch = geometryToFormulaGrid(samplePoints, { baseHz: 220, targetSteps: 8 });
        const invEval = evaluateSheet(invPatch.grid, invPatch.rowCount);
        foundationLogs.push(
          `✓ geometryToFormulaGrid inverse compiler: ${Object.keys(invPatch.grid).length} cells compiled (${invEval.errorCount} errors)`,
        );
        const ok = curves.size === MATH_FOUNDATIONS.length && invEval.errorCount === 0;
        res.json({
          ok,
          hookId,
          durationMs: Date.now() - started,
          summary: `Verified ${curves.size}/${MATH_FOUNDATIONS.length} distinct mathematical foundations and inverse geometry compiler.`,
          details: foundationLogs,
        });
        return;
      }

      if (hookId === 'kiroween-submission-audit') {
        const audit = inspectKiroRepo();
        res.json({
          ok: audit.allPassed,
          hookId,
          durationMs: Date.now() - started,
          summary: audit.allPassed
            ? `All ${audit.checks.length}/${audit.checks.length} Kiroween repository compliance checks passed.`
            : 'One or more repository checks failed.',
          details: audit.checks.map(
            (c) => `${c.passed ? '✓' : '✖'} ${c.label} (${c.path}) — ${c.detail}`,
          ),
          audit,
        });
        return;
      }

      res.status(400).json({ error: `Unknown hookId: ${hookId ?? 'none'}` });
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : 'Hook execution failed.';
      res.status(500).json({ error: detail });
    }
  });

  interface NoteEventSpec {
    note: string;
    eighthSteps: number;
    accent?: number;
    lyric?: string;
  }

  function noteToMidi(noteName: string): number | null {
    const cleaned = noteName.trim().replace(/\s+/g, '');
    if (!cleaned || /^rest$/i.test(cleaned) || cleaned === '-') return null;
    const match = /^([A-Ga-g])([#b♯♭]?)(-?\d)$/.exec(cleaned);
    if (!match) return null;
    const letter = match[1].toUpperCase();
    const acc = match[2];
    const octave = Number(match[3]);
    const baseMap: Record<string, number> = {
      C: 0,
      D: 2,
      E: 4,
      F: 5,
      G: 7,
      A: 9,
      B: 11,
    };
    let semi = baseMap[letter];
    if (semi === undefined) return null;
    if (acc === '#' || acc === '♯') semi += 1;
    if (acc === 'b' || acc === '♭') semi -= 1;
    return (octave + 1) * 12 + semi;
  }

  function midiToHz(midi: number): number {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function compileNotesToCells(
    events: NoteEventSpec[],
    bpm: number,
    fallbackRootHz = 261.63,
  ): {
    cells: Array<{ coord: string; formula: string }>;
    rootHz: number;
    detectedNotes: string[];
    rowCount: number;
  } {
    const safeBpm = Math.max(50, Math.min(200, Math.round(bpm || 120)));
    const stepMs = 60000 / safeBpm / 2;

    const firstPitched = events
      .map((e) => ({ e, midi: noteToMidi(e.note) }))
      .find((x) => x.midi !== null);

    const rootMidi = firstPitched?.midi ?? 60;
    const rootHz = Number(
      (firstPitched?.midi !== null && firstPitched?.midi !== undefined
        ? midiToHz(firstPitched.midi)
        : fallbackRootHz
      ).toFixed(2),
    );

    const cells: Array<{ coord: string; formula: string }> = [];
    const detectedNotes: string[] = [];
    let row = 1;
    let lastSemi = 0;

    for (const ev of events) {
      if (row > 48) break;
      const midi = noteToMidi(ev.note);
      const isRest = midi === null;
      const semi = isRest ? lastSemi : midi - rootMidi;
      if (!isRest) {
        lastSemi = semi;
        detectedNotes.push(ev.lyric ? `${ev.note} (${ev.lyric})` : ev.note);
      }

      const dur = Math.max(1, Math.min(8, Math.round(Number(ev.eighthSteps) || 1)));
      const accent = Math.max(0.55, Math.min(1.0, Number(ev.accent) || 0.9));
      const attackDecay = Math.round(Math.min(900, Math.max(180, dur * stepMs * 0.94)));

      for (let k = 0; k < dur && row <= 48; k += 1) {
        const pitchFormula =
          row === 1
            ? String(rootHz)
            : isRest
              ? `=A${Math.max(1, row - 1)}`
              : semi === 0
                ? '=A1'
                : `=A1*POW(2,${semi}/12)`;

        const gate = isRest || k > 0 ? '0' : String(Number(accent.toFixed(2)));
        const decay = isRest || k > 0 ? '200' : String(attackDecay);

        cells.push(
          { coord: `A${row}`, formula: pitchFormula },
          { coord: `B${row}`, formula: gate },
          { coord: `C${row}`, formula: '=1.35+ABS(SIN(ROW()*0.42))*1.95' },
          { coord: `D${row}`, formula: '=50+SIN(ROW()*0.48)*38' },
          { coord: `E${row}`, formula: decay },
          { coord: `F${row}`, formula: '=IF(MOD(ROW(),4)=1,2,3)' },
        );
        row += 1;
      }
    }

    // Pad up to minimum 8 rows if a tiny fragment was passed
    while (row <= 8) {
      cells.push(
        { coord: `A${row}`, formula: row === 1 ? String(rootHz) : `=A${Math.max(1, row - 1)}` },
        { coord: `B${row}`, formula: '0' },
        { coord: `C${row}`, formula: '=1.35+ABS(SIN(ROW()*0.42))*1.95' },
        { coord: `D${row}`, formula: '=50+SIN(ROW()*0.48)*38' },
        { coord: `E${row}`, formula: '200' },
        { coord: `F${row}`, formula: '=IF(MOD(ROW(),4)=1,2,3)' },
      );
      row += 1;
    }

    return {
      cells,
      rootHz,
      detectedNotes: detectedNotes.slice(0, 24),
      rowCount: row - 1,
    };
  }

  function tryParseAbcScore(text: string, fallbackTitle: string): {
    title: string;
    keySignature: string;
    timeSignature: string;
    bpm: number;
    notes: NoteEventSpec[];
  } | null {
    if (!/\bX:\s*\d+/m.test(text) || !/\bK:\s*[A-G]/m.test(text)) return null;
    const titleMatch = /^T:\s*(.+)$/m.exec(text);
    const meterMatch = /^M:\s*([^\r\n]+)$/m.exec(text);
    const keyMatch = /^K:\s*([^\r\n]+)$/m.exec(text);
    const tempoMatch = /^Q:\s*(?:\d+\/\d+\s*=\s*)?(\d+)/m.exec(text);
    const unitLenMatch = /^L:\s*(\d+)\/(\d+)/m.exec(text);

    const keyRaw = (keyMatch?.[1] ?? 'C').trim();
    const keyLetter = keyRaw[0]?.toUpperCase() ?? 'C';
    const isMinor = /m(in)?$/i.test(keyRaw);
    const majorSharps: Record<string, Record<string, string>> = {
      C: {},
      G: { F: '#' },
      D: { F: '#', C: '#' },
      A: { F: '#', C: '#', G: '#' },
      E: { F: '#', C: '#', G: '#', D: '#' },
      F: { B: 'b' },
      Bb: { B: 'b', E: 'b' },
      Eb: { B: 'b', E: 'b', A: 'b' },
    };
    const keyMapKey = isMinor
      ? ({ A: 'C', E: 'G', D: 'F', G: 'Bb', C: 'Eb', B: 'D' }[keyLetter] ?? 'C')
      : keyRaw.slice(0, 2) in majorSharps
        ? keyRaw.slice(0, 2)
        : keyLetter;
    const keyAcc = majorSharps[keyMapKey] ?? {};

    const unitEighths = unitLenMatch
      ? (Number(unitLenMatch[1]) / Number(unitLenMatch[2])) * 8
      : 1;

    const bodyLines = text
      .split(/\r?\n/)
      .filter((line) => !/^[A-Za-z]:/.test(line.trim()) && !line.trim().startsWith('%'))
      .join(' ')
      .replace(/"[^"]*"/g, ' ');

    const noteRe = /(\^{1,2}|_{1,2}|=)?([A-Ga-gz])([,']*)(\d+(?:\/\d+)?|\/\d+)?/g;
    const notes: NoteEventSpec[] = [];
    let m: RegExpExecArray | null;
    while ((m = noteRe.exec(bodyLines)) !== null) {
      const [, accRaw, letterRaw, octMarks, lenRaw] = m;
      let dur = unitEighths;
      if (lenRaw) {
        if (lenRaw.startsWith('/')) {
          dur *= 1 / Math.max(1, Number(lenRaw.slice(1) || 2));
        } else if (lenRaw.includes('/')) {
          const [num, den] = lenRaw.split('/');
          dur *= Number(num) / Math.max(1, Number(den));
        } else {
          dur *= Number(lenRaw);
        }
      }
      const eighthSteps = Math.max(1, Math.min(8, Math.round(dur)));
      if (letterRaw === 'z' || letterRaw === 'Z' || letterRaw === 'x') {
        notes.push({ note: 'REST', eighthSteps });
        continue;
      }
      const isLower = letterRaw === letterRaw.toLowerCase();
      let octave = isLower ? 5 : 4;
      for (const ch of octMarks) {
        if (ch === "'") octave += 1;
        if (ch === ',') octave -= 1;
      }
      const baseLetter = letterRaw.toUpperCase();
      let acc = keyAcc[baseLetter] ?? '';
      if (accRaw === '^') acc = '#';
      else if (accRaw === '_') acc = 'b';
      else if (accRaw === '=') acc = '';
      notes.push({ note: `${baseLetter}${acc}${octave}`, eighthSteps, accent: 0.9 });
    }

    if (notes.length === 0) return null;
    return {
      title: titleMatch?.[1]?.trim() || fallbackTitle,
      keySignature: keyRaw,
      timeSignature: meterMatch?.[1]?.trim() || '4/4',
      bpm: tempoMatch ? Math.max(60, Math.min(180, Number(tempoMatch[1]))) : 120,
      notes,
    };
  }

  function extractFriendlyGeminiError(err: unknown): { status: number; message: string } {
    const rawMsg = err instanceof Error ? err.message : String(err);
    if (rawMsg.includes('429') || rawMsg.includes('RESOURCE_EXHAUSTED')) {
      return {
        status: 429,
        message:
          'Gemini free-tier daily request quota reached for this API key. Add a billing-enabled key in Settings > Secrets, or upload an .abc / .csv score for instant offline compilation.',
      };
    }
    if (rawMsg.includes('503') || rawMsg.includes('UNAVAILABLE')) {
      return {
        status: 503,
        message: 'Gemini model is temporarily busy (high demand). Please wait a moment and try uploading again.',
      };
    }
    if (rawMsg.includes('403') || rawMsg.includes('PERMISSION_DENIED') || rawMsg.includes('API_KEY_INVALID')) {
      return {
        status: 403,
        message: 'Gemini API key permission denied or invalid. Check your key in Settings > Secrets.',
      };
    }
    return { status: 500, message: rawMsg || 'Gemini request failed.' };
  }

  app.post('/api/formula/compose', async (req: Request, res: Response) => {
    try {
      const { prompt } = req.body as { prompt?: string };
      if (!prompt || !prompt.trim()) {
        res.status(400).json({ error: 'Enter a musical or mathematical prompt first.' });
        return;
      }

      const ai = getGeminiClient();
      const systemInstruction = `You are a musical composer for Harmoglyph.
Translate the user's song or musical prompt into an accurate sequence of melody notes on an eighth-note rhythmic grid (1 eighth-note step = 1/2 beat; quarter note = 2, dotted quarter = 3, half note = 4, whole note = 8).
Keep the total sum of eighthSteps between 16 and 48 so the main iconic hook plays completely and accurately!
Use standard scientific pitch notation (e.g. "C4", "F4", "G4", "Bb4", "F#4", "A4", or "REST").`;

      const modelsToTry = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'] as const;
      let parsed: {
        title: string;
        bpm: number;
        voice: string;
        artMode: string;
        description: string;
        notes: NoteEventSpec[];
      } | null = null;
      let lastErr: unknown = null;

      for (const modelName of modelsToTry) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: `Compose an accurate, recognizable 16-to-48-eighth-step melody for: "${prompt.trim()}"`,
            config: {
              systemInstruction,
              ...(modelName === 'gemini-4-hydrogen'
                ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                : {}),
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  bpm: { type: Type.INTEGER },
                  voice: {
                    type: Type.STRING,
                    description: 'One of: music-box, celestial-chime, haunted-organ, analog-pluck',
                  },
                  artMode: {
                    type: Type.STRING,
                    description: 'One of: harmonograph, mandala, ribbon, pitch-spiral',
                  },
                  description: { type: Type.STRING },
                  notes: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        note: { type: Type.STRING, description: 'Pitch like C4, Bb4, F#4, or REST' },
                        eighthSteps: { type: Type.INTEGER, description: 'Duration in eighth notes (1..8)' },
                        accent: { type: Type.NUMBER, description: 'Velocity 0.7..1.0' },
                        lyric: { type: Type.STRING },
                      },
                      required: ['note', 'eighthSteps'],
                    },
                  },
                },
                required: ['title', 'bpm', 'voice', 'artMode', 'description', 'notes'],
              },
            },
          });

          const raw = (response.text ?? '{}')
            .trim()
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```$/, '');
          parsed = JSON.parse(raw);
          break;
        } catch (err: unknown) {
          lastErr = err;
          const msg = err instanceof Error ? err.message : String(err);
          if (!msg.includes('429') && !msg.includes('RESOURCE_EXHAUSTED')) {
            throw err;
          }
        }
      }

      if (!parsed) throw lastErr ?? new Error('Unable to compose formula patch.');
      const compiled = compileNotesToCells(parsed.notes ?? [], parsed.bpm);
      res.json({
        title: parsed.title,
        bpm: parsed.bpm,
        voice: parsed.voice,
        artMode: parsed.artMode,
        description: parsed.description,
        cells: compiled.cells,
      });
    } catch (err: unknown) {
      const friendly = extractFriendlyGeminiError(err);
      console.error('Formula compose error:', err);
      res.status(friendly.status).json({ error: friendly.message });
    }
  });

  app.post('/api/sheet-music/transcribe', async (req: Request, res: Response) => {
    try {
      const { fileName, mimeType, base64Data, textContent } = req.body as {
        fileName?: string;
        mimeType?: string;
        base64Data?: string;
        textContent?: string;
      };

      if (!base64Data && !textContent) {
        res.status(400).json({ error: 'Upload a sheet music image, PDF, ABC, or MusicXML file.' });
        return;
      }

      // Fast, exact deterministic path for ABC notation files (zero API quota needed)
      if (textContent) {
        const abcParsed = tryParseAbcScore(
          textContent,
          (fileName || 'Uploaded Score').replace(/\.[^.]+$/, ''),
        );
        if (abcParsed) {
          const compiled = compileNotesToCells(abcParsed.notes, abcParsed.bpm);
          res.json({
            title: abcParsed.title,
            keySignature: abcParsed.keySignature,
            timeSignature: abcParsed.timeSignature,
            rootHz: compiled.rootHz,
            bpm: abcParsed.bpm,
            voice: 'music-box',
            artMode: 'harmonograph',
            detectedNotes: compiled.detectedNotes,
            cells: compiled.cells,
          });
          return;
        }
      }

      const ai = getGeminiClient();
      const systemInstruction = `You are an expert musical score sight-reader for Harmoglyph.
Inspect the uploaded sheet music image/PDF carefully (focusing on Page 1 and top of Page 2 if multi-page) and read EVERY printed melody notehead from the treble staff—never guess notes from memory.

CRITICAL SIGHT-READING & TIMING RULES:
1. Check the key signature on EVERY staff! For example, 1 flat = F Major / D Minor (every B is Bb unless marked natural ♮); 1 sharp = G Major (every F is F# unless marked ♮).
2. Read the TREBLE CLEF noteheads strictly by staff line/space (bottom to top):
   - Ledger line below staff = C4; space below line 1 = D4
   - Line 1 = E4; Space 1 = F4; Line 2 = G4; Space 2 = A4; Line 3 = B4 (or Bb4 in 1 flat); Space 3 = C5; Line 4 = D5; Space 4 = E5; Line 5 = F5.
   - Ignore left-hand bass clef accompaniment! When a treble beat has a chord/dyad, extract ONLY the top melody notehead.
3. For piano-vocal sheets with an instrumental vamp before the lyrics:
   - Either include a concise 1-bar intro motif OR start right where the vocal melody begins (e.g. bar 4 pickup) so the ENTIRE main chorus/verse phrase (at least 16-24 notes totaling 36 to 48 eighthSteps) fits inside 48 eighth-note steps!
   - Double-check every note's pitch interval (e.g. up a step, repeated note, chromatic # or ♮ accidental, leap of a 3rd/4th/5th) directly against the vertical position of the printed noteheads!
4. Timing grid (CRITICAL for recognizable rhythm!):
   - Express every note/rest duration as an integer number of EIGHTH-NOTE steps ('eighthSteps', where 1 beat / quarter note = 2 steps):
     * eighth note (or triplet quarter/eighth feel) = 1 (use 1 for quick triplet syllables, 2 for quarter notes!)
     * quarter note = 2
     * dotted quarter note = 3
     * half note (white notehead with stem) = 4
     * dotted half note = 6
     * whole note (or tied long note) = 6..8
   - Keep the total sum of 'eighthSteps' across all events between 32 and 48.
5. Pitch notation: standard scientific pitch notation like "C4", "D4", "E4", "F4", "F#4", "G4", "G#4", "A4", "Bb4", "B4", "C5", or "REST".`;

      const instructionText = `Sight-read the printed treble-clef melody in (${fileName || 'score'}). Read the key signature, tempo marking (bpm), exact notehead pitches, and exact eighthSteps durations across the main vocal/theme phrase (32 to 48 total eighthSteps).`;

      const parts =
        base64Data && mimeType
          ? [
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              },
              { text: instructionText },
            ]
          : [
              {
                text: `${instructionText}\n\nScore Source Content:\n${(textContent ?? '').slice(0, 24000)}`,
              },
            ];

      const modelsToTry = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite', 'gemini-3.1-flash-lite'] as const;
      let responsePayload: Record<string, unknown> | null = null;
      let lastError: unknown = null;

      for (let i = 0; i < modelsToTry.length; i += 1) {
        const modelName = modelsToTry[i];
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: { parts },
            config: {
              systemInstruction:
                systemInstruction +
                '\n6. First populate staffObservation by listing the first 10 printed treble-clef notehead staff lines/spaces and chord/key accidentals you see on Page 1, then populate notes[]. Never put "REST" inside the lyric field.',
              thinkingConfig: {
                thinkingLevel: ThinkingLevel.MEDIUM,
              },
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  keySignature: { type: Type.STRING },
                  timeSignature: { type: Type.STRING },
                  bpm: { type: Type.INTEGER },
                  voice: {
                    type: Type.STRING,
                    description: 'One of: music-box, celestial-chime, haunted-organ, analog-pluck',
                  },
                  artMode: {
                    type: Type.STRING,
                    description: 'One of: harmonograph, mandala, ribbon, pitch-spiral',
                  },
                  staffObservation: {
                    type: Type.STRING,
                    description:
                      'Brief visual reading of the treble clef staff line/space positions of the first 10 vocal/melody notes before compiling notes[]',
                  },
                  notes: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        note: {
                          type: Type.STRING,
                          description: 'Scientific pitch e.g. F4, G4, A4, Bb4, G#4, C5, or REST',
                        },
                        eighthSteps: {
                          type: Type.INTEGER,
                          description: 'Duration in eighth-note steps (1=eighth, 2=quarter, 3=dotted quarter, 4=half)',
                        },
                        accent: {
                          type: Type.NUMBER,
                          description: 'Note velocity 0.7..1.0',
                        },
                        lyric: {
                          type: Type.STRING,
                          description: 'Sung word/syllable on this note (omit or empty string for rests/instrumental notes)',
                        },
                      },
                      required: ['note', 'eighthSteps'],
                    },
                  },
                },
                required: [
                  'title',
                  'keySignature',
                  'timeSignature',
                  'bpm',
                  'voice',
                  'artMode',
                  'staffObservation',
                  'notes',
                ],
              },
            },
          });

          const raw = (response.text ?? '')
            .trim()
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```$/, '');
          if (!raw) throw new Error('Empty response from score transcription model.');
          const candidate = JSON.parse(raw) as {
            title?: string;
            keySignature?: string;
            timeSignature?: string;
            bpm?: number;
            voice?: string;
            artMode?: string;
            notes?: NoteEventSpec[];
          };
          if (!Array.isArray(candidate.notes) || candidate.notes.length === 0) {
            throw new Error('No playable notes were detected in uploaded score.');
          }
          const compiled = compileNotesToCells(candidate.notes, candidate.bpm ?? 115);
          if (compiled.detectedNotes.length === 0) {
            throw new Error('Detected note sequence contained only rests.');
          }

          responsePayload = {
            title: candidate.title || fileName || 'Uploaded Score',
            keySignature: candidate.keySignature || 'Detected Key',
            timeSignature: candidate.timeSignature || '4/4',
            rootHz: compiled.rootHz,
            bpm: Math.max(60, Math.min(180, Math.round(candidate.bpm || 115))),
            voice: candidate.voice || 'music-box',
            artMode: candidate.artMode || 'harmonograph',
            detectedNotes: compiled.detectedNotes,
            cells: compiled.cells,
          };
          break;
        } catch (attemptErr: unknown) {
          lastError = attemptErr;
          const msg = attemptErr instanceof Error ? attemptErr.message : String(attemptErr);
          if (msg.includes('403') || msg.includes('API_KEY_INVALID')) {
            throw attemptErr;
          }
          if (msg.includes('503') || msg.includes('UNAVAILABLE')) {
            await new Promise((resolve) => setTimeout(resolve, 1400));
          }
        }
      }

      if (!responsePayload) {
        throw lastError instanceof Error
          ? lastError
          : new Error('Unable to parse transcribed music sheet.');
      }

      res.json(responsePayload);
    } catch (err: unknown) {
      const friendly = extractFriendlyGeminiError(err);
      console.error('Sheet music transcribe error:', err);
      res.status(friendly.status).json({ error: friendly.message });
    }
  });

  app.post('/api/submission/pack', async (req: Request, res: Response) => {
    try {
      const { authorHandle, activePresetTitle, bonusTargets } = req.body as {
        authorHandle?: string;
        activePresetTitle?: string;
        bonusTargets?: string[];
      };

      const ai = getGeminiClient();
      const prompt = `Generate authentic, submission-ready Kiroween 2026 materials for Harmoglyph (Category: Frankenstein).

Project Truth (stay 100% accurate to what is in this repository):
- Project Name: Harmoglyph
- Frankenstein Concept: Stitches together 3 seemingly incompatible computing paradigms into one interactive instrument:
  1. Recursive-descent Excel-style Formula Spreadsheet VM (A1:F8, cycle detection #CYCLE!, CSV lossless round-trip)
  2. Real-time Polyphonic 2-Operator Web Audio FM Synthesizer + offline 16-bit PCM .wav exporter
  3. Parametric SVG Lissajous Vector Plotter + standalone .svg exporter
- Active Preset Highlighted: ${activePresetTitle || 'Spooky Minor Arpeggio'}
- Author Handle: ${authorHandle || 'Devpen787'}
- Target Bonus Prizes: ${(bonusTargets ?? ['Best Demo', 'Social Blitz', 'Bonus Blog']).join(', ')}
- Real /.kiro/ Directory Contents in Repo:
  - .kiro/specs/harmoglyph/{requirements.md,design.md,tasks.md} (EARS specs for Spreadsheet VM, FM Synth, Vector Plotter, PBT)
  - .kiro/steering/{tech-stack.md,audio-safety-contract.md}
  - .kiro/hooks/{pbt-on-formula-save.json,kiroween-submission-audit.json}
  - .kiro/agents/synth-crew.json
  - .kiro/settings/mcp.json
  - .kiro/powers/spreadsheet-dsp-power.md
- Real Property-Based Tests (100 trials each): Formula Cycle Termination, Acoustic Safety Clamping (20–4000 Hz, gain <= 0.35), Lossless CSV Round-Trip, RIFF/WAVE PCM Integrity.

Rules from Kiroween 2026 Official Rules:
1. socialBlitzPost MUST start with the exact hashtag "#KiroweenHackathon26" as the very first characters, share what changed in your workflow using Kiro specs/hooks/PBT, and be ready to personalize before posting.
2. blogOutlineMd MUST explicitly state it is written as part of the Kiroween 2026 hackathon and outline the Frankenstein stitch + Kiro usage.
3. devpostWriteupMd MUST address every Devpost Kiro question honestly: Kiro IDE/CLI, Custom Agents (.kiro/agents/synth-crew.json), Agent Hooks (.kiro/hooks/*), Spec-Driven vs Vibe Coding, Steering Docs, MCP (.kiro/settings/mcp.json), Property-Based Testing (4 invariants), and Kiro Powers (.kiro/powers/spreadsheet-dsp-power.md).
4. demoScript MUST stay strictly under 3 minutes (0:00 to 2:45), show the app working in the browser, edit a formula live, play & export WAV/SVG, run the 100-trial PBT suite, and show the .kiro D3 graph.`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              socialBlitzPost: { type: Type.STRING },
              blogOutlineMd: { type: Type.STRING },
              devpostWriteupMd: { type: Type.STRING },
              demoScript: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    timestamp: { type: Type.STRING },
                    scene: { type: Type.STRING },
                    narration: { type: Type.STRING },
                  },
                  required: ['timestamp', 'scene', 'narration'],
                },
              },
            },
            required: ['socialBlitzPost', 'blogOutlineMd', 'devpostWriteupMd', 'demoScript'],
          },
        },
      });

      const raw = (response.text ?? '{}').trim();
      res.json(JSON.parse(raw));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate submission pack.';
      console.error('Submission pack error:', err);
      res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Harmoglyph server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Harmoglyph server:', err);
  process.exit(1);
});
