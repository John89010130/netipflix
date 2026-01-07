import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tv, Film, PlaySquare, TrendingUp, AlertCircle } from 'lucide-react';

interface ClassificationStats {
  total: number;
  byType: {
    TV: number;
    MOVIE: number;
    SERIES: number;
  };
  lowConfidence?: number;
  averageConfidence?: number;
}

interface ClassificationStatsCardProps {
  stats: ClassificationStats | null;
  isLoading?: boolean;
}

export function ClassificationStatsCard({ stats, isLoading }: ClassificationStatsCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Estatísticas de Classificação
          </CardTitle>
          <CardDescription>Carregando estatísticas...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats || stats.total === 0) {
    return null;
  }

  const tvPercentage = Math.round((stats.byType.TV / stats.total) * 100);
  const moviePercentage = Math.round((stats.byType.MOVIE / stats.total) * 100);
  const seriesPercentage = Math.round((stats.byType.SERIES / stats.total) * 100);

  return (
    <Card className="bg-gradient-to-br from-background to-muted/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Estatísticas de Classificação Automática
        </CardTitle>
        <CardDescription>
          {stats.total.toLocaleString()} canais analisados e classificados automaticamente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Grid de estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* TV ao Vivo */}
          <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <div className="p-3 rounded-full bg-blue-500/20">
              <Tv className="h-6 w-6 text-blue-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">TV ao Vivo</p>
              <p className="text-2xl font-bold">{stats.byType.TV.toLocaleString()}</p>
              <Badge variant="outline" className="mt-1 text-xs">
                {tvPercentage}%
              </Badge>
            </div>
          </div>

          {/* Filmes */}
          <div className="flex items-center gap-3 p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <div className="p-3 rounded-full bg-purple-500/20">
              <Film className="h-6 w-6 text-purple-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Filmes</p>
              <p className="text-2xl font-bold">{stats.byType.MOVIE.toLocaleString()}</p>
              <Badge variant="outline" className="mt-1 text-xs">
                {moviePercentage}%
              </Badge>
            </div>
          </div>

          {/* Séries */}
          <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="p-3 rounded-full bg-green-500/20">
              <PlaySquare className="h-6 w-6 text-green-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Séries</p>
              <p className="text-2xl font-bold">{stats.byType.SERIES.toLocaleString()}</p>
              <Badge variant="outline" className="mt-1 text-xs">
                {seriesPercentage}%
              </Badge>
            </div>
          </div>
        </div>

        {/* Barra de progresso visual */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Distribuição de Conteúdo</p>
          <div className="h-4 rounded-full overflow-hidden flex bg-muted">
            {stats.byType.TV > 0 && (
              <div
                className="bg-blue-500 transition-all"
                style={{ width: `${tvPercentage}%` }}
                title={`TV: ${tvPercentage}%`}
              />
            )}
            {stats.byType.MOVIE > 0 && (
              <div
                className="bg-purple-500 transition-all"
                style={{ width: `${moviePercentage}%` }}
                title={`Filmes: ${moviePercentage}%`}
              />
            )}
            {stats.byType.SERIES > 0 && (
              <div
                className="bg-green-500 transition-all"
                style={{ width: `${seriesPercentage}%` }}
                title={`Séries: ${seriesPercentage}%`}
              />
            )}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-blue-500" />
              TV {tvPercentage}%
            </span>
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-purple-500" />
              Filmes {moviePercentage}%
            </span>
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-green-500" />
              Séries {seriesPercentage}%
            </span>
          </div>
        </div>

        {/* Confiança da classificação */}
        {stats.averageConfidence !== undefined && (
          <div className="pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Confiança Média da Classificação</span>
              </div>
              <Badge 
                variant={stats.averageConfidence >= 80 ? "default" : stats.averageConfidence >= 60 ? "secondary" : "destructive"}
              >
                {stats.averageConfidence}%
              </Badge>
            </div>
            {stats.lowConfidence !== undefined && stats.lowConfidence > 0 && (
              <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                <span>
                  {stats.lowConfidence} canais com baixa confiança (&lt;60%) podem precisar de revisão
                </span>
              </div>
            )}
          </div>
        )}

        {/* Dica */}
        <div className="pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground">
            <strong>💡 Dica:</strong> O sistema analisa automaticamente a URL, nome e categoria de cada canal 
            para classificá-lo corretamente. Canais já importados podem ser reclassificados usando a função 
            de reclassificação no banco de dados.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
