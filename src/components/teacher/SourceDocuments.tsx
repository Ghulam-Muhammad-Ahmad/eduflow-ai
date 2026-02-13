import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Upload, FileText, Key, Eye, Trash2 } from "lucide-react";
import { 
  useSourceDocuments, 
  useCreateSourceDocument, 
  useDeleteSourceDocument,
  SourceDocument 
} from "@/hooks/useSourceDocuments";
import { toast } from "sonner";

const SourceDocuments = ({ selectedSource, onSourceSelect }: {
  selectedSource?: string;
  onSourceSelect?: (source: SourceDocument) => void;
}) => {
  const { data: sources, isLoading } = useSourceDocuments();
  const createSource = useCreateSourceDocument();
  const deleteSource = useDeleteSourceDocument();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  type FormDocumentType = "rubric" | "answer_key" | "example_paper" | "reference";
  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    document_type: FormDocumentType;
    file: File | null;
  }>({
    title: "",
    description: "",
    document_type: "rubric",
    file: null,
  });

  const handleSubmit = async () => {
    if (!formData.title.trim() || !formData.file) {
      toast.error("Title and file are required");
      return;
    }

    try {
      await createSource.mutateAsync({
        title: formData.title.trim(),
        description: formData.description || null,
        document_type: formData.document_type,
        file: formData.file,
      });
      toast.success("Source document uploaded successfully");
      setDialogOpen(false);
      resetForm();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to upload source document");
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      document_type: "rubric",
      file: null,
    });
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this source document?")) {
      try {
        await deleteSource.mutateAsync(id);
        toast.success("Source document deleted successfully");
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Failed to delete source document");
      }
    }
  };

  const getDocumentIcon = (type: string) => {
    switch (type) {
      case "rubric":
        return <FileText className="h-4 w-4" />;
      case "answer_key":
        return <Key className="h-4 w-4" />;
      case "example_paper":
        return <Eye className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getDocumentTypeLabel = (type: string) => {
    switch (type) {
      case "rubric":
        return "Rubric";
      case "answer_key":
        return "Answer Key";
      case "example_paper":
        return "Example Paper";
      case "reference":
        return "Reference";
      default:
        return "Document";
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const currentSource = sources?.find(s => s.id === selectedSource);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Source Documents</h3>
          <p className="text-sm text-muted-foreground">
            Upload rubrics, answer keys, and reference materials
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Upload Source
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Upload Source Document</DialogTitle>
              <DialogDescription>
                Add a rubric, answer key, or reference material for grading
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              <div>
                <Label>Title</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Essay Rubric v2.0"
                />
              </div>

              <div>
                <Label>Type</Label>
                <Select 
                  value={formData.document_type} 
                  onValueChange={(value: FormDocumentType) => setFormData(prev => ({ ...prev, document_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rubric">Rubric</SelectItem>
                    <SelectItem value="answer_key">Answer Key</SelectItem>
                    <SelectItem value="example_paper">Example Paper</SelectItem>
                    <SelectItem value="reference">Reference Material</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Description (optional)</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  placeholder="Describe when to use this document..."
                />
              </div>

              <div>
                <Label>File</Label>
                <Input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    file: e.target.files?.[0] || null 
                  }))}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={createSource.isPending || !formData.title.trim() || !formData.file}
                >
                  {createSource.isPending ? "Uploading..." : "Upload"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <Card className="p-4 text-center text-muted-foreground">
          Loading source documents...
        </Card>
      ) : !sources || sources.length === 0 ? (
        <Card className="p-8 text-center">
          <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No source documents yet</h3>
          <p className="text-muted-foreground mb-4">
            Upload rubrics and reference materials to improve grading consistency
          </p>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Upload First Document
          </Button>
        </Card>
      ) : (
        <div className="grid gap-2">
          {sources.map((source) => (
            <Card
              key={source.id}
              className={`p-4 cursor-pointer transition-colors hover:bg-muted/50 ${
                selectedSource === source.id ? "ring-2 ring-primary" : ""
              }`}
              onClick={() => onSourceSelect?.(source)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {getDocumentIcon(source.document_type)}
                    <h4 className="font-medium">{source.title}</h4>
                    <Badge variant="secondary">
                      {getDocumentTypeLabel(source.document_type)}
                    </Badge>
                  </div>
                  {source.description && (
                    <p className="text-sm text-muted-foreground mb-2">
                      {source.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{formatFileSize(source.file_size)}</span>
                    <span>{source.file_type}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(source.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {currentSource && (
        <Card className="p-4 bg-primary/5 border-primary/20">
          <h4 className="font-medium mb-2">Selected: {currentSource.title}</h4>
          <div className="space-y-2">
            <div className="text-sm">
              <strong>Type:</strong> {getDocumentTypeLabel(currentSource.document_type)}
            </div>
            <div className="text-sm">
              <strong>File:</strong> {currentSource.file_path.split('/').pop()}
            </div>
            {currentSource.description && (
              <div className="text-sm">
                <strong>Description:</strong> {currentSource.description}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};

export default SourceDocuments;
