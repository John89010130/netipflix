import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

interface StreamTestResult {
  url: string;
  channelId: string;
  status: 'online' | 'offline' | 'error';
  statusCode?: number;
  responseTime?: number;
  error?: string;
}

async function testStream(url: string, channelId: string): Promise<StreamTestResult> {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
      },
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    // For m3u8 files, verify the content is actually a valid playlist
    if (url.includes('.m3u8')) {
      if (!response.ok) {
        return { url, channelId, status: 'offline', statusCode: response.status, responseTime };
      }

      const text = await response.text();
      if (text.includes('#EXTM3U') || text.includes('#EXT-X-')) {
        return { url, channelId, status: 'online', statusCode: response.status, responseTime };
      }

      return { url, channelId, status: 'offline', statusCode: response.status, responseTime, error: 'Invalid playlist' };
    }

    // For regular streams
    if (response.ok) {
      const contentType = response.headers.get('content-type') || '';
      const contentLength = response.headers.get('content-length');

      const isVideoContent =
        contentType.includes('video') ||
        contentType.includes('mpegurl') ||
        contentType.includes('octet-stream') ||
        (contentLength && parseInt(contentLength) > 1000);

      if (isVideoContent) {
        return { url, channelId, status: 'online', statusCode: response.status, responseTime };
      }
    }

    return {
      url,
      channelId,
      status: response.ok ? 'online' : 'offline',
      statusCode: response.status,
      responseTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('abort') || errorMessage.includes('timeout')) {
      return { url, channelId, status: 'offline', error: 'Timeout' };
    }

    return { url, channelId, status: 'error', error: errorMessage };
  }
}

function waitUntil(promise: Promise<unknown>) {
  (globalThis as any).EdgeRuntime?.waitUntil?.(promise);
}

