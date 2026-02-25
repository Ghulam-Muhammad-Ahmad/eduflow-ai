"use client";

import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAIStudio } from "@/hooks/useAIStudio";
import type { AIGeneratedContent } from "@/hooks/useAIStudio";
import {
  Pencil,
  RefreshCw,
  FileDown,
  Loader2,
  Eye,
  RotateCcw,
  Plus,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkDirective from "remark-directive";
import { visit } from "unist-util-visit";
import "katex/dist/katex.min.css";
import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { parseRubricJson, type RubricJson, type RubricCriterion, type RubricLevel } from "@/types/rubric";
import { generateRubricPDF } from "@/lib/rubricPdf";
import {
  getSystemTemplate,
  getDefaultSystemTemplate,
  normalizeWorksheetContent,
  type WorksheetContent,
  type WorksheetQuestion,
  type WorksheetQuestionType,
} from "@/types/worksheet";
import { stripMarkdownCodeFence } from "@/lib/utils";
import { WorksheetTemplateLayout } from "@/components/ai/WorksheetTemplateLayout";
import { WorksheetContentRender } from "@/components/ai/WorksheetContentRender";

function urduDirective() {
  return (tree: any) => {
    visit(tree, (node: any) => {
      if (node.type === "containerDirective" && node.name === "urdu") {
        node.data = {
          hName: "div",
          hProperties: { className: "urdu" },
        };
      }
    });
  };
}

interface AIStudioOutputViewProps {
  item: AIGeneratedContent;
  onUpdated?: (updated: AIGeneratedContent) => void;
}

function downloadSmartTutorAsPdf(contentElement: HTMLDivElement | null, title: string) {
  if (!contentElement) return;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 14;
  const pageWidth = (doc as unknown as { getPageWidth: () => number }).getPageWidth();
  const contentWidth = pageWidth - margin * 2;
  const windowWidth = 800;
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59);
  doc.text(title || "Smart Tutor – Adapted Content", margin, 20);
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Exported on ${format(new Date(), "PPpp")}`, margin, 28);
  doc.addPage();
  doc.html(contentElement, {
    x: margin,
    y: margin,
    width: contentWidth,
    windowWidth,
    callback: () => {
      doc.save(`${(title || "smart-tutor").replace(/[^\w\s-]/g, "").slice(0, 40)}-${format(new Date(), "yyyy-MM-dd-HHmm")}.pdf`);
    },
  });
}

const defaultCriterion = (): RubricCriterion => ({
  name: "New criterion",
  max_points: 10,
  levels: [
    { level: "Exemplary", points: 10, description: "" },
    { level: "Proficient", points: 7, description: "" },
    { level: "Developing", points: 4, description: "" },
    { level: "Beginning", points: 0, description: "" },
  ],
});

const defaultLevel = (): RubricLevel => ({
  level: "Level",
  points: 0,
  description: "",
});

export function AIStudioOutputView({ item, onUpdated }: AIStudioOutputViewProps) {
  const {
    updateGeneratedContent,
    smartTutorContent,
    regenerateRubricContent,
    regenerateCriterion,
    regeneratePaper,
    regenerateWorksheet,
    regenerateWorksheetQuestion,
    loading,
    regeneratingCriterionIndex,
    regeneratingWorksheetQuestionIndex,
  } = useAIStudio();
  const { toast } = useToast();
  const renderedContentRef = useRef<HTMLDivElement>(null);
  const worksheetPrintRef = useRef<HTMLDivElement>(null);

  const isWorksheet = item.content_type === "worksheet";
  const isRubric = item.content_type === "rubric";
  const isPaper = item.content_type === "paper";
  const isWorksheetBuilder = item.content_type === "worksheet_builder";

  const contentObj = item.content && typeof item.content === "object" ? item.content as { text?: string; original?: string; rubric?: RubricJson } : {};
  const text = contentObj.text ?? "";
  const rubric = contentObj.rubric ?? (contentObj.text ? parseRubricJson(contentObj.text) : null);
  const metadata = (item.metadata && typeof item.metadata === "object" ? item.metadata : {}) as Record<string, unknown>;
  const assignmentDescription = (metadata.assignmentDescription as string) ?? "";
  const rubricSourceMaterial = (metadata.sourceMaterial as string) ?? "";
  const rubricSourceName = (metadata.sourceName as string) ?? "";

  const [editMode, setEditMode] = useState(false);
  const [editingText, setEditingText] = useState(text);
  const [localRubric, setLocalRubric] = useState<RubricJson | null>(rubric);
  const [regenerateInstructions, setRegenerateInstructions] = useState("");
  const [showRegeneratePanel, setShowRegeneratePanel] = useState(false);
  const [rubricRegenerateInstructions, setRubricRegenerateInstructions] = useState("");
  const [showRubricRegeneratePanel, setShowRubricRegeneratePanel] = useState(false);
  const [paperRegenerateInstructions, setPaperRegenerateInstructions] = useState("");
  const [showPaperRegeneratePanel, setShowPaperRegeneratePanel] = useState(false);

  const [localWorksheet, setLocalWorksheet] = useState<WorksheetContent>(() => {
    if (item.content_type !== "worksheet_builder" || !item.content || typeof item.content !== "object") return { title: "", instructions: "", questions: [] };
    const c = item.content as { worksheet?: WorksheetContent; text?: string };
    return c.worksheet ?? (c.text ? (() => { try { return normalizeWorksheetContent(JSON.parse(c.text ?? "{}")); } catch { return { title: "", instructions: "", questions: [] }; }})() : { title: "", instructions: "", questions: [] });
  });
  const [wbEditMode, setWbEditMode] = useState(false);
  const [wbRegenerateAllPanel, setWbRegenerateAllPanel] = useState(false);
  const [wbRegenerateInstructions, setWbRegenerateInstructions] = useState("");

  useEffect(() => {
    const contentObj = item.content && typeof item.content === "object" ? item.content as { text?: string; rubric?: RubricJson } : {};
    setEditingText(contentObj.text ?? "");
    setLocalRubric(contentObj.rubric ?? (contentObj.text ? parseRubricJson(contentObj.text) : null));
  }, [item.id, item.content]);

  useEffect(() => {
    if (item.content_type !== "worksheet_builder" || !item.content || typeof item.content !== "object") return;
    const c = item.content as { worksheet?: WorksheetContent; text?: string };
    const w = c.worksheet ?? (c.text ? (() => { try { return normalizeWorksheetContent(JSON.parse(c.text ?? "{}")); } catch { return { title: "", instructions: "", questions: [] }; }})() : { title: "", instructions: "", questions: [] });
    setLocalWorksheet(w);
  }, [item.id, item.content, item.content_type]);

  const handleSaveText = async () => {
    const updated = await updateGeneratedContent(item.id, {
      content: { ...contentObj, text: editingText },
    });
    if (updated) onUpdated?.(updated);
    setEditMode(false);
  };

  const handleRegenerateWorksheet = async () => {
    const targetLevel = (metadata.targetLevel as "below_grade" | "at_grade" | "above_grade") ?? "at_grade";
    const subject = (metadata.subject as string) ?? "";
    const gradeLevel = (metadata.gradeLevel as string) ?? "";
    if (!subject || !gradeLevel) {
      toast({
        title: "Cannot regenerate",
        description: "Original subject/grade level missing.",
        variant: "destructive",
      });
      return;
    }
    const instructions = regenerateInstructions.trim() || undefined;
    const response = await smartTutorContent({
      pastedText: text,
      targetLevel,
      subject,
      gradeLevel,
      editInstructions: instructions,
    });
    if (response?.success && response.content) {
      const original = (contentObj.original as string) ?? text;
      const newMeta = { ...metadata };
      if (instructions) newMeta.lastEditInstructions = instructions;
      else delete (newMeta as Record<string, unknown>).lastEditInstructions;
      const refreshed = await updateGeneratedContent(item.id, {
        content: {
          ...contentObj,
          text: response.content,
          original,
        },
        metadata: newMeta,
      });
      if (refreshed) {
        setEditingText(response.content);
        setRegenerateInstructions("");
        setShowRegeneratePanel(false);
        onUpdated?.(refreshed);
        toast({ title: "Regenerated", description: "Content updated." });
      }
    }
  };

  const handleRegenerateRubric = async () => {
    if (!assignmentDescription.trim()) {
      toast({
        title: "Cannot regenerate",
        description: "Assignment description is missing.",
        variant: "destructive",
      });
      return;
    }
    const r = localRubric ?? rubric;
    const currentRubricJson = r ? JSON.stringify(r, null, 2) : undefined;
    const instructions = rubricRegenerateInstructions.trim() || undefined;
    const result = await regenerateRubricContent(assignmentDescription, {
      currentRubric: currentRubricJson,
      editInstructions: instructions,
    }, {
      sourceMaterial: rubricSourceMaterial || undefined,
      sourceName: rubricSourceName || undefined,
    });
    if (result?.success && result.content) {
      const parsed = parseRubricJson(result.content);
      if (parsed) {
        const newMeta = { ...metadata, assignmentDescription };
        if (instructions) (newMeta as Record<string, unknown>).lastEditInstructions = instructions;
        else delete (newMeta as Record<string, unknown>).lastEditInstructions;
        const refreshed = await updateGeneratedContent(
          item.id,
          {
            content: { text: result.content, rubric: parsed },
            metadata: newMeta,
          }
        );
        if (refreshed) {
          setLocalRubric(parsed);
          setRubricRegenerateInstructions("");
          setShowRubricRegeneratePanel(false);
          onUpdated?.(refreshed);
          toast({ title: "Regenerated", description: "Rubric updated." });
        }
      }
    }
  };

  const handleExportWorksheet = () => {
    downloadSmartTutorAsPdf(renderedContentRef.current, item.title);
    toast({ title: "Exported", description: "PDF downloaded." });
  };

  const handleExportRubric = () => {
    const r = editMode ? localRubric : rubric;
    if (!r) return;
    const title = (r.title || item.title || "rubric").replace(/[^\w\s-]/g, "");
    generateRubricPDF(r, `${title.slice(0, 50)}.pdf`);
    toast({ title: "Exported", description: "Rubric saved as PDF." });
  };

  const saveRubricToContent = async () => {
    if (!localRubric) return;
    const updated = await updateGeneratedContent(item.id, {
      content: { ...contentObj, rubric: localRubric, text: JSON.stringify(localRubric) },
    });
    if (updated) onUpdated?.(updated);
    setEditMode(false);
  };

  const updateRubric = (updater: (prev: RubricJson) => RubricJson) => {
    setLocalRubric((prev) => (prev ? updater(prev) : null));
  };
  const updateCriterion = (criterionIndex: number, updater: (prev: RubricCriterion) => RubricCriterion) => {
    updateRubric((prev) => ({
      ...prev,
      criteria: prev.criteria.map((c, i) => (i === criterionIndex ? updater(c) : c)),
    }));
  };
  const updateLevel = (criterionIndex: number, levelIndex: number, updater: (prev: RubricLevel) => RubricLevel) => {
    updateCriterion(criterionIndex, (c) => ({
      ...c,
      levels: c.levels.map((l, i) => (i === levelIndex ? updater(l) : l)),
    }));
  };
  const handleRegenerateCriterion = async (criterionIndex: number) => {
    const r = localRubric ?? rubric;
    if (!r || !assignmentDescription.trim()) return;
    const response = await regenerateCriterion(
      assignmentDescription,
      r,
      criterionIndex,
      {
        sourceMaterial: rubricSourceMaterial || undefined,
        sourceName: rubricSourceName || undefined,
      }
    );
    if (response?.success && response.content) {
      const parsed = parseRubricJson(response.content);
      if (parsed?.criteria?.length) {
        const newCriterion = parsed.criteria[0];
        setLocalRubric((prev) =>
          prev
            ? {
                ...prev,
                criteria: prev.criteria.map((c, i) => (i === criterionIndex ? newCriterion : c)),
              }
            : null
        );
        toast({ title: "Criterion regenerated" });
      }
    }
  };
  const addCriterion = () => {
    setLocalRubric((prev) =>
      prev ? { ...prev, criteria: [...prev.criteria, defaultCriterion()] } : { criteria: [defaultCriterion()] }
    );
  };
  const removeCriterion = (index: number) => {
    setLocalRubric((prev) => {
      if (!prev || prev.criteria.length <= 1) return prev;
      return { ...prev, criteria: prev.criteria.filter((_, i) => i !== index) };
    });
  };
  const addLevel = (criterionIndex: number) => {
    updateCriterion(criterionIndex, (c) => ({ ...c, levels: [...c.levels, defaultLevel()] }));
  };
  const removeLevel = (criterionIndex: number, levelIndex: number) => {
    updateCriterion(criterionIndex, (c) => {
      if (c.levels.length <= 1) return c;
      return { ...c, levels: c.levels.filter((_, i) => i !== levelIndex) };
    });
  };

  if (isWorksheet) {
    const lastInstructions = (metadata.lastEditInstructions as string) || undefined;
    return (
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 className="text-xl font-semibold">{item.title}</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRegeneratePanel((v) => !v)}
              disabled={loading}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Regenerate
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportWorksheet}>
              <FileDown className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {showRegeneratePanel && (
          <div className="mb-4 p-4 rounded-lg border bg-muted/40 space-y-3">
            <Label className="text-sm font-medium">Edit instructions (optional)</Label>
            <p className="text-xs text-muted-foreground">
              Send the current content back to AI with these instructions. Leave blank to re-adapt at the same level only.
            </p>
            <Textarea
              placeholder="e.g. Add more examples, simplify vocabulary further, include a summary at the end"
              value={regenerateInstructions}
              onChange={(e) => setRegenerateInstructions(e.target.value)}
              className="min-h-[80px]"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleRegenerateWorksheet} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Regenerate with instructions
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowRegeneratePanel(false); setRegenerateInstructions(""); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {lastInstructions && (
          <div className="mb-4 px-3 py-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Last regeneration instructions: </span>
            {lastInstructions}
          </div>
        )}

        <div
          ref={renderedContentRef}
          className="prose rounded-lg p-4 reactMarkdownCustom max-w-none dark:prose-invert"
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath, remarkDirective, urduDirective]}
            rehypePlugins={[rehypeKatex]}
          >
            {stripMarkdownCodeFence(text)}
          </ReactMarkdown>
        </div>
      </Card>
    );
  }

  if (isRubric) {
    const r = (editMode ? localRubric : localRubric ?? rubric);
    if (!r) {
      return (
        <Card className="p-6">
          <p className="text-muted-foreground">Unable to display rubric (invalid or missing data).</p>
        </Card>
      );
    }
    return (
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          {editMode ? (
            <div className="flex-1 min-w-0">
              <Label className="text-muted-foreground text-xs">Rubric title</Label>
              <Input
                value={r.title ?? ""}
                onChange={(e) => updateRubric((prev) => ({ ...prev, title: e.target.value || undefined }))}
                placeholder="Assessment Rubric"
                className="text-lg font-semibold mt-1"
              />
            </div>
          ) : (
            <h2 className="text-xl font-semibold">{r.title || "Generated Rubric"}</h2>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {editMode ? (
              <>
                <Button size="sm" variant="outline" onClick={() => setShowRubricRegeneratePanel((v) => !v)} disabled={loading}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Regenerate all
                </Button>
                <Button size="sm" variant="outline" onClick={handleExportRubric}>
                  <FileDown className="h-4 w-4 mr-2" />
                  Export PDF
                </Button>
                <Button size="sm" onClick={saveRubricToContent} disabled={loading}>
                  Save
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setEditMode(false)}>
                  <Eye className="h-4 w-4 mr-2" />
                  Done editing
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowRubricRegeneratePanel((v) => !v)} disabled={loading}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportRubric}>
                  <FileDown className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Total: {r.criteria.length} criteria, {r.criteria.reduce((s, c) => s + c.max_points, 0)} points max
        </p>

        {(metadata.lastEditInstructions as string) && (
          <div className="mb-4 px-3 py-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Last regeneration instructions: </span>
            {String(metadata.lastEditInstructions)}
          </div>
        )}

        {showRubricRegeneratePanel && (
          <div className="mb-4 p-4 rounded-lg border bg-muted/40 space-y-3">
            <Label className="text-sm font-medium">Edit instructions (optional)</Label>
            <p className="text-xs text-muted-foreground">
              Current rubric and assignment will be sent as context. Add instructions to change the rubric (e.g. &quot;Add a criterion for creativity&quot;, &quot;Simplify level descriptions&quot;).
            </p>
            <Textarea
              placeholder="e.g. Add a criterion for presentation, make level descriptions more specific"
              value={rubricRegenerateInstructions}
              onChange={(e) => setRubricRegenerateInstructions(e.target.value)}
              className="min-h-[80px]"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleRegenerateRubric} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Regenerate with instructions
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowRubricRegeneratePanel(false); setRubricRegenerateInstructions(""); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {editMode ? (
          <div className="space-y-6">
            {r.criteria.map((criterion, idx) => (
              <div key={idx} className="border rounded-lg overflow-hidden">
                <div className="bg-muted/60 px-4 py-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <Input
                      value={criterion.name}
                      onChange={(e) => updateCriterion(idx, (c) => ({ ...c, name: e.target.value }))}
                      className="font-medium bg-transparent border-transparent hover:border-input max-w-md"
                    />
                    <span className="text-muted-foreground text-sm shrink-0">max</span>
                    <Input
                      type="number"
                      min={0}
                      value={criterion.max_points}
                      onChange={(e) =>
                        updateCriterion(idx, (c) => ({
                          ...c,
                          max_points: Math.max(0, Number(e.target.value) || 0),
                        }))
                      }
                      className="w-16 h-8 text-sm"
                    />
                    <span className="text-muted-foreground text-sm">pts</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRegenerateCriterion(idx)}
                      disabled={regeneratingCriterionIndex !== null}
                      title="Regenerate this criterion with AI"
                    >
                      {regeneratingCriterionIndex === idx ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RotateCcw className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCriterion(idx)}
                      disabled={r.criteria.length <= 1}
                      title="Remove criterion"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="divide-y">
                  {criterion.levels.map((level, levelIdx) => (
                    <div key={levelIdx} className="px-4 py-3 flex flex-wrap items-start gap-3 gap-y-2">
                      <Input
                        value={level.level}
                        onChange={(e) => updateLevel(idx, levelIdx, (l) => ({ ...l, level: e.target.value }))}
                        className="font-medium w-28 shrink-0"
                      />
                      <Input
                        type="number"
                        min={0}
                        value={level.points}
                        onChange={(e) =>
                          updateLevel(idx, levelIdx, (l) => ({
                            ...l,
                            points: Math.max(0, Number(e.target.value) || 0),
                          }))
                        }
                        className="w-16 shrink-0"
                      />
                      <span className="text-muted-foreground text-sm shrink-0">pts</span>
                      <Textarea
                        value={level.description}
                        onChange={(e) =>
                          updateLevel(idx, levelIdx, (l) => ({ ...l, description: e.target.value }))
                        }
                        placeholder="Description"
                        className="flex-1 min-w-[200px] text-sm resize-y"
                        rows={2}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLevel(idx, levelIdx)}
                        disabled={criterion.levels.length <= 1}
                        title="Remove level"
                        className="text-destructive hover:text-destructive shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-2 border-t bg-muted/30">
                  <Button variant="ghost" size="sm" onClick={() => addLevel(idx)} className="text-muted-foreground">
                    <Plus className="h-4 w-4 mr-1" />
                    Add level
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addCriterion}>
              <Plus className="h-4 w-4 mr-2" />
              Add criterion
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {r.criteria.map((criterion, idx) => (
              <div key={idx} className="border rounded-lg overflow-hidden">
                <div className="bg-muted/60 px-4 py-2 font-medium flex justify-between">
                  <span>{criterion.name}</span>
                  <span className="text-muted-foreground text-sm">{criterion.max_points} pts max</span>
                </div>
                <div className="divide-y">
                  {criterion.levels.map((level, levelIdx) => (
                    <div key={levelIdx} className="px-4 py-3 flex flex-wrap items-start gap-3 gap-y-1">
                      <span className="font-medium shrink-0 w-24">{level.level}</span>
                      <span className="text-muted-foreground shrink-0 w-12">{level.points} pts</span>
                      <span className="text-sm flex-1 min-w-0">{level.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    );
  }

  const handleRegeneratePaper = async () => {
    const refreshed = await regeneratePaper(item.id, {
      editInstructions: paperRegenerateInstructions.trim() || undefined,
    });
    if (refreshed) {
      const newContent = refreshed.content && typeof refreshed.content === "object" ? (refreshed.content as { text?: string }) : {};
      setEditingText(newContent.text ?? "");
      setPaperRegenerateInstructions("");
      setShowPaperRegeneratePanel(false);
      onUpdated?.(refreshed);
    }
  };

  if (isPaper && (text || editingText)) {
    return (
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 className="text-xl font-semibold">{item.title}</h2>
          <div className="flex flex-wrap items-center gap-2">
            {editMode ? (
              <>
                <Button size="sm" onClick={handleSaveText} disabled={loading}>
                  Save
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setEditMode(false)}>
                  <Eye className="h-4 w-4 mr-2" />
                  Done editing
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPaperRegeneratePanel((v) => !v)}
                  disabled={loading}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" onClick={() => downloadSmartTutorAsPdf(renderedContentRef.current, item.title)}>
              <FileDown className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </div>

        {(metadata.lastEditInstructions as string) && (
          <div className="mb-4 px-3 py-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Last regeneration instructions: </span>
            {String(metadata.lastEditInstructions)}
          </div>
        )}

        {showPaperRegeneratePanel && (
          <div className="mb-4 p-4 rounded-lg border bg-muted/40 space-y-3">
            <Label className="text-sm font-medium">Edit instructions (optional)</Label>
            <p className="text-xs text-muted-foreground">
              Regeneration uses the same source (PDF or text) and settings as the original. Add instructions to change the paper (e.g. &quot;Add 2 more MCQs&quot;, &quot;Make Section B harder&quot;).
            </p>
            <Textarea
              placeholder="e.g. Add two more short-answer questions, increase marks for Section C"
              value={paperRegenerateInstructions}
              onChange={(e) => setPaperRegenerateInstructions(e.target.value)}
              className="min-h-[80px]"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleRegeneratePaper} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Regenerate with instructions
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowPaperRegeneratePanel(false);
                  setPaperRegenerateInstructions("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {editMode ? (
          <Textarea
            value={editingText}
            onChange={(e) => setEditingText(e.target.value)}
            className="min-h-[400px] font-mono text-sm"
            placeholder="Paper content (markdown)"
          />
        ) : (
          <div
            ref={renderedContentRef}
            className="prose rounded-lg p-4 reactMarkdownCustom max-w-none dark:prose-invert"
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath, remarkDirective, urduDirective]}
              rehypePlugins={[rehypeKatex]}
            >
              {stripMarkdownCodeFence(editingText)}
            </ReactMarkdown>
          </div>
        )}
      </Card>
    );
  }

  if (isWorksheetBuilder) {
    const wbContentObj = item.content && typeof item.content === "object" ? item.content as { worksheet?: WorksheetContent; text?: string } : {};
    const wbMeta = (item.metadata && typeof item.metadata === "object" ? item.metadata : {}) as Record<string, unknown>;
    const template = getSystemTemplate(wbMeta.templateId as string | undefined) ?? getDefaultSystemTemplate();

    const saveWorksheet = async () => {
      const updated = await updateGeneratedContent(item.id, {
        content: { ...wbContentObj, worksheet: localWorksheet, text: JSON.stringify(localWorksheet) },
      });
      if (updated) { onUpdated?.(updated); setWbEditMode(false); }
    };

    const handleRegenerateAll = async () => {
      const updated = await regenerateWorksheet(item.id, { editInstructions: wbRegenerateInstructions.trim() || undefined });
      const nextWorksheet = updated?.content && typeof updated.content === "object" && (updated.content as { worksheet?: WorksheetContent }).worksheet;
      if (nextWorksheet) {
        setLocalWorksheet(nextWorksheet);
        setWbRegenerateAllPanel(false);
        setWbRegenerateInstructions("");
        if (updated) onUpdated?.(updated);
      }
    };

    const updateQuestion = (index: number, updater: (q: WorksheetQuestion) => WorksheetQuestion) => {
      setLocalWorksheet((prev) => ({
        ...prev,
        questions: prev.questions.map((q, i) => (i === index ? updater(q) : q)),
      }));
    };
    const addQuestion = () => {
      setLocalWorksheet((prev) => ({
        ...prev,
        questions: [...prev.questions, { id: `q-${Date.now()}`, type: "short", question: "" }],
      }));
    };
    const removeQuestion = (index: number) => {
      setLocalWorksheet((prev) => ({ ...prev, questions: prev.questions.filter((_, i) => i !== index) }));
    };
    const setQuestionType = (index: number, type: WorksheetQuestionType) => {
      updateQuestion(index, (q) => ({ ...q, type }));
    };

    return (
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 className="text-xl font-semibold">{localWorksheet.title || item.title}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setWbRegenerateAllPanel((v) => !v)} disabled={loading}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Regenerate all
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <FileDown className="h-4 w-4 mr-2" />
              Print / PDF
            </Button>
            {wbEditMode ? (
              <Button size="sm" onClick={saveWorksheet} disabled={loading}>Save</Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setWbEditMode(true)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
          </div>
        </div>

        {wbRegenerateAllPanel && (
          <div className="mb-4 p-4 rounded-lg border bg-muted/40 space-y-3">
            <Label className="text-sm font-medium">Edit instructions (optional)</Label>
            <Textarea
              placeholder="e.g. Add more MCQ, focus on application"
              value={wbRegenerateInstructions}
              onChange={(e) => setWbRegenerateInstructions(e.target.value)}
              className="min-h-[80px]"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleRegenerateAll} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Regenerate worksheet
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setWbRegenerateAllPanel(false); setWbRegenerateInstructions(""); }}>Cancel</Button>
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            {wbEditMode ? (
              <>
                <div>
                  <Label className="text-xs text-muted-foreground">Title</Label>
                  <Input
                    value={localWorksheet.title}
                    onChange={(e) => setLocalWorksheet((p) => ({ ...p, title: e.target.value }))}
                    className="mt-1 font-semibold"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Instructions</Label>
                  <Textarea
                    value={localWorksheet.instructions}
                    onChange={(e) => setLocalWorksheet((p) => ({ ...p, instructions: e.target.value }))}
                    className="mt-1 min-h-[60px] resize-y"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs text-muted-foreground">Questions</Label>
                    <Button variant="ghost" size="sm" onClick={addQuestion}><Plus className="h-4 w-4 mr-1" /> Add</Button>
                  </div>
                  <div className="space-y-3">
                    {localWorksheet.questions.map((q, idx) => (
                      <div key={q.id} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <select
                            value={q.type}
                            onChange={(e) => setQuestionType(idx, e.target.value as WorksheetQuestionType)}
                            className="text-xs border rounded px-2 py-1 bg-background"
                          >
                            <option value="short">Short</option>
                            <option value="long">Long</option>
                            <option value="mcq">MCQ</option>
                            <option value="true_false">True/False</option>
                            <option value="fill_blank">Fill blank</option>
                          </select>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                const newQ = await regenerateWorksheetQuestion(item.id, idx);
                                if (newQ) setLocalWorksheet((prev) => ({ ...prev, questions: prev.questions.map((q, i) => (i === idx ? newQ : q)) }));
                              }}
                              disabled={regeneratingWorksheetQuestionIndex !== null}
                              title="Regenerate this question"
                            >
                              {regeneratingWorksheetQuestionIndex === idx ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => removeQuestion(idx)} className="text-destructive hover:text-destructive" title="Remove"><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </div>
                        <Input
                          value={q.question}
                          onChange={(e) => updateQuestion(idx, (p) => ({ ...p, question: e.target.value }))}
                          placeholder="Question text"
                          className="text-sm"
                        />
                        {q.type === "mcq" && (
                          <div className="text-xs space-y-1">
                            <Label>Options (one per line)</Label>
                            <Textarea
                              value={(q.options ?? []).join("\n")}
                              onChange={(e) => updateQuestion(idx, (p) => ({ ...p, options: e.target.value.split("\n").filter(Boolean) }))}
                              placeholder="A\nB\nC\nD"
                              rows={3}
                              className="resize-y"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Switch to Edit to change title, instructions, and questions.</p>
            )}
          </div>
          <div ref={worksheetPrintRef} className="rounded-lg border bg-background p-4 worksheet-preview">
            <WorksheetTemplateLayout template={template} title={localWorksheet.title}>
              <WorksheetContentRender data={localWorksheet} templateId={template.id} />
            </WorksheetTemplateLayout>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <p className="text-muted-foreground">Unsupported content type: {item.content_type}</p>
      <pre className="mt-2 text-xs overflow-auto max-h-64 bg-secondary p-3 rounded">
        {typeof item.content === "object" ? JSON.stringify(item.content, null, 2) : String(item.content)}
      </pre>
    </Card>
  );
}
