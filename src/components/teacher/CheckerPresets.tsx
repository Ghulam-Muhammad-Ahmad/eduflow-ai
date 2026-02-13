import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Edit, Trash2, Settings, FileText } from "lucide-react";
import { useCheckerPresets, useCreateCheckerPreset, useUpdateCheckerPreset, useDeleteCheckerPreset, CheckerPreset } from "@/hooks/useCheckerPresets";
import { useTeacherDocuments } from "@/hooks/useTeacherDocuments";
import { toast } from "sonner";

const NO_REF_DOC_VALUE = "__NO_REF_DOC__";

interface RubricCategory {
  name: string;
  max_points: number;
  description: string | null;
}

const CheckerPresets = ({ selectedPreset, onPresetSelect }: {
  selectedPreset?: string;
  onPresetSelect?: (preset: CheckerPreset) => void;
}) => {
  const { data: presets, isLoading } = useCheckerPresets();
  const { data: teacherDocuments } = useTeacherDocuments();
  const createPreset = useCreateCheckerPreset();
  const updatePreset = useUpdateCheckerPreset();
  const deletePreset = useDeleteCheckerPreset();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<CheckerPreset | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    instructions: "",
    reference_document_id: "" as string,
    rubric_categories: [] as RubricCategory[],
    total_points: 100,
    is_default: false,
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      instructions: "",
      reference_document_id: "",
      rubric_categories: [],
      total_points: 100,
      is_default: false,
    });
    setEditingPreset(null);
  };

  const handleEdit = (preset: CheckerPreset) => {
    setEditingPreset(preset);
    setFormData({
      name: preset.name,
      description: preset.description || "",
      instructions: preset.instructions,
      reference_document_id: preset.reference_document_id ?? "",
      rubric_categories: preset.rubric_categories,
      total_points: preset.total_points,
      is_default: preset.is_default,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error("Preset name is required");
      return;
    }

    if (formData.rubric_categories.length === 0) {
      toast.error("At least one rubric category is required");
      return;
    }

    try {
      const payload = {
        ...formData,
        reference_document_id: formData.reference_document_id && formData.reference_document_id !== NO_REF_DOC_VALUE
          ? formData.reference_document_id
          : null,
      };
      if (editingPreset) {
        await updatePreset.mutateAsync({
          id: editingPreset.id,
          ...payload,
        });
        toast.success("Preset updated successfully");
      } else {
        await createPreset.mutateAsync(payload as Omit<CheckerPreset, "id" | "created_at" | "updated_at">);
        toast.success("Preset created successfully");
      }
      
      setDialogOpen(false);
      resetForm();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to save preset");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this preset?")) {
      try {
        await deletePreset.mutateAsync(id);
        toast.success("Preset deleted successfully");
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Failed to delete preset");
      }
    }
  };

  const addCategory = () => {
    setFormData(prev => ({
      ...prev,
      rubric_categories: [...prev.rubric_categories, {
        name: "",
        max_points: 10,
        description: "",
      }],
    }));
  };

  const updateCategory = (index: number, category: Partial<RubricCategory>) => {
    setFormData(prev => ({
      ...prev,
      rubric_categories: prev.rubric_categories.map((cat, i) =>
        i === index ? { ...cat, ...category } : cat
      ),
    }));
  };

  const removeCategory = (index: number) => {
    setFormData(prev => ({
      ...prev,
      rubric_categories: prev.rubric_categories.filter((_, i) => i !== index),
    }));
  };

  const currentPreset = presets?.find(p => p.id === selectedPreset);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Checker Presets</h3>
          <p className="text-sm text-muted-foreground">
            Save and reuse grading configurations
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              New Preset
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingPreset ? "Edit Preset" : "Create New Preset"}
              </DialogTitle>
              <DialogDescription>
                Create a reusable grading configuration with rubric categories and instructions
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Preset Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Essay Rubric"
                  />
                </div>
                <div>
                  <Label>Total Points</Label>
                  <Input
                    type="number"
                    value={formData.total_points}
                    onChange={(e) => setFormData(prev => ({ ...prev, total_points: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              <div>
                <Label>Description (optional)</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  placeholder="Describe when to use this preset"
                />
              </div>

              <div>
                <Label>Instructions for AI</Label>
                <Textarea
                  value={formData.instructions}
                  onChange={(e) => setFormData(prev => ({ ...prev, instructions: e.target.value }))}
                  rows={4}
                  placeholder="Detailed instructions for the AI checker..."
                />
              </div>

              <div>
                <Label>Reference document (optional)</Label>
                <Select
                  value={formData.reference_document_id || NO_REF_DOC_VALUE}
                  onValueChange={(val) => setFormData(prev => ({ ...prev, reference_document_id: val === NO_REF_DOC_VALUE ? "" : val }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No reference document" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_REF_DOC_VALUE}>No reference document</SelectItem>
                    {teacherDocuments?.map((doc) => (
                      <SelectItem key={doc.id} value={doc.id}>
                        <span className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          {doc.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Choose a document from Document Center to use as reference when this preset is used.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Rubric Categories</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addCategory}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Category
                  </Button>
                </div>
                
                <div className="space-y-2">
                  {formData.rubric_categories.map((category, index) => (
                    <Card key={index} className="p-3">
                      <div className="grid grid-cols-3 gap-2">
                        <Input
                          placeholder="Category name"
                          value={category.name}
                          onChange={(e) => updateCategory(index, { name: e.target.value })}
                        />
                        <Input
                          type="number"
                          placeholder="Max points"
                          value={category.max_points}
                          onChange={(e) => updateCategory(index, { max_points: parseInt(e.target.value) || 0 })}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeCategory(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <Input
                        className="mt-2"
                        placeholder="Description (optional)"
                        value={category.description || ""}
                        onChange={(e) => updateCategory(index, { description: e.target.value })}
                      />
                    </Card>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={createPreset.isPending || updatePreset.isPending}
                >
                  {editingPreset ? "Update" : "Create"} Preset
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <Card className="p-4 text-center text-muted-foreground">
          Loading presets...
        </Card>
      ) : !presets || presets.length === 0 ? (
        <Card className="p-8 text-center">
          <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No presets yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first grading preset to save time on repetitive grading tasks
          </p>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create First Preset
          </Button>
        </Card>
      ) : (
        <div className="grid gap-2">
          {presets.map((preset) => (
            <Card
              key={preset.id}
              className={`p-4 cursor-pointer transition-colors hover:bg-muted/50 ${
                selectedPreset === preset.id ? "ring-2 ring-primary" : ""
              }`}
              onClick={() => onPresetSelect?.(preset)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium">{preset.name}</h4>
                    {preset.is_default && <Badge variant="secondary">Default</Badge>}
                  </div>
                  {preset.description && (
                    <p className="text-sm text-muted-foreground mb-2">
                      {preset.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{preset.total_points} points total</span>
                    <span>{preset.rubric_categories.length} categories</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(preset);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(preset.id);
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

      {currentPreset && (
        <Card className="p-4 bg-primary/5 border-primary/20">
          <h4 className="font-medium mb-2">Selected: {currentPreset.name}</h4>
          <div className="space-y-2">
            <div className="text-sm">
              <strong>Total Points:</strong> {currentPreset.total_points}
            </div>
            <div className="text-sm">
              <strong>Categories:</strong>
            </div>
            <ul className="text-sm space-y-1 ml-4">
              {currentPreset.rubric_categories.map((cat, index) => (
                <li key={index}>
                  {cat.name}: {cat.max_points} points
                  {cat.description && ` - ${cat.description}`}
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}
    </div>
  );
};

export default CheckerPresets;
