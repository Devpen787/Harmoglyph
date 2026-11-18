
-- Use --database ./harmoglyph-pilot.rl --read-only --safe; LIMIT all nonaggregated reads.
-- Q0: Check graph size (expected 120 nodes, 355 links).
MATCH (n:Item) RETURN count(n) AS nodes;

MATCH ()-[r:LINK]->() RETURN count(r) AS edges;

-- Q1: What must be reviewed when changing music scheduling?
MATCH (c:Item {id:'concern:scheduler'})<-[:LINK {kind:'IN_SCOPE'}]-(r:Item {kind:'Check'})
OPTIONAL MATCH (r)-[:LINK {kind:'REVIEW_TARGET'}]->(f:Item)
OPTIONAL MATCH (r)-[:LINK {kind:'REQUIRES_EVIDENCE'}]->(e:Item)
RETURN r.id AS checkId, r.title AS review, collect(DISTINCT f.title) AS files,
       collect(DISTINCT e.id) AS evidenceNeeded
ORDER BY checkId LIMIT 30;

-- Q2: Which Kiroween checks lack independently verified proof?
MATCH (r:Item {kind:'Check'})-[:LINK {kind:'REQUIRES_EVIDENCE'}]->(e:Item {kind:'Evidence'})
WHERE e.status <> 'verified'
RETURN r.id AS checkId, r.priority AS priority, e.id AS evidence,
       e.title AS missingProof
ORDER BY priority, checkId LIMIT 100;

-- Q3: What can we inspect in draft PR3 that relates to scheduler?
MATCH (r:Item {kind:'Check'})-[:LINK {kind:'REVIEW_TARGET'}]->(f:Item)
WHERE f.id CONTAINS 'draft-pr3' AND r.id IN ['E02','E03','E04','B03','B04','D07']
RETURN DISTINCT r.id AS review, f.title AS file, f.status AS sourceState
ORDER BY review LIMIT 30;

-- Q4: Which mapped W0-W5 gates are linked to unchecked review items?
MATCH (r:Item {kind:'Check', status:'unchecked'})-[:LINK {kind:'REVIEWED_IN'}]->(g:Item {kind:'Gate'})
RETURN g.id AS gate, count(DISTINCT r) AS stillUnchecked
ORDER BY gate;
