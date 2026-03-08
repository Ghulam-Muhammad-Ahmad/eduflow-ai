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
      ai_interactions: {
        Row: {
          id: string
          user_id: string
          interaction_type: string
          provider: string
          model: string
          tokens_used: number | null
          cost: number | null
          request_data: Json | null
          response_data: Json | null
          success: boolean | null
          error_message: string | null
          created_at: string
          credits_deducted: number | null
        }
        Insert: {
          id?: string
          user_id: string
          interaction_type: string
          provider: string
          model: string
          tokens_used?: number | null
          cost?: number | null
          request_data?: Json | null
          response_data?: Json | null
          success?: boolean | null
          error_message?: string | null
          created_at?: string
          credits_deducted?: number | null
        }
        Update: {
          id?: string
          user_id?: string
          interaction_type?: string
          provider?: string
          model?: string
          tokens_used?: number | null
          cost?: number | null
          request_data?: Json | null
          response_data?: Json | null
          success?: boolean | null
          error_message?: string | null
          created_at?: string
          credits_deducted?: number | null
        }
        Relationships: []
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
          description?: string | null
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
          description?: string | null
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
        Relationships: []
      }
      classroom_tutors: {
        Row: {
          classroom_id: string
          user_id: string
          created_at: string
        }
        Insert: {
          classroom_id: string
          user_id: string
          created_at?: string
        }
        Update: {
          classroom_id?: string
          user_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classroom_tutors_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classroom_tutors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
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
      source_documents: {
        Row: {
          created_at: string
          description: string | null
          document_type: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          teacher_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          document_type: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          teacher_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          document_type?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          teacher_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
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
          bio: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
          user_id: string
          account_type: "business" | "student" | "tutor" | null
          onboarding_completed_at: string | null
          password_changed_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id: string
          account_type?: "business" | "student" | "tutor" | null
          onboarding_completed_at?: string | null
          password_changed_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id?: string
          account_type?: "business" | "student" | "tutor" | null
          onboarding_completed_at?: string | null
          password_changed_at?: string | null
        }
        Relationships: []
      }
      tutor_contracts: {
        Row: {
          id: string
          workspace_id: string
          tutor_id: string
          contract_status: string
          pay_type: string
          rate_amount: number
          rate_currency: string
          subjects: Json
          contract_body_text: string | null
          contract_storage_path: string | null
          contract_signed_at: string | null
          tutor_signature_name: string | null
          change_requested_at: string | null
          change_request_note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          tutor_id: string
          contract_status?: string
          pay_type?: string
          rate_amount?: number
          rate_currency?: string
          subjects?: Json
          contract_body_text?: string | null
          contract_storage_path?: string | null
          contract_signed_at?: string | null
          tutor_signature_name?: string | null
          change_requested_at?: string | null
          change_request_note?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          tutor_id?: string
          contract_status?: string
          pay_type?: string
          rate_amount?: number
          rate_currency?: string
          subjects?: Json
          contract_body_text?: string | null
          contract_storage_path?: string | null
          contract_signed_at?: string | null
          tutor_signature_name?: string | null
          change_requested_at?: string | null
          change_request_note?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      workspaces: {
        Row: {
          id: string
          name: string
          type: "business" | "solo"
          owner_id: string
          created_at: string
          updated_at: string
          settings: Json
          trial_ends_at: string | null
          logo_url: string | null
        }
        Insert: {
          id?: string
          name: string
          type: "business" | "solo"
          owner_id: string
          created_at?: string
          updated_at?: string
          settings?: Json
          trial_ends_at?: string | null
          logo_url?: string | null
        }
        Update: {
          name?: string
          type?: "business" | "solo"
          owner_id?: string
          updated_at?: string
          settings?: Json
          trial_ends_at?: string | null
          logo_url?: string | null
        }
        Relationships: []
      }
      workspace_members: {
        Row: {
          id: string
          workspace_id: string
          user_id: string
          role: "owner" | "tutor"
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          user_id: string
          role: "owner" | "tutor"
          created_at?: string
        }
        Update: {
          workspace_id?: string
          user_id?: string
          role?: "owner" | "tutor"
        }
        Relationships: []
      }
      tutor_student_assignments: {
        Row: {
          id: string
          workspace_id: string
          tutor_id: string
          student_id: string
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          tutor_id: string
          student_id: string
          created_at?: string
        }
        Update: {
          workspace_id?: string
          tutor_id?: string
          student_id?: string
        }
        Relationships: []
      }
      workspace_subscriptions: {
        Row: {
          id: string
          workspace_id: string
          paddle_subscription_id: string | null
          paddle_customer_id: string | null
          price_id: string | null
          status: string
          current_period_ends_at: string | null
          trial_ends_at: string | null
          doc_storage_limit_mb: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          paddle_subscription_id?: string | null
          paddle_customer_id?: string | null
          price_id?: string | null
          status?: string
          current_period_ends_at?: string | null
          trial_ends_at?: string | null
          doc_storage_limit_mb?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          workspace_id?: string
          paddle_subscription_id?: string | null
          paddle_customer_id?: string | null
          price_id?: string | null
          status?: string
          current_period_ends_at?: string | null
          trial_ends_at?: string | null
          doc_storage_limit_mb?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      workspace_credit_pools: {
        Row: {
          id: string
          workspace_id: string
          period: string
          credits_allocated: number
          credits_assigned_out: number
          credits_used_direct: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          period: string
          credits_allocated?: number
          credits_assigned_out?: number
          credits_used_direct?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          workspace_id?: string
          period?: string
          credits_allocated?: number
          credits_assigned_out?: number
          credits_used_direct?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_credit_allocations: {
        Row: {
          id: string
          user_id: string
          period: string
          source_type: string
          source_id: string
          credits_limit: number
          credits_used: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          period: string
          source_type: string
          source_id: string
          credits_limit?: number
          credits_used?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          period?: string
          source_type?: string
          source_id?: string
          credits_limit?: number
          credits_used?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          id: string
          user_id: string
          paddle_subscription_id: string | null
          paddle_customer_id: string | null
          price_id: string | null
          status: string
          current_period_ends_at: string | null
          trial_ends_at: string | null
          doc_storage_limit_mb: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          paddle_subscription_id?: string | null
          paddle_customer_id?: string | null
          price_id?: string | null
          status?: string
          current_period_ends_at?: string | null
          trial_ends_at?: string | null
          doc_storage_limit_mb?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          paddle_subscription_id?: string | null
          paddle_customer_id?: string | null
          price_id?: string | null
          status?: string
          current_period_ends_at?: string | null
          trial_ends_at?: string | null
          doc_storage_limit_mb?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      user_storage_allocations: {
        Row: {
          id: string
          workspace_id: string
          user_id: string
          storage_limit_mb: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          user_id: string
          storage_limit_mb?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          workspace_id?: string
          user_id?: string
          storage_limit_mb?: number
          updated_at?: string
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
        Relationships: [
          {
            foreignKeyName: "google_calendar_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
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
          {
            foreignKeyName: "session_series_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_series_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_series_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
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
            isOneToOne: false
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
          {
            foreignKeyName: "session_financial_mock_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_financial_mock_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_financial_mock_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
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
            isOneToOne: false
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
          {
            foreignKeyName: "session_notes_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_notes_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_notes_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          classroom_id: string | null
          completed_at: string | null
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
          title: string
          tutor_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          classroom_id?: string | null
          completed_at?: string | null
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
          title: string
          tutor_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          classroom_id?: string | null
          completed_at?: string | null
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
            foreignKeyName: "sessions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
            foreignKeyName: "sessions_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
      get_credit_context: {
        Args: { _user_id: string }
        Returns: {
          credits_limit: number
          credits_used: number
          remaining: number
          source_type: string
          source_id: string
        }[]
      }
      assign_storage_to_member: {
        Args: {
          _workspace_id: string
          _member_user_id: string
          _storage_limit_mb: number
          _caller_user_id: string
        }
        Returns: Json
      }
      assign_credits_to_member: {
        Args: {
          _workspace_id: string
          _member_user_id: string
          _credits: number
          _caller_user_id: string
        }
        Returns: Json
      }
      check_and_deduct_credits: {
        Args: {
          _user_id: string
          _task_type: string
          _credit_cost: number
          _interaction_id?: string | null
        }
        Returns: Json
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
      update_assigned_storage_limit: {
        Args: {
          _workspace_id: string
          _member_user_id: string
          _new_limit_mb: number
          _caller_user_id: string
        }
        Returns: Json
      }
      update_assigned_credits: {
        Args: {
          _workspace_id: string
          _member_user_id: string
          _new_limit: number
          _caller_user_id: string
        }
        Returns: Json
      }
      upsert_user_credit_allocation_subscription: {
        Args: {
          _user_id: string
          _period: string
          _credits_limit: number
        }
        Returns: undefined
      }
      upsert_workspace_credit_pool: {
        Args: {
          _workspace_id: string
          _period: string
          _credits_allocated: number
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
