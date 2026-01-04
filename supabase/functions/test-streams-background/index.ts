import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
      } else {
        return { url, channelId, status: 'offline', statusCode: response.status, responseTime, error: 'Invalid playlist' };
      }
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

// Process a batch of channels and schedule next batch
async function processBatch(supabase: any, jobId: string, offset: number) {
  const BATCH_SIZE = 50; // Process 50 channels per invocation
  
  console.log(`Processing batch at offset ${offset} for job ${jobId}`);
  
  // Get job to check if still running
  const { data: job, error: jobError } = await supabase
    .from('stream_test_jobs')
    .select('*')
    .eq('id', jobId)
    .single();
  
  if (jobError || !job || job.status !== 'running') {
    console.log('Job not running, stopping');
    return;
  }
  
  // Get channels not tested in the last 24 hours
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const { data: channels, error: channelsError } = await supabase
    .from('channels')
    .select('id, stream_url')
    .or(`last_tested_at.is.null,last_tested_at.lt.${twentyFourHoursAgo}`)
    .order('name')
    .range(offset, offset + BATCH_SIZE - 1);
  
  if (channelsError) {
    console.error('Error fetching channels:', channelsError);
    return;
  }
  
  if (!channels || channels.length === 0) {
    // No more channels, mark job as completed
    await supabase
      .from('stream_test_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);
    
    console.log(`Job ${jobId} completed`);
    return;
  }
  
  console.log(`Testing ${channels.length} channels...`);
  
  let online = job.online_count || 0;
  let offline = job.offline_count || 0;
  let errors = job.error_count || 0;
  let tested = job.tested_channels || 0;
  
  // Test in smaller batches of 5 for parallel processing
  const testBatchSize = 5;
  for (let i = 0; i < channels.length; i += testBatchSize) {
    const batch = channels.slice(i, i + testBatchSize) as { id: string; stream_url: string }[];
    
    const results = await Promise.all(
      batch.map(ch => testStream(ch.stream_url, ch.id))
    );
    
    // Update each channel
    for (const result of results) {
      const isOnline = result.status === 'online';
      
      await supabase
        .from('channels')
        .update({
          last_test_status: result.status,
          last_tested_at: new Date().toISOString(),
          active: isOnline
        })
        .eq('id', result.channelId);
      
      tested++;
      if (result.status === 'online') online++;
      else if (result.status === 'offline') offline++;
      else errors++;
    }
  }
  
  // Update job progress
  await supabase
    .from('stream_test_jobs')
    .update({
      tested_channels: tested,
      online_count: online,
      offline_count: offline,
      error_count: errors
    })
    .eq('id', jobId);
  
  console.log(`Progress: ${tested} tested (${online} online, ${offline} offline, ${errors} errors)`);
  
  // Schedule next batch by calling itself
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  
  // Only continue if there are more channels
  if (channels.length === BATCH_SIZE) {
    console.log('Scheduling next batch...');
    
    // Use fetch to call the next batch
    fetch(`${supabaseUrl}/functions/v1/test-streams-background`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'continue', jobId, offset: offset + BATCH_SIZE })
    }).catch(err => console.error('Error scheduling next batch:', err));
  } else {
    // No more channels, mark as completed
    await supabase
      .from('stream_test_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);
    
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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
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
      
      return new Response(
        JSON.stringify({ job }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Handle POST requests
    if (req.method === 'POST') {
      let body: any = {};
      try {
        body = await req.json();
      } catch {
        // No body or invalid JSON
      }
      
      // Continue existing job
      if (body.action === 'continue' && body.jobId) {
        console.log(`Continuing job ${body.jobId} at offset ${body.offset}`);
        
        // Process batch in background
        (globalThis as any).EdgeRuntime?.waitUntil(
          processBatch(supabase, body.jobId, body.offset || 0)
        );
        
        return new Response(
          JSON.stringify({ message: 'Batch processing' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Start new test job
      // Check if there's already a running job
      const { data: runningJob } = await supabase
        .from('stream_test_jobs')
        .select('*')
        .eq('status', 'running')
        .maybeSingle();
      
      if (runningJob) {
        return new Response(
          JSON.stringify({ error: 'A test is already running', job: runningJob }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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
          total_channels: count || 0
        })
        .select()
        .single();
      
      if (createError) {
        throw createError;
      }
      
      console.log(`Created new job ${newJob.id} with ${count} channels to test`);
      
      // Start processing in background
      (globalThis as any).EdgeRuntime?.waitUntil(
        processBatch(supabase, newJob.id, 0)
      );
      
      return new Response(
        JSON.stringify({ message: 'Test started', job: newJob }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
