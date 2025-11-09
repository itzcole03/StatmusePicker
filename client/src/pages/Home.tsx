import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { APP_TITLE } from "@/const";
import { toast } from "sonner";

export default function Home() {
  const [selectedSport, setSelectedSport] = useState<string | undefined>(undefined);
  
  const { data: projectionsWithAnalyses, isLoading, refetch } = trpc.projections.withAnalyses.useQuery();
  const fetchProjections = trpc.projections.fetch.useMutation({
    onSuccess: () => {
      toast.success("Projections fetched successfully");
      refetch();
    },
    onError: () => {
      toast.error("Failed to fetch projections");
    },
  });
  
  const analyzeAll = trpc.projections.analyzeAll.useMutation({
    onSuccess: (data) => {
      toast.success(`Analyzed ${data.analyzed} of ${data.total} projections`);
      refetch();
    },
    onError: () => {
      toast.error("Failed to analyze projections");
    },
  });

  const handleFetchAndAnalyze = async () => {
    await fetchProjections.mutateAsync({ sport: selectedSport as any });
    await analyzeAll.mutateAsync();
  };

  const getRecommendationBadge = (recommendation: string | null) => {
    if (!recommendation) return null;
    
    if (recommendation === 'over') {
      return (
        <Badge className="bg-green-600 text-white hover:bg-green-700">
          <TrendingUp className="w-3 h-3 mr-1" />
          OVER
        </Badge>
      );
    } else if (recommendation === 'under') {
      return (
        <Badge className="bg-red-600 text-white hover:bg-red-700">
          <TrendingDown className="w-3 h-3 mr-1" />
          UNDER
        </Badge>
      );
    } else {
      return (
        <Badge variant="secondary">
          <Minus className="w-3 h-3 mr-1" />
          SKIP
        </Badge>
      );
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 70) return "text-green-500";
    if (score >= 50) return "text-yellow-500";
    return "text-red-500";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container py-6">
          <h1 className="text-3xl font-bold text-foreground">{APP_TITLE}</h1>
          <p className="text-muted-foreground mt-2">
            AI-powered analysis of PrizePicks projections using historical player statistics
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8">
        {/* Controls */}
        <div className="flex flex-wrap gap-4 mb-8">
          <div className="flex gap-2">
            <Button
              onClick={() => setSelectedSport(undefined)}
              variant={selectedSport === undefined ? "default" : "outline"}
            >
              All Sports
            </Button>
            {['NFL', 'NBA', 'MLB', 'NHL', 'CFB'].map((sport) => (
              <Button
                key={sport}
                onClick={() => setSelectedSport(sport)}
                variant={selectedSport === sport ? "default" : "outline"}
              >
                {sport}
              </Button>
            ))}
          </div>
          
          <div className="ml-auto flex gap-2">
            <Button
              onClick={handleFetchAndAnalyze}
              disabled={fetchProjections.isPending || analyzeAll.isPending}
            >
              {(fetchProjections.isPending || analyzeAll.isPending) ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Fetch & Analyze
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Projections Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : !projectionsWithAnalyses || projectionsWithAnalyses.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                No projections available. Click "Fetch & Analyze" to get started.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projectionsWithAnalyses
              .filter(p => !selectedSport || p.sport === selectedSport)
              .map((projection) => (
                <Card key={projection.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{projection.playerName}</CardTitle>
                        <CardDescription>
                          {projection.team} • {projection.sport}
                        </CardDescription>
                      </div>
                      {projection.analysis && getRecommendationBadge(projection.analysis.recommendation)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Stat Type</span>
                        <span className="font-medium">{projection.statType}</span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Line</span>
                        <span className="text-xl font-bold text-primary">{projection.lineScore}</span>
                      </div>

                      {projection.analysis && (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Recent Avg</span>
                            <span className="font-medium">{projection.analysis.recentAverage}</span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Confidence</span>
                            <span className={`font-bold ${getConfidenceColor(projection.analysis.confidenceScore)}`}>
                              {projection.analysis.confidenceScore}%
                            </span>
                          </div>

                          <div className="pt-2 border-t border-border">
                            <p className="text-xs text-muted-foreground">
                              {projection.analysis.reasoning}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        )}
      </main>
    </div>
  );
}
