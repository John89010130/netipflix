-- Create table to track stream test jobs
CREATE TABLE public.stream_test_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, running, completed, failed
  total_channels INTEGER NOT NULL DEFAULT 0,
  tested_channels INTEGER NOT NULL DEFAULT 0,
  online_count INTEGER NOT NULL DEFAULT 0,
  offline_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.stream_test_jobs ENABLE ROW LEVEL SECURITY;

-- Admins can manage test jobs
CREATE POLICY "Admins can manage test jobs"
ON public.stream_test_jobs
FOR ALL
USING (is_admin(auth.uid()));

-- Create index on channels for faster queries
CREATE INDEX IF NOT EXISTS idx_channels_active ON public.channels(active);
CREATE INDEX IF NOT EXISTS idx_channels_category ON public.channels(category);
CREATE INDEX IF NOT EXISTS idx_channels_last_test_status ON public.channels(last_test_status);