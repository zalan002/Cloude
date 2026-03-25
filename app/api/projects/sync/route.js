import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { sendErrorAlert } from '@/lib/email';

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

// Generate a unique numeric ID from a string (FNV-1a hash, fits in INT4 range)
function hashString(str) {
  const s = str.trim().toLowerCase();
  let h1 = 0x811c9dc5; // FNV offset basis
  let h2 = 0x12345678;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193); // FNV prime
    h2 ^= c * (i + 1);
    h2 = Math.imul(h2, 0x5bd1e995);
  }
  // Combine and keep within safe INT4 range (1,000,000 to 2,147,483,647)
  const combined = Math.abs((h1 ^ h2) | 0);
  return (combined % 2146483647) + 1000000;
}

// Convert a source_id (numeric or alphanumeric) to a stable numeric minicrm_id
function toMiniCrmId(sourceId, name) {
  if (sourceId) {
    const parsed = parseInt(sourceId);
    if (!isNaN(parsed) && parsed > 0) return parsed;
    // Alphanumeric ID: hash it
    return hashString(sourceId);
  }
  return hashString(name);
}

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
  const now = new Date().toISOString();

  // Pre-compute all minicrm_ids and resolve collisions before upserting
  const usedIds = new Set();
  const projectsWithIds = uniqueProjects.map((project) => {
    let minicrm_id = toMiniCrmId(project.source_id, project.name);

    // Resolve hash collisions by incrementing
    let attempts = 0;
    while (usedIds.has(minicrm_id) && attempts < 1000) {
      minicrm_id++;
      attempts++;
      collisions++;
    }
    usedIds.add(minicrm_id);

    return { ...project, minicrm_id };
  });

  for (const project of projectsWithIds) {
    const upsertData = {
      minicrm_id: project.minicrm_id,
      name: project.name,
      category_name: project.category || null,
      source: project.source,
      raw_data: project.raw_data,
      status: 'active',
      last_synced_at: now,
    };

    const { error: upsertError } = await supabase
      .from('minicrm_projects')
      .upsert(upsertData, { onConflict: 'minicrm_id' });

    if (upsertError) {
      console.error(`Upsert error for "${project.name}":`, upsertError.message);
      errors++;
    } else {
      synced++;
    }
  }

  return {
    success: true,
    synced,
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
