import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = { title: string; phase: string; blurb: string };

/** Phase-0 placeholder card shown over the map for each not-yet-built module. */
export function ModulePlaceholder({ title, phase, blurb }: Props) {
  return (
    <Card className="max-w-md bg-card/95 shadow-lg backdrop-blur">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>{title}</CardTitle>
          <Badge variant="secondary">{phase}</Badge>
        </div>
        <CardDescription>{blurb}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Coming soon. The foundation — map, PostGIS + pgvector, design system, and evals — is live.
      </CardContent>
    </Card>
  );
}
