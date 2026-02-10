export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      assignment_attachments: {
        Row: {
          assignment_id: string
          created_at: string
          document_id: string
          id: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          document_id: string
          id?: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          document_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_attachments_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_attachments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_feedback: {
        Row: {
          id: string
          submission_id: string
          user_id: string
          feedback_data: Json
          suggestions: Json | null
          consistency_hash: string | null
          rubric_suggestions: Json | null
          accepted: boolean
          modified_feedback: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          submission_id: string
          user_id: string
          feedback_data: Json
          suggestions?: Json | null
          consistency_hash?: string | null
          rubric_suggestions?: Json | null
          accepted?: boolean
          modified_feedback?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          submission_id?: string
          user_id?: string
          feedback_data?: Json
          suggestions?: Json | null
          consistency_hash?: string | null
          rubric_suggestions?: Json | null
          accepted?: boolean
          modified_feedback?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_feedback_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_generated_content: {
        Row: {
          id: string
          user_id: string
          content_type: string
          title: string
          content: Json
          source_materials: Json | null
          metadata: Json | null
          saved_to_documents: boolean | null
          document_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          content_type: string
          title: string
          content: Json
          source_materials?: Json | null
          metadata?: Json | null
          saved_to_documents?: boolean | null
          document_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          content_type?: string
          title?: string
          content?: Json
          source_materials?: Json | null
          metadata?: Json | null
          saved_to_documents?: boolean | null
          document_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_generated_content_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          allow_late_submission: boolean | null
          classroom_id: string
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          instructions: string | null
          points_possible: number | null
          published_at: string | null
          status: string
          teacher_id: string
          title: string
          updated_at: string
        }
        Insert: {
          allow_late_submission?: boolean | null
          classroom_id: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          instructions?: string | null
          points_possible?: number | null
          published_at?: string | null
          status?: string
          teacher_id: string
          title: string
          updated_at?: string
        }
        Update: {
          allow_late_submission?: boolean | null
          classroom_id?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          instructions?: string | null
          points_possible?: number | null
          published_at?: string | null
          status?: string
          teacher_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
        ]
      }
      classrooms: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_archived: boolean | null
          join_code: string
          name: string
          settings: Json | null
          subject: string | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_archived?: boolean | null
          join_code: string
          name: string
          settings?: Json | null
          subject?: string | null
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_archived?: boolean | null
          join_code?: string
          name?: string
          settings?: Json | null
          subject?: string | null
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      document_classroom_shares: {
        Row: {
          classroom_id: string
          document_id: string
          id: string
          shared_at: string
        }
        Insert: {
          classroom_id: string
          document_id: string
          id?: string
          shared_at?: string
        }
        Update: {
          classroom_id?: string
          document_id?: string
          id?: string
          shared_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_classroom_shares_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_classroom_shares_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_tags: {
        Row: {
          created_at: string
          document_id: string
          id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          tag_id: string
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_tags_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          file_path: string
          file_size: number
          file_type: string
          folder_id: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_path: string
          file_size?: number
          file_type: string
          folder_id?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_path?: string
          file_size?: number
          file_type?: string
          folder_id?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          classroom_id: string
          id: string
          joined_at: string
          left_at: string | null
          status: string
          student_id: string
        }
        Insert: {
          classroom_id: string
          id?: string
          joined_at?: string
          left_at?: string | null
          status?: string
          student_id: string
        }
        Update: {
          classroom_id?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
        ]
      }
      folders: {
        Row: {
          created_at: string
          id: string
          name: string
          parent_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quizzes: {
        Row: {
          id: string
          classroom_id: string
          teacher_id: string
          title: string
          description: string | null
          instructions: string | null
          time_limit_minutes: number | null
          available_from: string | null
          available_until: string | null
          passing_score: number | null
          max_attempts: number | null
          randomize_questions: boolean | null
          show_correct_answers: boolean | null
          show_results_immediately: boolean | null
          status: string
          published_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          classroom_id: string
          teacher_id: string
          title: string
          description?: string | null
          instructions?: string | null
          time_limit_minutes?: number | null
          available_from?: string | null
          available_until?: string | null
          passing_score?: number | null
          max_attempts?: number | null
          randomize_questions?: boolean | null
          show_correct_answers?: boolean | null
          show_results_immediately?: boolean | null
          status?: string
          published_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          classroom_id?: string
          teacher_id?: string
          title?: string
          description?: string | null
          instructions?: string | null
          time_limit_minutes?: number | null
          available_from?: string | null
          available_until?: string | null
          passing_score?: number | null
          max_attempts?: number | null
          randomize_questions?: boolean | null
          show_correct_answers?: boolean | null
          show_results_immediately?: boolean | null
          status?: string
          published_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          id: string
          quiz_id: string
          question_type: string
          question_text: string
          points: number
          order_index: number
          options: Json | null
          correct_answer: string | null
          explanation: string | null
          created_at: string
        }
        Insert: {
          id?: string
          quiz_id: string
          question_type: string
          question_text: string
          points?: number
          order_index?: number
          options?: Json | null
          correct_answer?: string | null
          explanation?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          quiz_id?: string
          question_type?: string
          question_text?: string
          points?: number
          order_index?: number
          options?: Json | null
          correct_answer?: string | null
          explanation?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          id: string
          quiz_id: string
          student_id: string
          attempt_number: number
          started_at: string
          submitted_at: string | null
          time_spent_seconds: number | null
          answers: Json
          score: number | null
          points_earned: number | null
          points_possible: number | null
          status: string
          auto_graded_at: string | null
          manually_graded_at: string | null
          feedback: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          quiz_id: string
          student_id: string
          attempt_number?: number
          started_at?: string
          submitted_at?: string | null
          time_spent_seconds?: number | null
          answers?: Json
          score?: number | null
          points_earned?: number | null
          points_possible?: number | null
          status?: string
          auto_graded_at?: string | null
          manually_graded_at?: string | null
          feedback?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          quiz_id?: string
          student_id?: string
          attempt_number?: number
          started_at?: string
          submitted_at?: string | null
          time_spent_seconds?: number | null
          answers?: Json
          score?: number | null
          points_earned?: number | null
          points_possible?: number | null
          status?: string
          auto_graded_at?: string | null
          manually_graded_at?: string | null
          feedback?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          assignment_id: string
          created_at: string
          feedback: string | null
          file_name: string | null
          file_path: string | null
          grade: number | null
          graded_at: string | null
          id: string
          is_late: boolean | null
          returned_at: string | null
          status: string
          student_id: string
          submitted_at: string
          text_content: string | null
          updated_at: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          feedback?: string | null
          file_name?: string | null
          file_path?: string | null
          grade?: number | null
          graded_at?: string | null
          id?: string
          is_late?: boolean | null
          returned_at?: string | null
          status?: string
          student_id: string
          submitted_at?: string
          text_content?: string | null
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          feedback?: string | null
          file_name?: string | null
          file_path?: string | null
          grade?: number | null
          graded_at?: string | null
          id?: string
          is_late?: boolean | null
          returned_at?: string | null
          status?: string
          student_id?: string
          submitted_at?: string
          text_content?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      planner_events: {
        Row: {
          id: string
          teacher_id: string
          title: string
          start_at: string
          end_at: string
          all_day: boolean
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          teacher_id: string
          title: string
          start_at: string
          end_at: string
          all_day?: boolean
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          teacher_id?: string
          title?: string
          start_at?: string
          end_at?: string
          all_day?: boolean
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      checked_papers: {
        Row: {
          id: string
          teacher_id: string
          classroom_id: string
          student_id: string | null
          title: string
          file_path: string
          grade: number | null
          feedback_text: string | null
          instructions_used: string | null
          created_at: string
        }
        Insert: {
          id?: string
          teacher_id: string
          classroom_id: string
          student_id?: string | null
          title: string
          file_path: string
          grade?: number | null
          feedback_text?: string | null
          instructions_used?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          teacher_id?: string
          classroom_id?: string
          student_id?: string | null
          title?: string
          file_path?: string
          grade?: number | null
          feedback_text?: string | null
          instructions_used?: string | null
          created_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_quiz_score: {
        Args: { attempt_id: string }
        Returns: {
          score: number | null
          points_earned: number | null
          points_possible: number | null
        }
      }
      can_attempt_quiz: {
        Args: { _quiz_id: string; _student_id: string }
        Returns: { can_attempt: boolean; reason: string | null }
      }
      start_quiz_attempt: {
        Args: { _quiz_id: string; _student_id: string }
        Returns: Database['public']['Tables']['quiz_attempts']['Row'][]
      }
      generate_join_code: { Args: never; Returns: string }
      get_classroom_by_join_code: {
        Args: { code: string }
        Returns: {
          description: string
          id: string
          name: string
          subject: string
          teacher_name: string
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_classroom_teacher: {
        Args: { _classroom_id: string; _user_id: string }
        Returns: boolean
      }
      is_enrolled_in_classroom: {
        Args: { _classroom_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "teacher" | "student" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["teacher", "student", "admin"],
    },
  },
} as const