async function markJobDone(supabase: any, jobId: string, status: 'completed' | 'failed') {
  const { error } = await supabase
    .from('stream_test_jobs')
    .update({
      status,
      completed_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  if (error) console.error(`Error marking job ${jobId} as ${status}:`, error);
}

// Process a batch of channels and schedule next batch
async function processBatch(supabase: any, jobId: string) {
  // Smaller batch + fewer DB roundtrips => less chance of runtime kill.
  const BATCH_SIZE = 25;
  const testBatchSize = 5;

  console.log(`Processing batch for job ${jobId}`);

  // Get job to check if still running
  const { data: job, error: jobError } = await supabase
    .from('stream_test_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (jobError || !job) {
    console.error('Error fetching job:', jobError);
    await markJobDone(supabase, jobId, 'failed');
    return;
  }

  if (job.status !== 'running') {
    console.log('Job not running, stopping');
    return;
  }

  // Get channels not tested in the last 24 hours
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // IMPORTANT: don't use offset/range on a shrinking set (it can stall/skips).
  // Always take the next N remaining channels.
  const { data: channels, error: channelsError } = await supabase
    .from('channels')
    .select('id, stream_url')
    .or(`last_tested_at.is.null,last_tested_at.lt.${twentyFourHoursAgo}`)
    .order('name')
    .limit(BATCH_SIZE);

  if (channelsError) {
    console.error('Error fetching channels:', channelsError);
    await markJobDone(supabase, jobId, 'failed');
    return;
  }

  if (!channels || channels.length === 0) {
    await markJobDone(supabase, jobId, 'completed');
    console.log(`Job ${jobId} completed (no more channels)`);
    return;
  }

  console.log(`Testing ${channels.length} channels...`);

  let online = job.online_count || 0;
  let offline = job.offline_count || 0;
  let errors = job.error_count || 0;
  let tested = job.tested_channels || 0;

  for (let i = 0; i < channels.length; i += testBatchSize) {
    const batch = channels.slice(i, i + testBatchSize) as { id: string; stream_url: string }[];

    const results = await Promise.all(batch.map((ch) => testStream(ch.stream_url, ch.id)));

    // Update channels in parallel to keep runtime low
    const updates = results.map((result) => {
      const isOnline = result.status === 'online';
      return supabase
        .from('channels')
        .update({
          last_test_status: result.status,
          last_tested_at: new Date().toISOString(),
          active: isOnline,
        })
        .eq('id', result.channelId);
    });

    const updateResults = await Promise.allSettled(updates);
    updateResults.forEach((r, idx) => {
      if (r.status === 'rejected') {
        console.error('Error updating channel:', results[idx]?.channelId, r.reason);
      } else if (r.value?.error) {
        console.error('Error updating channel:', results[idx]?.channelId, r.value.error);
      }
    });

    for (const result of results) {
      tested++;
      if (result.status === 'online') online++;
      else if (result.status === 'offline') offline++;
      else errors++;
    }
  }

  // Update job progress
  const { error: progressError } = await supabase
    .from('stream_test_jobs')
    .update({
      tested_channels: tested,
      online_count: online,
      offline_count: offline,
      error_count: errors,
    })
    .eq('id', jobId);

  if (progressError) {
    console.error('Error updating job progress:', progressError);
    await markJobDone(supabase, jobId, 'failed');
    return;
  }

  console.log(`Progress: ${tested} tested (${online} online, ${offline} offline, ${errors} errors)`);

  // Schedule next batch by calling itself
  if (channels.length === BATCH_SIZE) {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const endpoint = `${supabaseUrl}/functions/v1/test-streams-background`;

    waitUntil(
      (async () => {
        try {
          const body = JSON.stringify({ action: 'continue', jobId });

          for (let attempt = 1; attempt <= 2; attempt++) {
            const resp = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body,
            });

            console.log(`Schedule attempt ${attempt} for job ${jobId}: ${resp.status}`);

            if (resp.ok) return;

            const text = await resp.text().catch(() => '');
            console.error(`Schedule failed (attempt ${attempt}) for job ${jobId}:`, text);

            if (attempt < 2) await new Promise((r) => setTimeout(r, 300));
          }

          await markJobDone(supabase, jobId, 'failed');
        } catch (err) {
          console.error('Error scheduling next batch:', err);
          await markJobDone(supabase, jobId, 'failed');
        }
      })(),
    );
  } else {
    await markJobDone(supabase, jobId, 'completed');
    console.log(`Job ${jobId} completed: ${online} online, ${offline} offline, ${errors} errors`);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // Get current job status
    if (req.method === 'GET' || action === 'status') {
      const { data: job } = await supabase
        .from('stream_test_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return new Response(JSON.stringify({ job }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle POST requests
    if (req.method === 'POST') {
      let body: any = {};
      try {
        body = await req.json();
      } catch {
        // No body or invalid JSON
      }

      // Continue existing job (kick)
      if (body.action === 'continue' && body.jobId) {
        console.log(`Continuing job ${body.jobId}`);

        waitUntil(processBatch(supabase, body.jobId));

        return new Response(JSON.stringify({ message: 'Batch processing' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Start new test job (or resume if one is already running)
      const { data: runningJob } = await supabase
        .from('stream_test_jobs')
        .select('*')
        .eq('status', 'running')
        .maybeSingle();

      if (runningJob) {
        console.log(`Resuming existing job ${runningJob.id}`);
        waitUntil(processBatch(supabase, runningJob.id));

        return new Response(JSON.stringify({ message: 'Resuming existing test', job: runningJob }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Count total channels to test
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from('channels')
        .select('id', { count: 'exact', head: true })
        .or(`last_tested_at.is.null,last_tested_at.lt.${twentyFourHoursAgo}`);

      // Create new job
      const { data: newJob, error: createError } = await supabase
        .from('stream_test_jobs')
        .insert({
          status: 'running',
          started_at: new Date().toISOString(),
          total_channels: count || 0,
        })
        .select()
        .single();

      if (createError) {
        throw createError;
      }

      console.log(`Created new job ${newJob.id} with ${count} channels to test`);

      waitUntil(processBatch(supabase, newJob.id));

      return new Response(JSON.stringify({ message: 'Test started', job: newJob }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
