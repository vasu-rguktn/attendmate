import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

export function useFacultyAssignments() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['faculty-assignments', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('faculty_assignments')
        .select(`
          id,
          subject_name,
          created_at,
          section:sections (
            id,
            year,
            semester,
            section_name
          )
        `)
        .eq('faculty_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  return query;
}

export function useAddAssignment() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ year, semester, sectionName, subjectName }) => {
      // 1. Find or create the section
      let { data: section, error: sectionError } = await supabase
        .from('sections')
        .select('id')
        .eq('year', year)
        .eq('semester', semester)
        .eq('section_name', sectionName)
        .single();

      if (sectionError && sectionError.code === 'PGRST116') {
        // Section doesn't exist, create it
        const { data: newSection, error: createError } = await supabase
          .from('sections')
          .insert({ year, semester, section_name: sectionName })
          .select('id')
          .single();

        if (createError) throw createError;
        section = newSection;
      } else if (sectionError) {
        throw sectionError;
      }

      // 2. Create the assignment
      const { data: assignment, error: assignError } = await supabase
        .from('faculty_assignments')
        .insert({
          faculty_id: user.id,
          section_id: section.id,
          subject_name: subjectName,
        })
        .select(`
          id,
          subject_name,
          created_at,
          section:sections (
            id,
            year,
            semester,
            section_name
          )
        `)
        .single();

      if (assignError) throw assignError;
      return assignment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faculty-assignments'] });
    },
  });
}

export function useDeleteAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assignmentId) => {
      const { error } = await supabase
        .from('faculty_assignments')
        .delete()
        .eq('id', assignmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faculty-assignments'] });
    },
  });
}

export function useTodayStatus(assignments) {
  const { user } = useAuth();
  const today = new Date().toISOString().split('T')[0];

  return useQuery({
    queryKey: ['today-status', user?.id, today],
    queryFn: async () => {
      if (!assignments || assignments.length === 0) return {};

      const { data, error } = await supabase
        .from('attendance_sessions')
        .select('id, section_id, subject_name, session_type')
        .eq('faculty_id', user.id)
        .eq('session_date', today);

      if (error) throw error;

      // Create a map: `${section_id}_${subject_name}_${session_type}` → true
      const statusMap = {};
      data?.forEach((session) => {
        const key = `${session.section_id}_${session.subject_name}`;
        statusMap[key] = true;
      });
      return statusMap;
    },
    enabled: !!user && !!assignments && assignments.length > 0,
  });
}
