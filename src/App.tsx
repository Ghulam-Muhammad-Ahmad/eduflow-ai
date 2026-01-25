import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import JoinClassroom from "./pages/JoinClassroom";
import TeacherDashboard from "./pages/dashboard/TeacherDashboard";
import TeacherDocuments from "./pages/dashboard/TeacherDocuments";
import TeacherClassrooms from "./pages/dashboard/TeacherClassrooms";
import TeacherClassroomDetail from "./pages/dashboard/TeacherClassroomDetail";
import TeacherAssignments from "./pages/dashboard/TeacherAssignments";
import TeacherAssignmentSubmissions from "./pages/dashboard/TeacherAssignmentSubmissions";
import TeacherQuizzes from "./pages/dashboard/TeacherQuizzes";
import TeacherQuizBuilder from "./pages/dashboard/TeacherQuizBuilder";
import TeacherQuizResults from "./pages/dashboard/TeacherQuizResults";
import TeacherAIStudio from "./pages/dashboard/TeacherAIStudio";
import TeacherAIGrading from "./pages/dashboard/TeacherAIGrading";
import TeacherLessonPlanner from "./pages/dashboard/TeacherLessonPlanner";
import StudentDashboard from "./pages/dashboard/StudentDashboard";
import StudentClassrooms from "./pages/dashboard/StudentClassrooms";
import StudentClassroomDetail from "./pages/dashboard/StudentClassroomDetail";
import StudentAssignments from "./pages/dashboard/StudentAssignments";
import StudentDocuments from "./pages/dashboard/StudentDocuments";
import StudentQuizzes from "./pages/dashboard/StudentQuizzes";
import StudentQuizTake from "./pages/dashboard/StudentQuizTake";
import StudentQuizResults from "./pages/dashboard/StudentQuizResults";
import StudentAIPrep from "./pages/dashboard/StudentAIPrep";
import AdminDashboard from "./pages/dashboard/AdminDashboard";
import Settings from "./pages/dashboard/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/join/classroom/:code" element={<JoinClassroom />} />
            
            {/* Settings Route - Accessible by all authenticated users */}
            <Route
              path="/dashboard/settings"
              element={
                <ProtectedRoute allowedRoles={["teacher", "student", "admin"]}>
                  <Settings />
                </ProtectedRoute>
              }
            />
            
            {/* Teacher Routes */}
            <Route
              path="/dashboard/teacher"
              element={
                <ProtectedRoute allowedRoles={["teacher"]}>
                  <TeacherDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/teacher/documents"
              element={
                <ProtectedRoute allowedRoles={["teacher"]}>
                  <TeacherDocuments />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/teacher/classrooms"
              element={
                <ProtectedRoute allowedRoles={["teacher"]}>
                  <TeacherClassrooms />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/teacher/classrooms/:classroomId"
              element={
                <ProtectedRoute allowedRoles={["teacher"]}>
                  <TeacherClassroomDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/teacher/assignments"
              element={
                <ProtectedRoute allowedRoles={["teacher"]}>
                  <TeacherAssignments />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/teacher/assignments/:assignmentId/submissions"
              element={
                <ProtectedRoute allowedRoles={["teacher"]}>
                  <TeacherAssignmentSubmissions />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/teacher/quizzes"
              element={
                <ProtectedRoute allowedRoles={["teacher"]}>
                  <TeacherQuizzes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/teacher/quizzes/create"
              element={
                <ProtectedRoute allowedRoles={["teacher"]}>
                  <TeacherQuizBuilder />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/teacher/quizzes/:quizId/edit"
              element={
                <ProtectedRoute allowedRoles={["teacher"]}>
                  <TeacherQuizBuilder />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/teacher/quizzes/:quizId/results"
              element={
                <ProtectedRoute allowedRoles={["teacher"]}>
                  <TeacherQuizResults />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/teacher/ai-studio"
              element={
                <ProtectedRoute allowedRoles={["teacher"]}>
                  <TeacherAIStudio />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/teacher/grading"
              element={
                <ProtectedRoute allowedRoles={["teacher"]}>
                  <TeacherAIGrading />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/teacher/lessons"
              element={
                <ProtectedRoute allowedRoles={["teacher"]}>
                  <TeacherLessonPlanner />
                </ProtectedRoute>
              }
            />
            
            {/* Student Routes */}
            <Route
              path="/dashboard/student"
              element={
                <ProtectedRoute allowedRoles={["student"]}>
                  <StudentDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/student/classrooms"
              element={
                <ProtectedRoute allowedRoles={["student"]}>
                  <StudentClassrooms />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/student/classrooms/:classroomId"
              element={
                <ProtectedRoute allowedRoles={["student"]}>
                  <StudentClassroomDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/student/assignments"
              element={
                <ProtectedRoute allowedRoles={["student"]}>
                  <StudentAssignments />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/student/documents"
              element={
                <ProtectedRoute allowedRoles={["student"]}>
                  <StudentDocuments />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/student/quizzes"
              element={
                <ProtectedRoute allowedRoles={["student"]}>
                  <StudentQuizzes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/student/quizzes/:quizId/take"
              element={
                <ProtectedRoute allowedRoles={["student"]}>
                  <StudentQuizTake />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/student/quizzes/:quizId/take/:attemptId"
              element={
                <ProtectedRoute allowedRoles={["student"]}>
                  <StudentQuizTake />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/student/quizzes/:quizId/results/:attemptId"
              element={
                <ProtectedRoute allowedRoles={["student"]}>
                  <StudentQuizResults />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/student/study"
              element={
                <ProtectedRoute allowedRoles={["student"]}>
                  <StudentAIPrep />
                </ProtectedRoute>
              }
            />
            
            {/* Admin Routes */}
            <Route
              path="/dashboard/admin/*"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
