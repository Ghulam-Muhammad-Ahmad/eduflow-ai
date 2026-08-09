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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      ai_feedback: {
        Row: {
          accepted: boolean | null
          consistency_hash: string | null
          created_at: string
          feedback_data: Json
          id: string
          modified_feedback: string | null
          rubric_suggestions: Json | null
          submission_id: string
          suggestions: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted?: boolean | null
          consistency_hash?: string | null
          created_at?: string
          feedback_data: Json
          id?: string
          modified_feedback?: string | null
          rubric_suggestions?: Json | null
          submission_id: string
          suggestions?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted?: boolean | null
          consistency_hash?: string | null
          created_at?: string
          feedback_data?: Json
          id?: string
          modified_feedback?: string | null
          rubric_suggestions?: Json | null
          submission_id?: string
          suggestions?: Json | null
          updated_at?: string
          user_id?: string
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
          content: Json
          content_type: string
          created_at: string
          document_id: string | null
          id: string
          metadata: Json | null
          saved_to_documents: boolean | null
          source_materials: Json | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: Json
          content_type: string
          created_at?: string
          document_id?: string | null
          id?: string
          metadata?: Json | null
          saved_to_documents?: boolean | null
          source_materials?: Json | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: Json
          content_type?: string
          created_at?: string
          document_id?: string | null
          id?: string
          metadata?: Json | null
          saved_to_documents?: boolean | null
          source_materials?: Json | null
          title?: string
          updated_at?: string
          user_id?: string
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
      ai_interactions: {
        Row: {
          cost: number | null
          created_at: string
          credits_deducted: number | null
          error_message: string | null
          id: string
          interaction_type: string
          model: string
          provider: string
          request_data: Json | null
          response_data: Json | null
          success: boolean | null
          tokens_used: number | null
          user_id: string
        }
        Insert: {
          cost?: number | null
          created_at?: string
          credits_deducted?: number | null
          error_message?: string | null
          id?: string
          interaction_type: string
          model: string
          provider: string
          request_data?: Json | null
          response_data?: Json | null
          success?: boolean | null
          tokens_used?: number | null
          user_id: string
        }
        Update: {
          cost?: number | null
          created_at?: string
          credits_deducted?: number | null
          error_message?: string | null
          id?: string
          interaction_type?: string
          model?: string
          provider?: string
          request_data?: Json | null
          response_data?: Json | null
          success?: boolean | null
          tokens_used?: number | null
          user_id?: string
        }
        Relationships: []
      }
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
      assignments: {
        Row: {
          allow_late_submission: boolean | null
          classroom_id: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          instructions: string | null
          one_to_one_room_id: string | null
          points_possible: number | null
          published_at: string | null
          status: string
          teacher_id: string
          title: string
          updated_at: string
        }
        Insert: {
          allow_late_submission?: boolean | null
          classroom_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          instructions?: string | null
          one_to_one_room_id?: string | null
          points_possible?: number | null
          published_at?: string | null
          status?: string
          teacher_id: string
          title: string
          updated_at?: string
        }
        Update: {
          allow_late_submission?: boolean | null
          classroom_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          instructions?: string | null
          one_to_one_room_id?: string | null
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
          {
            foreignKeyName: "assignments_one_to_one_room_id_fkey"
            columns: ["one_to_one_room_id"]
            isOneToOne: false
            referencedRelation: "one_to_one_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      checked_papers: {
        Row: {
          classroom_id: string
          created_at: string
          feedback_text: string | null
          file_path: string
          grade: number | null
          id: string
          instructions_used: string | null
          student_id: string | null
          teacher_id: string
          title: string
        }
        Insert: {
          classroom_id: string
          created_at?: string
          feedback_text?: string | null
          file_path: string
          grade?: number | null
          id?: string
          instructions_used?: string | null
          student_id?: string | null
          teacher_id: string
          title: string
        }
        Update: {
          classroom_id?: string
          created_at?: string
          feedback_text?: string | null
          file_path?: string
          grade?: number | null
          id?: string
          instructions_used?: string | null
          student_id?: string | null
          teacher_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "checked_papers_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
        ]
      }
      checker_presets: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          instructions: string
          is_default: boolean
          name: string
          reference_document_id: string | null
          rubric_categories: Json
          teacher_id: string
          total_points: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          instructions: string
          is_default?: boolean
          name: string
          reference_document_id?: string | null
          rubric_categories?: Json
          teacher_id: string
          total_points?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          instructions?: string
          is_default?: boolean
          name?: string
          reference_document_id?: string | null
          rubric_categories?: Json
          teacher_id?: string
          total_points?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checker_presets_reference_document_id_fkey"
            columns: ["reference_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checker_presets_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      classroom_tutors: {
        Row: {
          classroom_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          classroom_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          classroom_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classroom_tutors_classroom_id_fkey"
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
          id: string
          is_archived: boolean | null
          join_code: string | null
          name: string
          settings: Json | null
          subject: string | null
          teacher_id: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_archived?: boolean | null
          join_code?: string | null
          name: string
          settings?: Json | null
          subject?: string | null
          teacher_id: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_archived?: boolean | null
          join_code?: string | null
          name?: string
          settings?: Json | null
          subject?: string | null
          teacher_id?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classrooms_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_assignments_audit: {
        Row: {
          action: string
          assigned_by_user_id: string
          assigned_to_user_id: string
          created_at: string
          credits: number
          id: string
          new_limit: number | null
          period: string
          previous_limit: number | null
          workspace_id: string
        }
        Insert: {
          action: string
          assigned_by_user_id: string
          assigned_to_user_id: string
          created_at?: string
          credits: number
          id?: string
          new_limit?: number | null
          period: string
          previous_limit?: number | null
          workspace_id: string
        }
        Update: {
          action?: string
          assigned_by_user_id?: string
          assigned_to_user_id?: string
          created_at?: string
          credits?: number
          id?: string
          new_limit?: number | null
          period?: string
          previous_limit?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_assignments_audit_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
      document_one_to_one_room_shares: {
        Row: {
          document_id: string
          id: string
          one_to_one_room_id: string
          shared_at: string
        }
        Insert: {
          document_id: string
          id?: string
          one_to_one_room_id: string
          shared_at?: string
        }
        Update: {
          document_id?: string
          id?: string
          one_to_one_room_id?: string
          shared_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_one_to_one_room_shares_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_one_to_one_room_shares_one_to_one_room_id_fkey"
            columns: ["one_to_one_room_id"]
            isOneToOne: false
            referencedRelation: "one_to_one_rooms"
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
      document_user_shares: {
        Row: {
          document_id: string
          id: string
          shared_at: string
          shared_with_user_id: string
        }
        Insert: {
          document_id: string
          id?: string
          shared_at?: string
          shared_with_user_id: string
        }
        Update: {
          document_id?: string
          id?: string
          shared_at?: string
          shared_with_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_user_shares_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
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
      google_calendar_connections: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string | null
          google_calendar_id: string
          google_email: string | null
          id: string
          refresh_token: string | null
          scope: string | null
          token_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at?: string | null
          google_calendar_id?: string
          google_email?: string | null
          id?: string
          refresh_token?: string | null
          scope?: string | null
          token_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string | null
          google_calendar_id?: string
          google_email?: string | null
          id?: string
          refresh_token?: string | null
          scope?: string | null
          token_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      one_to_one_rooms: {
        Row: {
          created_at: string
          id: string
          name: string | null
          student_id: string
          tutor_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string | null
          student_id: string
          tutor_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string | null
          student_id?: string
          tutor_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "one_to_one_rooms_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      planner_events: {
        Row: {
          all_day: boolean
          created_at: string
          description: string | null
          end_at: string
          id: string
          start_at: string
          teacher_id: string
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          created_at?: string
          description?: string | null
          end_at: string
          id?: string
          start_at: string
          teacher_id: string
          title: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          created_at?: string
          description?: string | null
          end_at?: string
          id?: string
          start_at?: string
          teacher_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_type: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          onboarding_completed_at: string | null
          password_changed_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_type?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          onboarding_completed_at?: string | null
          password_changed_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_type?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          onboarding_completed_at?: string | null
          password_changed_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quiz_attachments: {
        Row: {
          created_at: string
          document_id: string
          id: string
          quiz_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          quiz_id: string
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          quiz_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attachments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attachments_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          answers: Json
          attempt_number: number
          auto_graded_at: string | null
          created_at: string
          feedback: string | null
          id: string
          manually_graded_at: string | null
          points_earned: number | null
          points_possible: number | null
          quiz_id: string
          response_file_name: string | null
          response_file_path: string | null
          response_file_size: number | null
          response_text: string | null
          score: number | null
          started_at: string
          status: string
          student_id: string
          submitted_at: string | null
          time_spent_seconds: number | null
          updated_at: string
        }
        Insert: {
          answers?: Json
          attempt_number?: number
          auto_graded_at?: string | null
          created_at?: string
          feedback?: string | null
          id?: string
          manually_graded_at?: string | null
          points_earned?: number | null
          points_possible?: number | null
          quiz_id: string
          response_file_name?: string | null
          response_file_path?: string | null
          response_file_size?: number | null
          response_text?: string | null
          score?: number | null
          started_at?: string
          status?: string
          student_id: string
          submitted_at?: string | null
          time_spent_seconds?: number | null
          updated_at?: string
        }
        Update: {
          answers?: Json
          attempt_number?: number
          auto_graded_at?: string | null
          created_at?: string
          feedback?: string | null
          id?: string
          manually_graded_at?: string | null
          points_earned?: number | null
          points_possible?: number | null
          quiz_id?: string
          response_file_name?: string | null
          response_file_path?: string | null
          response_file_size?: number | null
          response_text?: string | null
          score?: number | null
          started_at?: string
          status?: string
          student_id?: string
          submitted_at?: string | null
          time_spent_seconds?: number | null
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
      quiz_questions: {
        Row: {
          correct_answer: string | null
          created_at: string
          explanation: string | null
          id: string
          options: Json | null
          order_index: number
          points: number
          question_text: string
          question_type: string
          quiz_id: string
        }
        Insert: {
          correct_answer?: string | null
          created_at?: string
          explanation?: string | null
          id?: string
          options?: Json | null
          order_index?: number
          points?: number
          question_text: string
          question_type: string
          quiz_id: string
        }
        Update: {
          correct_answer?: string | null
          created_at?: string
          explanation?: string | null
          id?: string
          options?: Json | null
          order_index?: number
          points?: number
          question_text?: string
          question_type?: string
          quiz_id?: string
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
      quizzes: {
        Row: {
          available_from: string | null
          available_until: string | null
          classroom_id: string | null
          created_at: string
          description: string | null
          id: string
          instructions: string | null
          max_attempts: number | null
          one_to_one_room_id: string | null
          passing_score: number | null
          published_at: string | null
          response_points: number
          randomize_questions: boolean | null
          show_correct_answers: boolean | null
          show_results_immediately: boolean | null
          status: string
          teacher_id: string
          time_limit_minutes: number | null
          title: string
          updated_at: string
        }
        Insert: {
          available_from?: string | null
          available_until?: string | null
          classroom_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          instructions?: string | null
          max_attempts?: number | null
          one_to_one_room_id?: string | null
          passing_score?: number | null
          published_at?: string | null
          response_points?: number
          randomize_questions?: boolean | null
          show_correct_answers?: boolean | null
          show_results_immediately?: boolean | null
          status?: string
          teacher_id: string
          time_limit_minutes?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          available_from?: string | null
          available_until?: string | null
          classroom_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          instructions?: string | null
          max_attempts?: number | null
          one_to_one_room_id?: string | null
          passing_score?: number | null
          published_at?: string | null
          response_points?: number
          randomize_questions?: boolean | null
          show_correct_answers?: boolean | null
          show_results_immediately?: boolean | null
          status?: string
          teacher_id?: string
          time_limit_minutes?: number | null
          title?: string
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
          {
            foreignKeyName: "quizzes_one_to_one_room_id_fkey"
            columns: ["one_to_one_room_id"]
            isOneToOne: false
            referencedRelation: "one_to_one_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      session_financial_mock: {
        Row: {
          created_at: string
          created_by_user_id: string
          id: string
          session_id: string
          student_charge_amount: number
          student_charge_currency: string
          student_charge_type: string
          tutor_id: string
          tutor_rate_amount: number
          tutor_rate_currency: string
          tutor_rate_type: string
          updated_at: string
          updated_by_user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          id?: string
          session_id: string
          student_charge_amount?: number
          student_charge_currency?: string
          student_charge_type?: string
          tutor_id: string
          tutor_rate_amount?: number
          tutor_rate_currency?: string
          tutor_rate_type?: string
          updated_at?: string
          updated_by_user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          id?: string
          session_id?: string
          student_charge_amount?: number
          student_charge_currency?: string
          student_charge_type?: string
          tutor_id?: string
          tutor_rate_amount?: number
          tutor_rate_currency?: string
          tutor_rate_type?: string
          updated_at?: string
          updated_by_user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_financial_mock_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_financial_mock_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      session_notes: {
        Row: {
          content: string
          created_at: string
          created_by_user_id: string
          id: string
          session_id: string
          tutor_id: string
          updated_at: string
          updated_by_user_id: string
          workspace_id: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by_user_id: string
          id?: string
          session_id: string
          tutor_id: string
          updated_at?: string
          updated_by_user_id: string
          workspace_id: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by_user_id?: string
          id?: string
          session_id?: string
          tutor_id?: string
          updated_at?: string
          updated_by_user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_notes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_notes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      session_series: {
        Row: {
          classroom_id: string | null
          created_at: string
          created_by_user_id: string
          description: string | null
          ends_at: string
          id: string
          occurrences_count: number
          recurrence_frequency: string
          recurrence_interval: number
          scope_type: string
          starts_at: string
          student_id: string | null
          timezone: string | null
          title: string
          tutor_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          classroom_id?: string | null
          created_at?: string
          created_by_user_id: string
          description?: string | null
          ends_at: string
          id?: string
          occurrences_count: number
          recurrence_frequency: string
          recurrence_interval?: number
          scope_type: string
          starts_at: string
          student_id?: string | null
          timezone?: string | null
          title: string
          tutor_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          classroom_id?: string | null
          created_at?: string
          created_by_user_id?: string
          description?: string | null
          ends_at?: string
          id?: string
          occurrences_count?: number
          recurrence_frequency?: string
          recurrence_interval?: number
          scope_type?: string
          starts_at?: string
          student_id?: string | null
          timezone?: string | null
          title?: string
          tutor_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_series_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_series_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          classroom_id: string | null
          completed_at: string | null
          completed_by_user_id: string | null
          created_at: string
          created_by_user_id: string
          description: string | null
          ends_at: string
          external_event_id: string | null
          google_calendar_id: string | null
          id: string
          meeting_provider: string
          meeting_url: string | null
          occurrence_index: number | null
          scope_type: string
          series_id: string | null
          starts_at: string
          status: string
          student_id: string | null
          timezone: string | null
          title: string
          tutor_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          classroom_id?: string | null
          completed_at?: string | null
          completed_by_user_id?: string | null
          created_at?: string
          created_by_user_id: string
          description?: string | null
          ends_at: string
          external_event_id?: string | null
          google_calendar_id?: string | null
          id?: string
          meeting_provider?: string
          meeting_url?: string | null
          occurrence_index?: number | null
          scope_type?: string
          series_id?: string | null
          starts_at: string
          status?: string
          student_id?: string | null
          timezone?: string | null
          title: string
          tutor_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          classroom_id?: string | null
          completed_at?: string | null
          completed_by_user_id?: string | null
          created_at?: string
          created_by_user_id?: string
          description?: string | null
          ends_at?: string
          external_event_id?: string | null
          google_calendar_id?: string | null
          id?: string
          meeting_provider?: string
          meeting_url?: string | null
          occurrence_index?: number | null
          scope_type?: string
          series_id?: string | null
          starts_at?: string
          status?: string
          student_id?: string | null
          timezone?: string | null
          title?: string
          tutor_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "session_series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      source_documents: {
        Row: {
          created_at: string | null
          description: string | null
          document_type: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          teacher_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          document_type: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          teacher_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          document_type?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          teacher_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "source_documents_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_fee_configs: {
        Row: {
          active: boolean
          amount: number
          created_at: string
          currency: string
          description: string | null
          fee_type: string
          id: string
          student_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          active?: boolean
          amount?: number
          created_at?: string
          currency?: string
          description?: string | null
          fee_type: string
          id?: string
          student_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          active?: boolean
          amount?: number
          created_at?: string
          currency?: string
          description?: string | null
          fee_type?: string
          id?: string
          student_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_fee_configs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      student_invoice_rows: {
        Row: {
          amount: number
          created_at: string
          currency: string
          description: string | null
          due_date: string
          fee_config_id: string | null
          id: string
          invoice_type: string
          paid_at: string | null
          proof_storage_path: string | null
          proof_submitted_at: string | null
          session_id: string | null
          status: string
          student_id: string
          updated_at: string
          waived_reason: string | null
          workspace_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          description?: string | null
          due_date: string
          fee_config_id?: string | null
          id?: string
          invoice_type: string
          paid_at?: string | null
          proof_storage_path?: string | null
          proof_submitted_at?: string | null
          session_id?: string | null
          status?: string
          student_id: string
          updated_at?: string
          waived_reason?: string | null
          workspace_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          description?: string | null
          due_date?: string
          fee_config_id?: string | null
          id?: string
          invoice_type?: string
          paid_at?: string | null
          proof_storage_path?: string | null
          proof_submitted_at?: string | null
          session_id?: string | null
          status?: string
          student_id?: string
          updated_at?: string
          waived_reason?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_invoice_rows_fee_config_id_fkey"
            columns: ["fee_config_id"]
            isOneToOne: false
            referencedRelation: "student_fee_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_invoice_rows_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_invoice_rows_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      student_requirements: {
        Row: {
          availability: string[] | null
          budget_hourly: number | null
          created_at: string | null
          created_by: string | null
          curriculum: string
          goal: string | null
          grade: string
          id: string
          language: string | null
          preferred_teaching_style: string | null
          status: string | null
          student_id: string | null
          student_level: string | null
          student_name: string
          student_nature: string[] | null
          subject: string
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          availability?: string[] | null
          budget_hourly?: number | null
          created_at?: string | null
          created_by?: string | null
          curriculum: string
          goal?: string | null
          grade: string
          id?: string
          language?: string | null
          preferred_teaching_style?: string | null
          status?: string | null
          student_id?: string | null
          student_level?: string | null
          student_name: string
          student_nature?: string[] | null
          subject: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          availability?: string[] | null
          budget_hourly?: number | null
          created_at?: string | null
          created_by?: string | null
          curriculum?: string
          goal?: string | null
          grade?: string
          id?: string
          language?: string | null
          preferred_teaching_style?: string | null
          status?: string | null
          student_id?: string | null
          student_level?: string | null
          student_name?: string
          student_nature?: string[] | null
          subject?: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_requirements_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
            foreignKeyName: "fk_submissions_student_profile"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
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
      teacher_ai_profiles: {
        Row: {
          best_for: string[] | null
          created_at: string | null
          evaluation_test_id: string | null
          id: string
          not_best_for: string[] | null
          overall_score: number | null
          owner_notes: string | null
          owner_reviewed: boolean | null
          owner_reviewed_at: string | null
          owner_reviewed_by: string | null
          personality_scores: Json | null
          preferences: Json | null
          recommendation: string | null
          strengths: string[] | null
          student_fit_scores: Json | null
          subject_scores: Json | null
          summary: string | null
          teacher_id: string | null
          teacher_nature: string | null
          teaching_style_scores: Json | null
          updated_at: string | null
          weaknesses: string[] | null
          workspace_id: string | null
        }
        Insert: {
          best_for?: string[] | null
          created_at?: string | null
          evaluation_test_id?: string | null
          id?: string
          not_best_for?: string[] | null
          overall_score?: number | null
          owner_notes?: string | null
          owner_reviewed?: boolean | null
          owner_reviewed_at?: string | null
          owner_reviewed_by?: string | null
          personality_scores?: Json | null
          preferences?: Json | null
          recommendation?: string | null
          strengths?: string[] | null
          student_fit_scores?: Json | null
          subject_scores?: Json | null
          summary?: string | null
          teacher_id?: string | null
          teacher_nature?: string | null
          teaching_style_scores?: Json | null
          updated_at?: string | null
          weaknesses?: string[] | null
          workspace_id?: string | null
        }
        Update: {
          best_for?: string[] | null
          created_at?: string | null
          evaluation_test_id?: string | null
          id?: string
          not_best_for?: string[] | null
          overall_score?: number | null
          owner_notes?: string | null
          owner_reviewed?: boolean | null
          owner_reviewed_at?: string | null
          owner_reviewed_by?: string | null
          personality_scores?: Json | null
          preferences?: Json | null
          recommendation?: string | null
          strengths?: string[] | null
          student_fit_scores?: Json | null
          subject_scores?: Json | null
          summary?: string | null
          teacher_id?: string | null
          teacher_nature?: string | null
          teaching_style_scores?: Json | null
          updated_at?: string | null
          weaknesses?: string[] | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_ai_profiles_evaluation_test_id_fkey"
            columns: ["evaluation_test_id"]
            isOneToOne: false
            referencedRelation: "teacher_evaluation_tests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_ai_profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_evaluation_answers: {
        Row: {
          answers_json: Json
          created_at: string | null
          evaluation_test_id: string | null
          id: string
          submitted_at: string | null
          teacher_id: string | null
        }
        Insert: {
          answers_json: Json
          created_at?: string | null
          evaluation_test_id?: string | null
          id?: string
          submitted_at?: string | null
          teacher_id?: string | null
        }
        Update: {
          answers_json?: Json
          created_at?: string | null
          evaluation_test_id?: string | null
          id?: string
          submitted_at?: string | null
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_evaluation_answers_evaluation_test_id_fkey"
            columns: ["evaluation_test_id"]
            isOneToOne: false
            referencedRelation: "teacher_evaluation_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_evaluation_tests: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          created_at: string | null
          curriculum: string[]
          experience_years: number | null
          grades: string[]
          id: string
          language: string | null
          questions_json: Json | null
          started_at: string | null
          status: string | null
          subject: string
          submitted_at: string | null
          teacher_id: string | null
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          created_at?: string | null
          curriculum: string[]
          experience_years?: number | null
          grades: string[]
          id?: string
          language?: string | null
          questions_json?: Json | null
          started_at?: string | null
          status?: string | null
          subject: string
          submitted_at?: string | null
          teacher_id?: string | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          created_at?: string | null
          curriculum?: string[]
          experience_years?: number | null
          grades?: string[]
          id?: string
          language?: string | null
          questions_json?: Json | null
          started_at?: string | null
          status?: string | null
          subject?: string
          submitted_at?: string | null
          teacher_id?: string | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_evaluation_tests_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_contracts: {
        Row: {
          change_request_note: string | null
          change_requested_at: string | null
          contract_body_text: string | null
          contract_signed_at: string | null
          contract_status: string
          contract_storage_path: string | null
          contract_type: string | null
          created_at: string
          end_date: string | null
          id: string
          owner_signature_name: string | null
          owner_signed_at: string | null
          pay_type: string
          platform_fee_pct: number | null
          rate_amount: number
          rate_currency: string
          start_date: string | null
          status: string | null
          subjects: Json
          tutor_id: string
          tutor_signature_name: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          change_request_note?: string | null
          change_requested_at?: string | null
          contract_body_text?: string | null
          contract_signed_at?: string | null
          contract_status?: string
          contract_storage_path?: string | null
          contract_type?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          owner_signature_name?: string | null
          owner_signed_at?: string | null
          pay_type?: string
          platform_fee_pct?: number | null
          rate_amount?: number
          rate_currency?: string
          start_date?: string | null
          status?: string | null
          subjects?: Json
          tutor_id: string
          tutor_signature_name?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          change_request_note?: string | null
          change_requested_at?: string | null
          contract_body_text?: string | null
          contract_signed_at?: string | null
          contract_status?: string
          contract_storage_path?: string | null
          contract_type?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          owner_signature_name?: string | null
          owner_signed_at?: string | null
          pay_type?: string
          platform_fee_pct?: number | null
          rate_amount?: number
          rate_currency?: string
          start_date?: string | null
          status?: string | null
          subjects?: Json
          tutor_id?: string
          tutor_signature_name?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_contracts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_earning_rows: {
        Row: {
          created_at: string
          currency: string
          description: string | null
          earning_type: string
          gross_amount: number
          id: string
          net_amount: number
          payout_id: string | null
          period_date: string
          platform_fee_amount: number
          session_id: string | null
          status: string
          tutor_contract_id: string | null
          tutor_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          description?: string | null
          earning_type: string
          gross_amount?: number
          id?: string
          net_amount?: number
          payout_id?: string | null
          period_date: string
          platform_fee_amount?: number
          session_id?: string | null
          status?: string
          tutor_contract_id?: string | null
          tutor_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          description?: string | null
          earning_type?: string
          gross_amount?: number
          id?: string
          net_amount?: number
          payout_id?: string | null
          period_date?: string
          platform_fee_amount?: number
          session_id?: string | null
          status?: string
          tutor_contract_id?: string | null
          tutor_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_earning_rows_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "tutor_payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_earning_rows_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_earning_rows_tutor_contract_id_fkey"
            columns: ["tutor_contract_id"]
            isOneToOne: false
            referencedRelation: "tutor_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_earning_rows_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_matches: {
        Row: {
          ai_explanation: Json | null
          best_match_teacher_id: string | null
          code_scores: Json | null
          created_at: string | null
          id: string
          ranked_matches: Json
          requirement_id: string | null
          status: string | null
          workspace_id: string | null
        }
        Insert: {
          ai_explanation?: Json | null
          best_match_teacher_id?: string | null
          code_scores?: Json | null
          created_at?: string | null
          id?: string
          ranked_matches: Json
          requirement_id?: string | null
          status?: string | null
          workspace_id?: string | null
        }
        Update: {
          ai_explanation?: Json | null
          best_match_teacher_id?: string | null
          code_scores?: Json | null
          created_at?: string | null
          id?: string
          ranked_matches?: Json
          requirement_id?: string | null
          status?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tutor_matches_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "student_requirements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_matches_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_payouts: {
        Row: {
          created_at: string
          currency: string
          id: string
          paid_at: string | null
          payment_note: string | null
          proof_storage_path: string | null
          status: string
          total_net_amount: number
          tutor_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          payment_note?: string | null
          proof_storage_path?: string | null
          status?: string
          total_net_amount?: number
          tutor_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          payment_note?: string | null
          proof_storage_path?: string | null
          status?: string
          total_net_amount?: number
          tutor_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_payouts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_student_assignments: {
        Row: {
          created_at: string
          id: string
          student_id: string
          tutor_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          student_id: string
          tutor_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          student_id?: string
          tutor_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_student_assignments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_ai_usage: {
        Row: {
          cost: number | null
          created_at: string
          id: string
          interactions_count: number | null
          limit_reached: boolean | null
          month: string
          tokens_used: number | null
          updated_at: string
          usage_limit: number | null
          user_id: string
        }
        Insert: {
          cost?: number | null
          created_at?: string
          id?: string
          interactions_count?: number | null
          limit_reached?: boolean | null
          month: string
          tokens_used?: number | null
          updated_at?: string
          usage_limit?: number | null
          user_id: string
        }
        Update: {
          cost?: number | null
          created_at?: string
          id?: string
          interactions_count?: number | null
          limit_reached?: boolean | null
          month?: string
          tokens_used?: number | null
          updated_at?: string
          usage_limit?: number | null
          user_id?: string
        }
        Relationships: []
      }
      user_credit_allocations: {
        Row: {
          created_at: string
          credits_limit: number
          credits_used: number
          id: string
          period: string
          source_id: string
          source_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_limit?: number
          credits_used?: number
          id?: string
          period: string
          source_id: string
          source_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits_limit?: number
          credits_used?: number
          id?: string
          period?: string
          source_id?: string
          source_type?: string
          updated_at?: string
          user_id?: string
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
      user_storage_allocations: {
        Row: {
          created_at: string
          id: string
          storage_limit_mb: number
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          storage_limit_mb?: number
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          storage_limit_mb?: number
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_storage_allocations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_subscriptions: {
        Row: {
          created_at: string
          current_period_ends_at: string | null
          doc_storage_limit_mb: number | null
          id: string
          paddle_customer_id: string | null
          paddle_subscription_id: string | null
          price_id: string | null
          status: string
          trial_ends_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_ends_at?: string | null
          doc_storage_limit_mb?: number | null
          id?: string
          paddle_customer_id?: string | null
          paddle_subscription_id?: string | null
          price_id?: string | null
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_ends_at?: string | null
          doc_storage_limit_mb?: number | null
          id?: string
          paddle_customer_id?: string | null
          paddle_subscription_id?: string | null
          price_id?: string | null
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      workspace_credit_pools: {
        Row: {
          created_at: string
          credits_allocated: number
          credits_assigned_out: number
          credits_used_direct: number
          id: string
          period: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          credits_allocated?: number
          credits_assigned_out?: number
          credits_used_direct?: number
          id?: string
          period: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          credits_allocated?: number
          credits_assigned_out?: number
          credits_used_direct?: number
          id?: string
          period?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_credit_pools_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_students: {
        // `settings` was added by 20260806120000_student_nav_visibility.sql; hand-edited here
        // because this sandbox cannot reach the Supabase project to run
        // `supabase gen types typescript`. A real regeneration should overwrite this block.
        Row: {
          created_at: string
          settings: Json
          student_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          settings?: Json
          student_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          settings?: Json
          student_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_students_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_subscriptions: {
        Row: {
          created_at: string
          current_period_ends_at: string | null
          doc_storage_limit_mb: number | null
          id: string
          paddle_customer_id: string | null
          paddle_subscription_id: string | null
          price_id: string | null
          status: string
          trial_ends_at: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          current_period_ends_at?: string | null
          doc_storage_limit_mb?: number | null
          id?: string
          paddle_customer_id?: string | null
          paddle_subscription_id?: string | null
          price_id?: string | null
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          current_period_ends_at?: string | null
          doc_storage_limit_mb?: number | null
          id?: string
          paddle_customer_id?: string | null
          paddle_subscription_id?: string | null
          price_id?: string | null
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_subscriptions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
          owner_id: string
          settings: Json
          trial_ends_at: string | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          owner_id: string
          settings?: Json
          trial_ends_at?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string
          settings?: Json
          trial_ends_at?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ai_credit_renewal_monthly: { Args: never; Returns: undefined }
      assign_credits_to_member: {
        Args: {
          _caller_user_id: string
          _credits: number
          _member_user_id: string
          _workspace_id: string
        }
        Returns: Json
      }
      assign_storage_to_member: {
        Args: {
          _caller_user_id: string
          _member_user_id: string
          _storage_limit_mb: number
          _workspace_id: string
        }
        Returns: Json
      }
      billing_run_monthly_billing: { Args: never; Returns: undefined }
      calculate_quiz_score: { Args: { attempt_id: string }; Returns: Json }
      can_attempt_quiz: {
        Args: { _quiz_id: string; _student_id: string }
        Returns: Json
      }
      can_make_ai_request: { Args: { _user_id: string }; Returns: Json }
      can_manage_student_assignment: {
        Args: {
          p_student_id: string
          p_tutor_id: string
          p_workspace_id: string
        }
        Returns: boolean
      }
      can_user_access_shared_storage_object: {
        Args: { p_file_path: string; p_user_id: string }
        Returns: boolean
      }
      can_view_student_session: {
        Args: {
          p_student_id: string
          p_tutor_id: string
          p_workspace_id: string
        }
        Returns: boolean
      }
      check_and_deduct_credits: {
        Args: {
          _credit_cost: number
          _interaction_id?: string
          _task_type: string
          _user_id: string
        }
        Returns: Json
      }
      generate_join_code: { Args: never; Returns: string }
      get_classroom_by_join_code: {
        Args: { code: string }
        Returns: {
          id: string
          name: string
          subject: string
          teacher_name: string
        }[]
      }
      get_credit_context: {
        Args: { _user_id: string }
        Returns: {
          credits_limit: number
          credits_used: number
          remaining: number
          source_id: string
          source_type: string
        }[]
      }
      get_or_create_ai_usage: {
        Args: { _month?: string; _user_id: string }
        Returns: {
          cost: number | null
          created_at: string
          id: string
          interactions_count: number | null
          limit_reached: boolean | null
          month: string
          tokens_used: number | null
          updated_at: string
          usage_limit: number | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_ai_usage"
          isOneToOne: true
          isSetofReturn: false
        }
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
      is_classroom_in_owner_workspace: {
        Args: { p_owner_id: string; p_teacher_id: string }
        Returns: boolean
      }
      is_classroom_in_workspace: {
        Args: { p_classroom_id: string; p_workspace_id: string }
        Returns: boolean
      }
      is_classroom_owned_by_owner: {
        Args: { p_classroom_id: string; p_owner_id: string }
        Returns: boolean
      }
      is_classroom_teacher: {
        Args: { _classroom_id: string; _user_id: string }
        Returns: boolean
      }
      is_document_owned_by: {
        Args: { p_doc_id: string; p_user_id: string }
        Returns: boolean
      }
      is_document_shared_with_student: {
        Args: { p_doc_id: string; p_student_id: string }
        Returns: boolean
      }
      is_document_shared_with_user: {
        Args: { p_doc_id: string; p_user_id: string }
        Returns: boolean
      }
      is_document_user_in_owner_workspace: {
        Args: { p_owner_id: string; p_user_id: string }
        Returns: boolean
      }
      is_enrolled_in_classroom: {
        Args: { _classroom_id: string; _user_id: string }
        Returns: boolean
      }
      is_enrollment_classroom_in_owner_workspace: {
        Args: { p_classroom_id: string; p_owner_id: string }
        Returns: boolean
      }
      is_one_to_one_room_in_owner_workspace: {
        Args: { p_owner_id: string; p_room_id: string }
        Returns: boolean
      }
      is_storage_object_attached_to_assignment: {
        Args: { p_file_path: string; p_student_id: string }
        Returns: boolean
      }
      is_storage_object_shared_with_student: {
        Args: { p_file_path: string; p_student_id: string }
        Returns: boolean
      }
      is_submission_in_owner_workspace: {
        Args: { p_assignment_id: string; p_owner_id: string }
        Returns: boolean
      }
      is_user_tutor_of_classroom: {
        Args: { p_classroom_id: string; p_user_id: string }
        Returns: boolean
      }
      is_workspace_member: { Args: { _workspace_id: string }; Returns: boolean }
      is_workspace_owner: { Args: { _workspace_id: string }; Returns: boolean }
      owner_can_insert_classroom: {
        Args: {
          p_owner_id: string
          p_teacher_id: string
          p_workspace_id: string
        }
        Returns: boolean
      }
      owner_can_view_member_profile: {
        Args: { _member_user_id: string }
        Returns: boolean
      }
      owner_can_view_student_profile: {
        Args: { _student_user_id: string }
        Returns: boolean
      }
      record_ai_interaction: {
        Args: {
          _cost?: number
          _error_message?: string
          _interaction_type: string
          _model: string
          _provider: string
          _success?: boolean
          _tokens_used?: number
          _user_id: string
        }
        Returns: string
      }
      start_quiz_attempt: {
        Args: { _quiz_id: string; _student_id: string }
        Returns: {
          answers: Json
          attempt_number: number
          auto_graded_at: string | null
          created_at: string
          feedback: string | null
          id: string
          manually_graded_at: string | null
          points_earned: number | null
          points_possible: number | null
          quiz_id: string
          score: number | null
          started_at: string
          status: string
          student_id: string
          submitted_at: string | null
          time_spent_seconds: number | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "quiz_attempts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      update_assigned_credits: {
        Args: {
          _caller_user_id: string
          _member_user_id: string
          _new_limit: number
          _workspace_id: string
        }
        Returns: Json
      }
      update_assigned_storage_limit: {
        Args: {
          _caller_user_id: string
          _member_user_id: string
          _new_limit_mb: number
          _workspace_id: string
        }
        Returns: Json
      }
      upsert_user_credit_allocation_subscription: {
        Args: { _credits_limit: number; _period: string; _user_id: string }
        Returns: undefined
      }
      upsert_workspace_credit_pool: {
        Args: {
          _credits_allocated: number
          _period: string
          _workspace_id: string
        }
        Returns: undefined
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
