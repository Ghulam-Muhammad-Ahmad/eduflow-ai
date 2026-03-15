"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings, Percent } from "lucide-react";

export interface ClassroomSettingsForm {
  allowLateSubmissions: boolean;
  latePenaltyPercent: number;
  defaultPointsPossible: number;
  gradingScale: string;
}

const defaultForm: ClassroomSettingsForm = {
  allowLateSubmissions: true,
  latePenaltyPercent: 10,
  defaultPointsPossible: 100,
  gradingScale: "percentage",
};

type Props = {
  classroomName: string;
  /** Current settings from classroom (jsonb). Merged with defaults. */
  settings: ClassroomSettingsForm | null | undefined;
  onSave: (settings: ClassroomSettingsForm) => Promise<void>;
  isSaving?: boolean;
};

export function ClassroomSettingsSection({
  classroomName,
  settings: initialSettings,
  onSave,
  isSaving = false,
}: Props) {
  const [settings, setSettings] = useState<ClassroomSettingsForm>(() => ({
    ...defaultForm,
    ...(initialSettings ?? {}),
  }));

  useEffect(() => {
    setSettings({
      ...defaultForm,
      ...(initialSettings ?? {}),
    });
  }, [initialSettings]);

  const handleSave = () => {
    onSave(settings);
  };

  return (
    <Card id="classroom-settings" className="rounded-2xl border-border/80 shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] overflow-hidden">
      <CardHeader className="pb-4 border-b border-border/60 bg-muted/15">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Settings className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
          Classroom Settings
        </CardTitle>
        <CardDescription className="text-sm mt-1">
          Configure grading and submission settings for {classroomName}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {/* Allow Late Submissions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="allowLate" className="text-base">
                Allow Late Submissions
              </Label>
              <p className="text-sm text-muted-foreground">
                Students can submit after the due date
              </p>
            </div>
            <Switch
              id="allowLate"
              checked={settings.allowLateSubmissions}
              onCheckedChange={(checked) =>
                setSettings((s) => ({ ...s, allowLateSubmissions: checked }))
              }
            />
          </div>
          {settings.allowLateSubmissions && (
            <div className="space-y-2 pl-4 border-l-2 border-primary/20">
              <Label htmlFor="latePenalty">Late Penalty (%)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="latePenalty"
                  type="number"
                  min={0}
                  max={100}
                  value={settings.latePenaltyPercent}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      latePenaltyPercent: parseInt(e.target.value, 10) || 0,
                    }))
                  }
                  className="w-24"
                />
                <Percent className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground">
                  deducted per day
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Default Points Possible */}
        <div className="space-y-2">
          <Label htmlFor="defaultPoints">Default Points Possible</Label>
          <p className="text-sm text-muted-foreground">
            Default point value for new assignments
          </p>
          <Input
            id="defaultPoints"
            type="number"
            min={1}
            value={settings.defaultPointsPossible}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                defaultPointsPossible: parseInt(e.target.value, 10) || 100,
              }))
            }
            className="w-32"
          />
        </div>

        {/* Grading Scale */}
        <div className="space-y-2">
          <Label htmlFor="gradingScale">Grading Scale</Label>
          <p className="text-sm text-muted-foreground">
            How grades are displayed to students
          </p>
          <Select
            value={settings.gradingScale}
            onValueChange={(value) =>
              setSettings((s) => ({ ...s, gradingScale: value }))
            }
          >
            <SelectTrigger id="gradingScale" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percentage">Percentage (0-100%)</SelectItem>
              <SelectItem value="points">Points Only</SelectItem>
              <SelectItem value="letter">Letter Grade (A-F)</SelectItem>
              <SelectItem value="passfail">Pass/Fail</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Actions */}
        <div className="flex justify-end pt-5 border-t border-border/60">
          <Button onClick={handleSave} disabled={isSaving} className="min-w-[120px] rounded-lg font-medium">
            {isSaving ? "Saving…" : "Save Settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
