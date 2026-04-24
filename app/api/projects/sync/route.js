import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { sendErrorAlert } from '@/lib/email';
import { hashString, toMiniCrmId } from '@/lib/projectHash';

const CSV_URLS = {
  sales: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTkHbDkXhzaWeR2caj-WyW7F-9ZTgMKzB-acV0jV27LbzAVC-D0dEYjgwGURMkAi8i_PCrDYZrwNmDr/pub?gid=1984680240&single=true&output=csv',
  partners: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTkHbDkXhzaWeR2caj-WyW7F-9ZTgMKzB-acV0jV27LbzAVC-D0dEYjgwGURMkAi8i_PCrDYZrwNmDr/pub?gid=525173797&single=true&output=csv',
};

function getSupabase() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

function parseCSV(text) {
  const lines = text.split('\n');
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    const row = {};
    headers.forEach((header, idx) => {
      row[header.trim()] = (values[idx] || '').trim();
    });
    rows.push(row);
  }
  return { headers: headers.map((h) => h.trim()), rows };
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }
  result.push(current);
  return result;
}

// Columns that should be excluded from name matching (contain IDs, not names)
const ID_LIKE_TERMS = ['id', 'azonosító', 'szám', 'number', 'kód', 'code'];

function isIdLikeColumn(header) {
  const lower = header.toLowerCase();
  return ID_LIKE_TERMS.some((term) => lower.includes(term));
}

function findColumn(headers, candidates, fuzzyTerms, excludeIdLike) {
  for (const candidate of candidates) {
    const found = headers.find(
      (h) => h.toLowerCase() === candidate.toLowerCase()
    );
    if (found) return found;
  }
  if (fuzzyTerms) {
    const fuzzy = headers.find((h) => {
      if (excludeIdLike && isIdLikeColumn(h)) return false;
      return fuzzyTerms.some((term) => h.toLowerCase().includes(term));
    });
    if (fuzzy) return fuzzy;
  }
  return null;
}

function findNameColumn(headers) {
  // First try exact match with known name column names
  const exactCandidates = [
    'Name', 'name', 'Név', 'név',
    'ProjectName', 'Projektnév', 'Projekt neve',
    'Cégnév', 'Cég neve',
    'Kapcsolattartó neve', 'Partner neve', 'Ügyfél neve',
  ];
  const exact = findColumn(headers, exactCandidates, null, false);
  if (exact) return exact;

  // Fuzzy match but exclude ID-like columns (e.g. "Projekt azonosító")
  const fuzzy = findColumn(
    headers,
    [],
    ['név', 'name'],
    true
  );
  if (fuzzy) return fuzzy;

  // Last resort: try broader terms, still excluding ID-like columns
  const broader = findColumn(
    headers,
    ['Cég', 'Kapcsolattartó', 'Partner', 'Ügyfél'],
    ['projekt', 'cég'],
    true
  );
  if (broader) return broader;

  // Absolute fallback: first column that is NOT id-like
  const nonId = headers.find((h) => !isIdLikeColumn(h));
  return nonId || headers[0];
}

function findIdColumn(headers) {
  return findColumn(
    headers,
    ['Id', 'id', 'ID', 'Azonosító', 'azonosító', 'MiniCRM ID', 'ProjectId', 'Projekt ID', 'Projekt azonosító'],
    ['id', 'azonosító'],
    false
  );
}

function findCategoryColumn(headers) {
  return findColumn(
    headers,
    ['Category', 'Kategória', 'kategória', 'CategoryName', 'StatusGroup', 'Státusz', 'Status', 'Típus', 'Type'],
    null,
    false
  );
}

