import { useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Download, Calendar, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useClassrooms } from "@/hooks/useClassrooms";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@supabase/supabase-js";
import { format } from "date-fns";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const StudentCheckedPapers = () => {
  const { user } = useAuth();
  const { classrooms } = useClassrooms();
  const [selectedClassroom, setSelectedClassroom] = useState<string>("");

  const { data: checkedPapers, isLoading } = useQuery({
    queryKey: ["checked-papers", user?.id, selectedClassroom],
    queryFn: async () => {
      if (!user?.id) return [];

      let query = supabase
        .from("checked_papers")
        .select(`
          *,
          classrooms (
            id,
            name
          ),
          profiles!checked_papers_teacher_id_fkey (
            display_name
          )
        `)
        .or(`student_id.eq.${user.id},and(student_id.is.null,classroom_id.in.(${classrooms?.map(c => c.id).join(',') || []}))`);

      if (selectedClassroom) {
        query = query.eq("classroom_id", selectedClassroom);
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && !!classrooms,
  });

  const handleDownload = async (paper: any) => {
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(paper.file_path, 60);

    if (error) {
      console.error("Error generating signed URL:", error);
      return;
    }

    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    }
  };

  return (
    <DashboardLayout role="student">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Checked Papers</h1>
          <p className="text-muted-foreground mt-1">
            View papers checked and saved by your teachers
          </p>
        </div>

        <Card className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium">Filter by Classroom</label>
              <Select value={selectedClassroom} onValueChange={setSelectedClassroom}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="All classrooms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All classrooms</SelectItem>
                  {classrooms?.map((classroom) => (
                    <SelectItem key={classroom.id} value={classroom.id}>
                      {classroom.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Paper</TableHead>
                <TableHead>Classroom</TableHead>
                <TableHead>Teacher</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Loading checked papers...
                  </TableCell>
                </TableRow>
              ) : !checkedPapers || checkedPapers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No checked papers found
                  </TableCell>
                </TableRow>
              ) : (
                checkedPapers.map((paper: any) => (
                  <TableRow key={paper.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{paper.title}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{paper.classrooms?.name || "Unknown"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span>{paper.profiles?.display_name || "Teacher"}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-semibold">
                        {paper.grade}/100
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>
                          {format(new Date(paper.created_at), "MMM d, yyyy")}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownload(paper)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default StudentCheckedPapers;
