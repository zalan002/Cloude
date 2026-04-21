-- ============================================================
-- CONSORTIO - Merge Duplicate Projects
-- Date: 2026-04-21
-- ============================================================
-- After switching from DJB2 to FNV-1a hash, duplicate projects
-- were created with the same name but different minicrm_id/id.
-- This script merges them: moves all time_entries to the older
-- project and removes the duplicate.
--
-- Run this in: Supabase Dashboard > SQL Editor > New Query
-- ============================================================


-- ============================================================
-- STEP 1: DRY RUN - Review duplicates before changing anything
-- ============================================================
-- Run this SELECT first to see what will be merged.
-- Do NOT proceed to Step 2 until you've reviewed the output.

SELECT
  d.name AS project_name,
  d.keeper_id,
  d.duplicate_id,
  d.keeper_minicrm_id,
  d.duplicate_minicrm_id,
  d.keeper_source,
  d.duplicate_source,
  COALESCE(k_entries.cnt, 0) AS keeper_time_entries,
  COALESCE(d_entries.cnt, 0) AS duplicate_time_entries,
  COALESCE(k_entries.cnt, 0) + COALESCE(d_entries.cnt, 0) AS total_entries
FROM (
  SELECT
    p1.name,
    -- Keep the older row (lower id = created first)
    LEAST(p1.id, p2.id) AS keeper_id,
    GREATEST(p1.id, p2.id) AS duplicate_id,
    CASE WHEN p1.id < p2.id THEN p1.minicrm_id ELSE p2.minicrm_id END AS keeper_minicrm_id,
    CASE WHEN p1.id < p2.id THEN p2.minicrm_id ELSE p1.minicrm_id END AS duplicate_minicrm_id,
    CASE WHEN p1.id < p2.id THEN p1.source ELSE p2.source END AS keeper_source,
    CASE WHEN p1.id < p2.id THEN p2.source ELSE p1.source END AS duplicate_source
  FROM minicrm_projects p1
  JOIN minicrm_projects p2
    ON LOWER(TRIM(p1.name)) = LOWER(TRIM(p2.name))
    AND p1.id < p2.id
  WHERE p1.status = 'active'
    AND p2.status = 'active'
) d
LEFT JOIN (
  SELECT project_id, count(*) AS cnt FROM time_entries GROUP BY project_id
) k_entries ON k_entries.project_id = d.keeper_id
LEFT JOIN (
  SELECT project_id, count(*) AS cnt FROM time_entries GROUP BY project_id
) d_entries ON d_entries.project_id = d.duplicate_id
ORDER BY d.name;


-- ============================================================
-- STEP 2: MERGE - Run this AFTER reviewing Step 1
-- ============================================================
-- This moves all time_entries from duplicate to keeper,
-- then archives the duplicate project.
-- Everything is wrapped in a transaction for safety.

BEGIN;

-- 2a. Log the merge operation to activity_logs for audit trail
INSERT INTO activity_logs (event_type, user_id, user_email, target_table, details)
SELECT
  'admin.project_merge',
  NULL,
  NULL,
  'minicrm_projects',
  jsonb_build_object(
    'action', 'merge_duplicates',
    'project_name', d.name,
    'keeper_id', d.keeper_id,
    'duplicate_id', d.duplicate_id,
    'keeper_minicrm_id', d.keeper_minicrm_id,
    'duplicate_minicrm_id', d.duplicate_minicrm_id,
    'entries_moved', COALESCE(d_entries.cnt, 0)
  )
FROM (
  SELECT
    p1.name,
    LEAST(p1.id, p2.id) AS keeper_id,
    GREATEST(p1.id, p2.id) AS duplicate_id,
    CASE WHEN p1.id < p2.id THEN p1.minicrm_id ELSE p2.minicrm_id END AS keeper_minicrm_id,
    CASE WHEN p1.id < p2.id THEN p2.minicrm_id ELSE p1.minicrm_id END AS duplicate_minicrm_id
  FROM minicrm_projects p1
  JOIN minicrm_projects p2
    ON LOWER(TRIM(p1.name)) = LOWER(TRIM(p2.name))
    AND p1.id < p2.id
  WHERE p1.status = 'active'
    AND p2.status = 'active'
) d
LEFT JOIN (
  SELECT project_id, count(*) AS cnt FROM time_entries GROUP BY project_id
) d_entries ON d_entries.project_id = d.duplicate_id;

-- 2b. Move all time_entries from duplicate projects to keeper projects
UPDATE time_entries te
SET project_id = merge_map.keeper_id
FROM (
  SELECT
    LEAST(p1.id, p2.id) AS keeper_id,
    GREATEST(p1.id, p2.id) AS duplicate_id
  FROM minicrm_projects p1
  JOIN minicrm_projects p2
    ON LOWER(TRIM(p1.name)) = LOWER(TRIM(p2.name))
    AND p1.id < p2.id
  WHERE p1.status = 'active'
    AND p2.status = 'active'
) merge_map
WHERE te.project_id = merge_map.duplicate_id;

-- 2c. Archive duplicate projects (not delete - keep for safety)
UPDATE minicrm_projects
SET status = 'archived'
WHERE id IN (
  SELECT GREATEST(p1.id, p2.id)
  FROM minicrm_projects p1
  JOIN minicrm_projects p2
    ON LOWER(TRIM(p1.name)) = LOWER(TRIM(p2.name))
    AND p1.id < p2.id
  WHERE p1.status = 'active'
    AND p2.status = 'active'
);

COMMIT;


-- ============================================================
-- STEP 3: VERIFY - Run after Step 2 to confirm success
-- ============================================================

-- 3a. No more active duplicates should exist
SELECT name, count(*) AS cnt
FROM minicrm_projects
WHERE status = 'active'
GROUP BY LOWER(TRIM(name))
HAVING count(*) > 1;
-- Expected: 0 rows

-- 3b. Check the merge log entries
SELECT details->>'project_name' AS project,
       details->>'entries_moved' AS entries_moved,
       created_at
FROM activity_logs
WHERE event_type = 'admin.project_merge'
ORDER BY created_at DESC;

-- 3c. Verify no orphaned time entries exist
SELECT te.id, te.project_id
FROM time_entries te
LEFT JOIN minicrm_projects mp ON mp.id = te.project_id
WHERE mp.id IS NULL;
-- Expected: 0 rows
