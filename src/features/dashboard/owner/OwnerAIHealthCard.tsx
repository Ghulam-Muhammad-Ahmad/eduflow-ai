import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

/**
 * Owner tool: confirm the AI integration actually works.
 *
 * "Run live test" sends a real generation call to every model the app is
 * configured to use and reports which answer — one credit for the whole run,
 * not one per model. "Check configuration" is free and calls no model; it only
 * reports the key status and which configured ids the plan exposes.
 *
 * Response shapes mirror /api/ai/test-models and /api/ai/diagnostics. They are
 * restated here rather than imported so no server module reaches the client
 * bundle.
 */

type ModelTestResult = {
  model: string;
  roles: string[];
  ok: boolean;
  latencyMs: number;
  reply?: string;
  droppedParams?: string[];
  error?: string;
  inCatalog: boolean | null;
};

type ModelTestReport = {
  ok: boolean;
  baseUrl: string;
  testedAt: string;
  results: ModelTestResult[];
  availableModels: string[] | null;
  catalogError?: string;
};

type DiagnosticsReport = {
  keyConfigured: boolean;
  baseUrl: string;
  configuredModels: Record<string, string>;
  availableModels: string[] | null;
  modelsError?: string;
  unknownModels?: string[];
};

/** Roles read better as words than as camelCase keys. */
const ROLE_LABELS: Record<string, string> = {
  general: "General",
  reasoning: "Reasoning",
  structured: "JSON",
  longContext: "Long context",
  fast: "Fast",
};

export default function OwnerAIHealthCard() {
  const [testing, setTesting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [report, setReport] = useState<ModelTestReport | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runTest = async () => {
    setTesting(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/test-models", {
        method: "POST",
        credentials: "same-origin",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const message =
          (data as { error?: string })?.error ??
          (res.status === 402 ? "Insufficient AI credits" : "Failed to test models");
        setError(message);
        toast.error(message);
        return;
      }

      const result = data as ModelTestReport;
      setReport(result);
      setDiagnostics(null);
      const passed = result.results.filter((r) => r.ok).length;
      if (result.ok) {
        toast.success(`All ${result.results.length} models responded`);
      } else {
        toast.error(`${passed} of ${result.results.length} models responded`);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to test models";
      setError(message);
      toast.error(message);
    } finally {
      setTesting(false);
    }
  };

  const runDiagnostics = async () => {
    setChecking(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/diagnostics", { credentials: "same-origin" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = (data as { error?: string })?.error ?? "Failed to read configuration";
        setError(message);
        toast.error(message);
        return;
      }
      setDiagnostics(data as DiagnosticsReport);
      setReport(null);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to read configuration";
      setError(message);
      toast.error(message);
    } finally {
      setChecking(false);
    }
  };

  const busy = testing || checking;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="w-4 h-4 text-primary" />
          AI connection
        </CardTitle>
        <CardDescription>
          Send a real request to every model the app uses and see which ones answer.
          The whole run costs 1 credit, however many models are tested.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={runTest} disabled={busy}>
            {testing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing models…
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Run live test (1 credit)
              </>
            )}
          </Button>
          <Button size="sm" variant="outline" onClick={runDiagnostics} disabled={busy}>
            {checking ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking…
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Check configuration (free)
              </>
            )}
          </Button>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ── Live test results ─────────────────────────────────────── */}
        {report && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {report.ok ? (
                <Badge variant="live" className="bg-green-500">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  All models responding
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <XCircle className="mr-1 h-3 w-3" />
                  {report.results.filter((r) => !r.ok).length} of {report.results.length} failing
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {new Date(report.testedAt).toLocaleString()}
              </span>
            </div>

            <ul className="space-y-2">
              {report.results.map((r) => (
                <li
                  key={r.model}
                  className={`rounded-lg border px-3 py-2.5 ${
                    r.ok ? "border-border" : "border-destructive/40 bg-destructive/5"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {r.ok ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
                    ) : (
                      <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                    )}
                    <code className="text-sm font-medium">{r.model}</code>
                    {r.roles.map((role) => (
                      <Badge key={role} variant="outline" className="text-xs">
                        {ROLE_LABELS[role] ?? role}
                      </Badge>
                    ))}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {r.latencyMs} ms
                    </span>
                  </div>

                  {r.inCatalog === false && (
                    <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                      Not in your plan&apos;s model list — set the matching
                      OPENCODE_MODEL_* variable to an id the plan exposes.
                    </p>
                  )}
                  {r.ok && r.droppedParams && r.droppedParams.length > 0 && (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Works, but the gateway rejected: {r.droppedParams.join(", ")} (retried
                      without them).
                    </p>
                  )}
                  {r.error && (
                    <p className="mt-1.5 break-words text-xs text-destructive">{r.error}</p>
                  )}
                </li>
              ))}
            </ul>

            {report.catalogError && (
              <p className="text-xs text-muted-foreground">
                Model list unavailable: {report.catalogError}
              </p>
            )}
            {report.availableModels && report.availableModels.length > 0 && (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer">
                  {report.availableModels.length} models available on this plan
                </summary>
                <p className="mt-2 break-words font-mono">
                  {report.availableModels.join(", ")}
                </p>
              </details>
            )}
          </div>
        )}

        {/* ── Free configuration check ──────────────────────────────── */}
        {diagnostics && (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              {diagnostics.keyConfigured ? (
                <Badge variant="live" className="bg-green-500">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  API key configured
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <XCircle className="mr-1 h-3 w-3" />
                  No API key
                </Badge>
              )}
              <code className="text-xs text-muted-foreground">{diagnostics.baseUrl}</code>
            </div>

            {diagnostics.unknownModels && diagnostics.unknownModels.length > 0 && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
                <p className="font-medium text-amber-700 dark:text-amber-400">
                  These configured models are not in your plan&apos;s list:
                </p>
                <p className="mt-1 font-mono">{diagnostics.unknownModels.join(", ")}</p>
              </div>
            )}

            <ul className="space-y-1">
              {Object.entries(diagnostics.configuredModels).map(([role, model]) => (
                <li key={role} className="flex items-center gap-2 text-xs">
                  <Badge variant="outline" className="text-xs">
                    {ROLE_LABELS[role] ?? role}
                  </Badge>
                  <code>{model}</code>
                </li>
              ))}
            </ul>

            {diagnostics.modelsError && (
              <p className="text-xs text-destructive">{diagnostics.modelsError}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
