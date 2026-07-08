import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

export function useAttendanceSession({ sectionId, subjectName, sessionDate, sessionType }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch existing session + records for this date/section/subject/type
  const sessionQuery = useQuery({
    queryKey: ['attendance-session', sectionId, subjectName, sessionDate, sessionType],
    queryFn: async () => {
      // Get the session
      const { data: session, error: sessionError } = await supabase
        .from('attendance_sessions')
        .select('id')
        .eq('faculty_id', user.id)
        .eq('section_id', sectionId)
        .eq('subject_name', subjectName)
        .eq('session_date', sessionDate)
        .eq('session_type', sessionType)
        .maybeSingle();

      if (sessionError) throw sessionError;
      if (!session) return { session: null, records: [] };

      // Get the records for this session
      const { data: records, error: recordsError } = await supabase
        .from('attendance_records')
        .select('student_id, status')
        .eq('session_id', session.id);

      if (recordsError) throw recordsError;

      return { session, records: records || [] };
    },
    enabled: !!user && !!sectionId && !!subjectName && !!sessionDate && !!sessionType,
  });

  // Save attendance: upsert session + upsert all records
  const saveMutation = useMutation({
    mutationFn: async ({ attendanceMap }) => {
      // attendanceMap: { studentId: 'present' | 'absent' }

      // 1. Upsert the session
      const { data: session, error: sessionError } = await supabase
        .from('attendance_sessions')
        .upsert(
          {
            faculty_id: user.id,
            section_id: sectionId,
            subject_name: subjectName,
            session_date: sessionDate,
            session_type: sessionType,
          },
          { onConflict: 'faculty_id,section_id,subject_name,session_date,session_type' }
        )
        .select('id')
        .single();

      if (sessionError) throw sessionError;

      // 2. Prepare records
      const records = Object.entries(attendanceMap).map(([studentId, status]) => ({
        session_id: session.id,
        student_id: studentId,
        status,
      }));

      // 3. Upsert all records
      const { error: recordsError } = await supabase
        .from('attendance_records')
        .upsert(records, { onConflict: 'session_id,student_id' });

      if (recordsError) throw recordsError;

      return session;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-session', sectionId, subjectName, sessionDate, sessionType] });
      queryClient.invalidateQueries({ queryKey: ['today-status'] });
    },
  });

  return {
    existingSession: sessionQuery.data?.session ?? null,
    existingRecords: sessionQuery.data?.records ?? [],
    isLoading: sessionQuery.isLoading,
    saveAttendance: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
  };
}
