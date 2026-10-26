import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';

const DEFAULT_SECTIONS = [
  { id: 'sec-cse3', section_name: 'CSE 3', year: 'E3', semester: 1 },
  { id: 'sec-cse4', section_name: 'CSE 4', year: 'E3', semester: 1 },
  { id: 'sec-cseaiml', section_name: 'CSE-AIML', year: 'E3', semester: 1 },
  { id: 'sec-cse1', section_name: 'CSE 1', year: 'E3', semester: 1 },
  { id: 'sec-cse2', section_name: 'CSE 2', year: 'E3', semester: 1 },
];

export function useSections() {
  return useQuery({
    queryKey: ['all-sections'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('sections')
          .select('*')
          .order('section_name', { ascending: true });

        if (error || !data || data.length === 0) {
          return DEFAULT_SECTIONS;
        }

        // Merge default common sections if not already present
        const map = new Map();
        data.forEach((s) => map.set(s.section_name.toUpperCase().trim(), s));
        DEFAULT_SECTIONS.forEach((ds) => {
          if (!map.has(ds.section_name.toUpperCase().trim())) {
            map.set(ds.section_name.toUpperCase().trim(), ds);
          }
        });

        return Array.from(map.values()).sort((a, b) =>
          (a.section_name || '').localeCompare(b.section_name || '', undefined, { numeric: true, sensitivity: 'base' })
        );
      } catch (e) {
        return DEFAULT_SECTIONS;
      }
    },
  });
}

