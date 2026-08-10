import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';

export function useStudents(sectionId) {
  return useQuery({
    queryKey: ['students', sectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('id, roll_number, student_id, full_name')
        .eq('section_id', sectionId);

      if (error) throw error;
      
      // Sort roll_number numerically (natural sort)
      return (data || []).sort((a, b) =>
        (a.roll_number || '').localeCompare(b.roll_number || '', undefined, { numeric: true, sensitivity: 'base' })
      );
    },
    enabled: !!sectionId,
  });
}
