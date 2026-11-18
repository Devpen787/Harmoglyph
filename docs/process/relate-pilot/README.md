# Harmoglyph — Relate graph pilot (not production)

**Status:** research/dev-process experiment only. Never runs in the Harmoglyph app or changes source, dependencies, tests, releases, or Kiro configuration.

## Exact inputs and trust levels

- Source: 69 unchecked items from [the existing research review checklist](../../research/RESEARCH_12_13_SYNTHESIS_AND_REVIEW_CHECKLIST.md), as fetched on 18 November 2026; six W0–W5 roadmap gates; the first nine evidence-record placeholders; 12/12 source-inspected GitHub files on main or draft PR3. No files were executed or profiled.
- Graph: **120 nodes, 355 relationships**. IDs for every item and link are deterministic. Link.support is either `source`/`source_roadmap` (explicit in original document), `curated_verified_reference` (code exists but impact is a review hypothesis), `category_based` (grouping convention), or `curated_proposal` (work/evidence relationship to verify). **These are candidate linkages, not proved coverage.**
- Relate installation was blocked in the assistant container by DNS/network restrictions. The graph was constructed and traversed in memory using ordinary JavaScript, **not queried inside the Relate engine**. The official Relate CSV import syntax was checked against [the provider guide](https://relatedb.ai/docs/guides/cypher/import-csv/), but the import and queries below are **not executed or validated with a Relate binary in this session**.

## Optional local Relate replay (isolated clone; not an app dependency)

1. Install the verified-signature Relate CLI only if you decide to test it locally, following [official installation instructions](https://relatedb.ai/docs/get-started/install/); inspect the installer and its permissions. Check `relate --version`. No account or cloud connection is needed.
2. From this directory in a separate checkout, run the following (creates a local untracked graph outside the app's runtime):

```bash
relate --database ./harmoglyph-pilot.rl --load-csv-dir ./import --mode table "LOAD CSV WITH HEADERS FROM 'file:///nodes.csv' AS row MERGE (i:Item {id:row.id}) SET i.kind=row.kind, i.title=row.title, i.status=row.status, i.priority=row.priority, i.link=row.link, i.detail=row.detail RETURN count(i) AS nodes"
relate --database ./harmoglyph-pilot.rl --load-csv-dir ./import --mode table "LOAD CSV WITH HEADERS FROM 'file:///edges.csv' AS row MATCH (a:Item {id:row.source}),(b:Item {id:row.target}) MERGE (a)-[r:LINK {kind:row.kind}]->(b) SET r.support=row.support,r.detail=row.detail RETURN count(r) AS edges"
relate --database ./harmoglyph-pilot.rl --read-only --safe --mode table 'MATCH (n:Item) RETURN count(n) AS nodes'
relate --database ./harmoglyph-pilot.rl --read-only --safe --mode table 'MATCH ()-[r:LINK]->() RETURN count(r) AS edges'
```

3. Run the read-only queries in [`queries.cypher`](./queries.cypher) **one statement at a time**, or adapt for your CLI version. Expected counts: 120 nodes and 355 links. `--read-only` prevents mutations during the questions. Don't start a network server or expose MCP/HTTP to the internet. Delete `harmoglyph-pilot.rl` after evaluation. It is not checked in.

## Local graph-model result (NOT a Relate benchmark)

- Scheduler impact review IDs: **A03, B03, B04, C01, D07, E01, E02, E03, E04, E05, E06, E07, E08, F03, I04**.
- Missing independently verified evidence classes: **EV01, EV02, EV03, EV04, EV05, EV06, EV07, EV08, EV09**. These are *review needs*, not a claim all corresponding artifacts are absent everywhere.
- Roadmap gate check counts (source-derived mappings): W0:12, W1:13, W2:13, W3:14, W4:18, W5:12.
- Coverage caveat: static source references alone don't demonstrate that tests passed or that Kiro hooks fired. More precise semantic links need human review.

## Decision criterion

Adopt Relate *only if a run against the actual CLI* finds important overlooked dependencies or makes review consistently more accurate/easier than the plain [69-item checklist](../../research/RESEARCH_12_13_SYNTHESIS_AND_REVIEW_CHECKLIST.md), without creating a second source of truth. Otherwise keep the checklist/roadmap in GitHub as authority. Don't introduce it as another mandated Kiro gate before Kiroween submission.

## Source docs

- [Review checklist](../../research/RESEARCH_12_13_SYNTHESIS_AND_REVIEW_CHECKLIST.md)
- [Winner-grade roadmap](../../KIROWEEN_2026_WINNER_GRADE_ROADMAP.md)
- [Relate official CSV import](https://relatedb.ai/docs/guides/cypher/import-csv/)
- [Relate CLI flags](https://relatedb.ai/docs/reference/cli/flags/)
