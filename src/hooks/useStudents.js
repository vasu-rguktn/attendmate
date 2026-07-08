import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';

export function useStudents(sectionId) {
  return useQuery({
    queryKey: ['students', sectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('id, roll_number, student_id, full_name')
        .eq('section_id', sectionId)
        .order('roll_number', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!sectionId,
  });
}
