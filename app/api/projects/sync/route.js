import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

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

  // Parse header
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
  return rows;
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

function findNameColumn(headers) {
  const nameCandidates = [
    'Name', 'name', 'Név', 'név', 'ProjectName', 'Projektnév',
    'Projekt neve', 'Cégnév', 'Cég neve', 'Cég', 'Projekt',
    'Kapcsolattartó', 'Partner', 'Ügyfél',
  ];
  for (const candidate of nameCandidates) {
    const found = headers.find(
      (h) => h.trim().toLowerCase() === candidate.toLowerCase()
    );
    if (found) return found;
  }
  // Fallback: look for any header containing "név" or "name"
  const fuzzy = headers.find(
    (h) =>
      h.toLowerCase().includes('név') ||
      h.toLowerCase().includes('name') ||
      h.toLowerCase().includes('projekt') ||
      h.toLowerCase().includes('cég')
  );
  if (fuzzy) return fuzzy;
  // Last resort: use the first column
  return headers[0];
}

function findIdColumn(headers) {
  const idCandidates = [
    'Id', 'id', 'ID', 'Azonosító', 'azonosító', 'MiniCRM ID',
    'ProjectId', 'Projekt ID',
  ];
  for (const candidate of idCandidates) {
    const found = headers.find(
      (h) => h.trim().toLowerCase() === candidate.toLowerCase()
    );
    if (found) return found;
  }
  const fuzzy = headers.find(
    (h) => h.toLowerCase().includes('id') || h.toLowerCase().includes('azonosító')
  );
  return fuzzy || null;
}

function findCategoryColumn(headers) {
  const candidates = [
    'Category', 'Kategória', 'kategória', 'CategoryName',
    'Státusz', 'Status', 'Típus', 'Type',
  ];
  for (const candidate of candidates) {
    const found = headers.find(
      (h) => h.trim().toLowerCase() === candidate.toLowerCase()
    );
    if (found) return found;
  }
  return null;
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

    // Fetch both CSV sources
    const [salesRows, partnerRows] = await Promise.all([
      fetchCSV(CSV_URLS.sales),
      fetchCSV(CSV_URLS.partners),
    ]);

    // Extract projects from sales data
    const salesProjects = [];
    if (salesRows.length > 0) {
      const headers = Object.keys(salesRows[0]);
      const nameCol = findNameColumn(headers);
      const idCol = findIdColumn(headers);
      const catCol = findCategoryColumn(headers);

      salesRows.forEach((row) => {
        const name = row[nameCol];
        if (name) {
          salesProjects.push({
            name,
            source_id: idCol ? row[idCol] : null,
            category: catCol ? row[catCol] : 'Értékesítés',
            source: 'sales',
          });
        }
      });
    }

    // Extract projects from partner data
    const partnerProjects = [];
    if (partnerRows.length > 0) {
      const headers = Object.keys(partnerRows[0]);
      const nameCol = findNameColumn(headers);
      const idCol = findIdColumn(headers);
      const catCol = findCategoryColumn(headers);

      partnerRows.forEach((row) => {
        const name = row[nameCol];
        if (name) {
          partnerProjects.push({
            name,
            source_id: idCol ? row[idCol] : null,
            category: catCol ? row[catCol] : 'Partner',
            source: 'partner',
          });
        }
      });
    }

    // Deduplicate: partner data takes priority over sales data
    const projectMap = new Map();

    // Add sales first
    salesProjects.forEach((p) => {
      const key = p.name.trim().toLowerCase();
      if (!projectMap.has(key)) {
        projectMap.set(key, p);
      }
    });

    // Then overwrite with partner data (higher priority)
    partnerProjects.forEach((p) => {
      const key = p.name.trim().toLowerCase();
      projectMap.set(key, p);
    });

    const uniqueProjects = Array.from(projectMap.values());

    // Upsert to Supabase
    let synced = 0;
    let errors = 0;

    for (const project of uniqueProjects) {
      const minicrm_id = project.source_id
        ? parseInt(project.source_id) || hashName(project.name)
        : hashName(project.name);

      const { error: upsertError } = await supabase
        .from('minicrm_projects')
        .upsert(
          {
            minicrm_id,
            name: project.name.trim(),
            category_name: project.category || null,
            status: 'active',
            last_synced_at: new Date().toISOString(),
          },
          { onConflict: 'minicrm_id' }
        );

      if (upsertError) {
        // If minicrm_id conflict with different name, try with name match
        const { error: nameError } = await supabase
          .from('minicrm_projects')
          .upsert(
            {
              minicrm_id: minicrm_id + 100000,
              name: project.name.trim(),
              category_name: project.category || null,
              status: 'active',
              last_synced_at: new Date().toISOString(),
            },
            { onConflict: 'minicrm_id' }
          );
        if (!nameError) synced++;
        else errors++;
      } else {
        synced++;
      }
    }

    return NextResponse.json({
      success: true,
      synced,
      errors,
      total_found: uniqueProjects.length,
      sales_count: salesProjects.length,
      partner_count: partnerProjects.length,
      duplicates_removed: salesProjects.length + partnerProjects.length - uniqueProjects.length,
    });
  } catch (err) {
    console.error('Sync hiba:', err);
    return NextResponse.json(
      { error: 'Szinkronizálási hiba: ' + err.message },
      { status: 500 }
    );
  }
}

// Simple hash function for generating a numeric ID from a string
function hashName(name) {
  let hash = 0;
  const str = name.trim().toLowerCase();
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}
