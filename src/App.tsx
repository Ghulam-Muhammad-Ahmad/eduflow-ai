import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import TeacherDashboard from "./pages/dashboard/TeacherDashboard";
import TeacherDocuments from "./pages/dashboard/TeacherDocuments";
import TeacherClassrooms from "./pages/dashboard/TeacherClassrooms";
import TeacherAssignments from "./pages/dashboard/TeacherAssignments";
import StudentDashboard from "./pages/dashboard/StudentDashboard";
import StudentClassrooms from "./pages/dashboard/StudentClassrooms";
import AdminDashboard from "./pages/dashboard/AdminDashboard";
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
              path="/dashboard/teacher/assignments"
              element={
                <ProtectedRoute allowedRoles={["teacher"]}>
                  <TeacherAssignments />
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
