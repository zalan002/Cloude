import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

async function miniCRMFetch(endpoint, systemId) {
  const apiKey = process.env.MINICRM_API_KEY;
  const baseUrl = process.env.MINICRM_BASE_URL || 'https://r3.minicrm.hu';

  const auth = Buffer.from(`${systemId}:${apiKey}`).toString('base64');

  const response = await fetch(`${baseUrl}${endpoint}`, {
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(
      `MiniCRM API hiba: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

export async function POST(request) {
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

    const body = await request.json();
    const { categoryId, systemId } = body;

    if (!systemId) {
      return NextResponse.json(
        { error: 'A MiniCRM System ID megadása kötelező.' },
        { status: 400 }
      );
    }

    // If no categoryId, return available categories
    if (!categoryId) {
      try {
        const categories = await miniCRMFetch('/Api/R3/Category', systemId);
        return NextResponse.json({ categories });
      } catch (err) {
        return NextResponse.json(
          { error: 'Nem sikerült lekérni a kategóriákat: ' + err.message },
          { status: 500 }
        );
      }
    }

    // Fetch projects from MiniCRM with pagination
    const allProjects = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      await sleep(1100); // Rate limit: max 60 requests/min

      try {
        const result = await miniCRMFetch(
          `/Api/R3/Project?CategoryId=${categoryId}&Page=${page}`,
          systemId
        );

        if (result && result.Results) {
          const projectIds = Object.values(result.Results);

          if (projectIds.length === 0) {
            hasMore = false;
            break;
          }

          // Fetch each project's details
          for (const projectId of projectIds) {
            await sleep(1100); // Rate limit

            try {
              const projectData = await miniCRMFetch(
                `/Api/R3/Project/${projectId}`,
                systemId
              );
              allProjects.push({
                minicrm_id: projectData.Id || projectId,
                name: projectData.Name || projectData.ProjectName || `Projekt #${projectId}`,
                category_name: projectData.CategoryName || null,
              });
            } catch (err) {
              console.error(`Projekt ${projectId} lekérési hiba:`, err.message);
            }
          }

          page++;
        } else {
          hasMore = false;
        }
      } catch (err) {
        console.error('Projekt lista lekérési hiba:', err.message);
        hasMore = false;
      }
    }

    // Upsert projects to Supabase
    let synced = 0;
    for (const project of allProjects) {
      const { error: upsertError } = await supabase
        .from('minicrm_projects')
        .upsert(
          {
            minicrm_id: project.minicrm_id,
            name: project.name,
            category_name: project.category_name,
            status: 'active',
            last_synced_at: new Date().toISOString(),
          },
          { onConflict: 'minicrm_id' }
        );

      if (!upsertError) synced++;
    }

    return NextResponse.json({
      success: true,
      synced,
      total_found: allProjects.length,
    });
  } catch (err) {
    console.error('Sync hiba:', err);
    return NextResponse.json(
      { error: 'Szinkronizálási hiba: ' + err.message },
      { status: 500 }
    );
  }
}
