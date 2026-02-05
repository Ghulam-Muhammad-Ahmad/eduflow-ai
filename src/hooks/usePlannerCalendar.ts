import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  suggestCalendarEventsFromPrompt,
  type CalendarEventSuggestion,
} from '@/services/aiService';

export interface PlannerEvent {
  id: string;
  teacher_id: string;
  title: string;
  start_at: string;
  end_at: string;
  all_day: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlannerEventInsert {
  title: string;
  start_at: string;
  end_at: string;
  all_day?: boolean;
  description?: string | null;
}

export function usePlannerCalendar() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [events, setEvents] = useState<PlannerEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  const fetchEvents = useCallback(
    async (start: Date, end: Date) => {
      if (!user?.id) return [];
      setLoading(true);
      try {
        const startIso = start.toISOString();
        const endIso = end.toISOString();
        // Fetch events that overlap the range: event.end >= start AND event.start <= end
        const { data, error } = await supabase
          .from('planner_events')
          .select('*')
          .eq('teacher_id', user.id)
          .lte('start_at', endIso)
          .gte('end_at', startIso)
          .order('start_at', { ascending: true });

        if (error) throw error;
        setEvents((data as PlannerEvent[]) || []);
        return (data as PlannerEvent[]) || [];
      } catch (e: any) {
        toast({
          title: 'Error',
          description: e.message || 'Failed to load events',
          variant: 'destructive',
        });
        return [];
      } finally {
        setLoading(false);
      }
    },
    [user?.id, toast]
  );

  const addEvent = useCallback(
    async (event: PlannerEventInsert) => {
      if (!user?.id) return null;
      try {
        const { data, error } = await supabase
          .from('planner_events')
          .insert({
            teacher_id: user.id,
            title: event.title,
            start_at: event.start_at,
            end_at: event.end_at,
            all_day: event.all_day ?? false,
            description: event.description ?? null,
          })
          .select()
          .single();

        if (error) throw error;
        setEvents((prev) => [...prev, data as PlannerEvent]);
        toast({ title: 'Event added', description: event.title });
        return data as PlannerEvent;
      } catch (e: any) {
        toast({
          title: 'Error',
          description: e.message || 'Failed to add event',
          variant: 'destructive',
        });
        return null;
      }
    },
    [user?.id, toast]
  );

  const addEvents = useCallback(
    async (items: PlannerEventInsert[]) => {
      if (!user?.id || items.length === 0) return;
      try {
        const rows = items.map((e) => ({
          teacher_id: user.id,
          title: e.title,
          start_at: e.start_at,
          end_at: e.end_at,
          all_day: e.all_day ?? false,
          description: e.description ?? null,
        }));
        const { data, error } = await supabase
          .from('planner_events')
          .insert(rows)
          .select();

        if (error) throw error;
        const newEvents = (data as PlannerEvent[]) || [];
        setEvents((prev) => [...prev, ...newEvents]);
        toast({
          title: 'Events added',
          description: `${newEvents.length} event(s) added to your calendar.`,
        });
      } catch (e: any) {
        toast({
          title: 'Error',
          description: e.message || 'Failed to add events',
          variant: 'destructive',
        });
      }
    },
    [user?.id, toast]
  );

  const updateEvent = useCallback(
    async (id: string, updates: Partial<PlannerEventInsert>) => {
      if (!user?.id) return null;
      try {
        const { data, error } = await supabase
          .from('planner_events')
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .eq('teacher_id', user.id)
          .select()
          .single();

        if (error) throw error;
        setEvents((prev) =>
          prev.map((e) => (e.id === id ? (data as PlannerEvent) : e))
        );
        toast({ title: 'Event updated' });
        return data as PlannerEvent;
      } catch (e: any) {
        toast({
          title: 'Error',
          description: e.message || 'Failed to update event',
          variant: 'destructive',
        });
        return null;
      }
    },
    [user?.id, toast]
  );

  const deleteEvent = useCallback(
    async (id: string) => {
      if (!user?.id) return;
      try {
        const { error } = await supabase
          .from('planner_events')
          .delete()
          .eq('id', id)
          .eq('teacher_id', user.id);

        if (error) throw error;
        setEvents((prev) => prev.filter((e) => e.id !== id));
        toast({ title: 'Event removed' });
      } catch (e: any) {
        toast({
          title: 'Error',
          description: e.message || 'Failed to delete event',
          variant: 'destructive',
        });
      }
    },
    [user?.id, toast]
  );

  const suggestEvents = useCallback(
    async (prompt: string): Promise<CalendarEventSuggestion[]> => {
      if (!user?.id) return [];
      setSuggesting(true);
      try {
        const result = await suggestCalendarEventsFromPrompt(prompt, user.id);
        if (!result.success || !result.events?.length) {
          toast({
            title: 'No events generated',
            description: result.error || 'Try describing events more clearly.',
            variant: 'destructive',
          });
          return [];
        }
        return result.events;
      } catch {
        toast({
          title: 'Error',
          description: 'Failed to get AI suggestions',
          variant: 'destructive',
        });
        return [];
      } finally {
        setSuggesting(false);
      }
    },
    [user?.id, toast]
  );

  return {
    events,
    loading,
    suggesting,
    fetchEvents,
    addEvent,
    addEvents,
    updateEvent,
    deleteEvent,
    suggestEvents,
  };
}
