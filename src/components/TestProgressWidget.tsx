import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, XCircle, AlertCircle, Loader2, X, Minimize2, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TestJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  total_channels: number;
  tested_channels: number;
  online_count: number;
  offline_count: number;
  error_count: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export const TestProgressWidget = () => {
  const [testJob, setTestJob] = useState<TestJob | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const fetchJobStatus = async () => {
      try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/test-streams-background?action=status`);
        if (response.ok) {
          const data = await response.json();
          if (data.job) {
            setTestJob(data.job);
            // Reset dismissed state if a new job starts
            if (data.job.status === 'running' || data.job.status === 'pending') {
              setDismissed(false);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching job status:', error);
      }
    };

    fetchJobStatus();

    // Poll every 2 seconds
    const interval = setInterval(fetchJobStatus, 2000);

    return () => clearInterval(interval);
  }, []);

  // Don't show if dismissed or no active job
  if (dismissed) return null;
  if (!testJob) return null;
  if (testJob.status !== 'running' && testJob.status !== 'pending') return null;

  const progress = testJob.total_channels > 0 
    ? Math.round((testJob.tested_channels / testJob.total_channels) * 100) 
    : 0;

  if (minimized) {
    return (
      <div 
        className="fixed bottom-4 right-4 z-50 bg-card border border-border rounded-full p-3 shadow-lg cursor-pointer hover:scale-105 transition-transform"
        onClick={() => setMinimized(false)}
      >
        <div className="relative">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="absolute -top-1 -right-1 text-xs bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">
            {progress}%
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 bg-card border border-border rounded-lg shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between bg-secondary/50 px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="font-medium text-sm">Teste em andamento</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => setMinimized(true)}
          >
            <Minimize2 className="h-3 w-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => setDismissed(true)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Progress Bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progresso</span>
            <span className="font-medium">{testJob.tested_channels} / {testJob.total_channels}</span>
          </div>
          <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="flex justify-between text-sm">
          <div className="flex items-center gap-1">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span>{testJob.online_count}</span>
          </div>
          <div className="flex items-center gap-1">
            <XCircle className="h-4 w-4 text-red-500" />
            <span>{testJob.offline_count}</span>
          </div>
          <div className="flex items-center gap-1">
            <AlertCircle className="h-4 w-4 text-yellow-500" />
            <span>{testJob.error_count}</span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          O teste continua mesmo se você navegar para outras páginas
        </p>
      </div>
    </div>
  );
};