async function fetchCSV(url) {
  const response = await fetch(url, {
    next: { revalidate: 0 },
    headers: { 'Accept': 'text/csv' },
  });

  if (!response.ok) {
    throw new Error(`CSV letöltési hiba: ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  return parseCSV(text);
}

// hashString and toMiniCrmId are imported from @/lib/projectHash

// Core sync logic - used by both manual trigger and cron
export async function syncProjects(supabase) {
  const [salesResult, partnerResult] = await Promise.all([
    fetchCSV(CSV_URLS.sales),
    fetchCSV(CSV_URLS.partners),
  ]);

  const salesRows = salesResult.rows;
  const salesHeaders = salesResult.headers;
  const partnerRows = partnerResult.rows;
  const partnerHeaders = partnerResult.headers;

  // Process sales data
  const salesProjects = [];
  const salesColumnMap = { headers: salesHeaders };
  if (salesRows.length > 0) {
    const nameCol = findNameColumn(salesHeaders);
    const idCol = findIdColumn(salesHeaders);
    const catCol = findCategoryColumn(salesHeaders);
    salesColumnMap.nameCol = nameCol;
    salesColumnMap.idCol = idCol;
    salesColumnMap.catCol = catCol;

    salesRows.forEach((row) => {
      const name = row[nameCol];
      if (!name) return;

      const rawData = {};
      salesHeaders.forEach((h) => {
        if (row[h]) rawData[h] = row[h];
      });

      salesProjects.push({
        name: name.trim(),
        source_id: idCol ? row[idCol] : null,
        category: catCol ? row[catCol] : 'Értékesítés',
        source: 'minicrm_sales',
        raw_data: rawData,
      });
    });
  }

  // Process partner data
  const partnerProjects = [];
  const partnerColumnMap = { headers: partnerHeaders };
  if (partnerRows.length > 0) {
    const nameCol = findNameColumn(partnerHeaders);
    const idCol = findIdColumn(partnerHeaders);
    const catCol = findCategoryColumn(partnerHeaders);
    partnerColumnMap.nameCol = nameCol;
    partnerColumnMap.idCol = idCol;
    partnerColumnMap.catCol = catCol;

    partnerRows.forEach((row) => {
      const name = row[nameCol];
      if (!name) return;

      const rawData = {};
      partnerHeaders.forEach((h) => {
        if (row[h]) rawData[h] = row[h];
      });

      partnerProjects.push({
        name: name.trim(),
        source_id: idCol ? row[idCol] : null,
        category: catCol ? row[catCol] : 'Partner',
        source: 'minicrm_partner',
        raw_data: rawData,
      });
    });
  }

  // Deduplicate: partner data takes priority over sales
  // Key by source_id first, then by name
  const projectMap = new Map();

  salesProjects.forEach((p) => {
    const key = p.source_id
      ? `id:${p.source_id}`
      : `name:${p.name.toLowerCase()}`;
    if (!projectMap.has(key)) {
      projectMap.set(key, p);
    }
  });

  partnerProjects.forEach((p) => {
    const key = p.source_id
      ? `id:${p.source_id}`
      : `name:${p.name.toLowerCase()}`;
    // Partner always overrides sales
    projectMap.set(key, p);
  });

  // Also deduplicate by name across different IDs
  const nameMap = new Map();
  const uniqueProjects = [];
  for (const p of projectMap.values()) {
    const nameKey = p.name.toLowerCase();
    if (!nameMap.has(nameKey)) {
      nameMap.set(nameKey, true);
      uniqueProjects.push(p);
    }
  }

  // Upsert to Supabase - only MiniCRM projects (never touch manual ones)
  let synced = 0;
  let errors = 0;
  let collisions = 0;
  let updated = 0;
  let inserted = 0;
  const now = new Date().toISOString();

  // Load all existing MiniCRM projects ONCE so we can match by name.
  // This prevents duplicates when a project's source_id changes between syncs
  // (e.g. CSV has source_id this time but not next time → new hash ID → new row).
  const { data: existingProjects } = await supabase
    .from('minicrm_projects')
    .select('id, minicrm_id, name, source')
    .in('source', ['minicrm_sales', 'minicrm_partner']);

  const existingByName = new Map();
  (existingProjects || []).forEach((p) => {
    const key = p.name.trim().toLowerCase();
    // If multiple exist (shouldn't happen after merge), keep the one with lowest id
    const current = existingByName.get(key);
    if (!current || p.id < current.id) {
      existingByName.set(key, p);
    }
  });

  // Sort deterministically before computing IDs to ensure stable
  // collision resolution regardless of CSV row order
  uniqueProjects.sort((a, b) => {
    const keyA = a.source_id ? `id:${a.source_id}` : `name:${a.name.toLowerCase()}`;
    const keyB = b.source_id ? `id:${b.source_id}` : `name:${b.name.toLowerCase()}`;
    return keyA.localeCompare(keyB);
  });

  // Pre-compute minicrm_ids only for NEW projects (not already in DB by name).
  // Existing projects keep their original minicrm_id so FK references stay stable.
  const usedIds = new Set();
  (existingProjects || []).forEach((p) => usedIds.add(p.minicrm_id));

  const projectsToProcess = uniqueProjects.map((project) => {
    const nameKey = project.name.trim().toLowerCase();
    const existing = existingByName.get(nameKey);

    if (existing) {
      // Will update existing row - keep its minicrm_id
      return { ...project, minicrm_id: existing.minicrm_id, existing_id: existing.id };
    }

    // New project - compute a fresh minicrm_id with deterministic collision resolution
    const canonicalKey = project.source_id || project.name;
    let minicrm_id = toMiniCrmId(project.source_id, project.name);

    let attempts = 0;
    while (usedIds.has(minicrm_id) && attempts < 1000) {
      attempts++;
      minicrm_id = hashString(canonicalKey + '#collision_' + attempts);
      collisions++;
    }
    usedIds.add(minicrm_id);

    return { ...project, minicrm_id, existing_id: null };
  });

  for (const project of projectsToProcess) {
    const commonData = {
      name: project.name,
      category_name: project.category || null,
      source: project.source,
      raw_data: project.raw_data,
      status: 'active',
      last_synced_at: now,
    };

    if (project.existing_id) {
      // Update existing row by id - keeps minicrm_id stable
      const { error: updateError } = await supabase
        .from('minicrm_projects')
        .update(commonData)
        .eq('id', project.existing_id);

      if (updateError) {
        console.error(`Update error for "${project.name}":`, updateError.message);
        errors++;
      } else {
        synced++;
        updated++;
      }
    } else {
      // Insert new row
      const { error: insertError } = await supabase
        .from('minicrm_projects')
        .insert({ ...commonData, minicrm_id: project.minicrm_id });

      if (insertError) {
        console.error(`Insert error for "${project.name}":`, insertError.message);
        errors++;
      } else {
        synced++;
        inserted++;
      }
    }
  }

  // Log sync completion to activity_logs
  try {
    await supabase.from('activity_logs').insert({
      event_type: 'sync.completed',
      user_id: null,
      user_email: null,
      target_table: 'minicrm_projects',
      details: {
        synced,
        updated,
        inserted,
        errors,
        total_found: uniqueProjects.length,
        sales_count: salesProjects.length,
        partner_count: partnerProjects.length,
        hash_collisions: collisions,
      },
    });
  } catch {
    // Silent fail - logging should not break sync
  }

  return {
    success: true,
    synced,
    updated,
    inserted,
    errors,
    total_found: uniqueProjects.length,
    sales_count: salesProjects.length,
    partner_count: partnerProjects.length,
    duplicates_removed: salesProjects.length + partnerProjects.length - uniqueProjects.length,
    hash_collisions: collisions,
    sales_mapping: salesColumnMap,
    partner_mapping: partnerColumnMap,
  };
}

export async function POST() {
  try {
    const supabase = getSupabase();

    // Check auth
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Nincs bejelentkezve.' },
        { status: 401 }
      );
    }

    // Check admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Csak adminisztrátor érheti el ezt a funkciót.' },
        { status: 403 }
      );
    }

    const result = await syncProjects(supabase);

    // Update last sync timestamp in settings
    await supabase.from('app_settings').upsert(
      { key: 'last_sync_at', value: new Date().toISOString() },
      { onConflict: 'key' }
    );

    return NextResponse.json(result);
  } catch (err) {
    console.error('Sync hiba:', err);
    await sendErrorAlert({
      subject: 'Szinkronizálási hiba',
      message: 'A manuális MiniCRM szinkronizálás hibát dobott.',
      context: err.message,
    });
    return NextResponse.json(
      { error: 'Szinkronizálási hiba: ' + err.message },
      { status: 500 }
    );
  }
}
