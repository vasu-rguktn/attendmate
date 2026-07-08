import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useStudents } from '../hooks/useStudents';
import { useAttendanceSession } from '../hooks/useAttendanceSession';
import { useAuth } from '../context/AuthContext';
import SeatTile from '../components/SeatTile';
import { SESSION_TYPES, YEAR_LABELS } from '../lib/constants';
import {
  ArrowLeft, Save, CheckSquare, RotateCcw, Users, Calendar,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function AttendanceGrid() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [sessionType, setSessionType] = useState('class');
  const [attendanceMap, setAttendanceMap] = useState({}); // studentId -> 'present' | 'absent'

  // Fetch the assignment details
  const { data: assignment, isLoading: assignmentLoading } = useQuery({
    queryKey: ['assignment', assignmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('faculty_assignments')
        .select(`
          id,
          subject_name,
          section:sections (
            id,
            year,
            semester,
            section_name
          )
        `)
        .eq('id', assignmentId)
        .eq('faculty_id', user.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!assignmentId && !!user,
  });

  const sectionId = assignment?.section?.id;

  // Fetch students for this section
  const { data: students, isLoading: studentsLoading } = useStudents(sectionId);

  // Fetch existing session for this date/type
  const {
    existingRecords,
    isLoading: sessionLoading,
    saveAttendance,
    isSaving,
  } = useAttendanceSession({
    sectionId,
    subjectName: assignment?.subject_name,
    sessionDate,
    sessionType,
  });

  // Initialize attendance map from students (all absent by default)
  useEffect(() => {
    if (!students || students.length === 0) return;

    const map = {};
    students.forEach((s) => {
      map[s.id] = 'absent';
    });

    // Overlay any existing records
    if (existingRecords && existingRecords.length > 0) {
      existingRecords.forEach((rec) => {
        if (map.hasOwnProperty(rec.student_id)) {
          map[rec.student_id] = rec.status;
        }
      });
    }

    setAttendanceMap(map);
  }, [students, existingRecords]);

  const toggleStudent = useCallback((studentId) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: prev[studentId] === 'present' ? 'absent' : 'present',
    }));
  }, []);

  const markAllPresent = useCallback(() => {
    setAttendanceMap((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => { next[key] = 'present'; });
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    setAttendanceMap((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => { next[key] = 'absent'; });
      return next;
    });
  }, []);

  const presentCount = useMemo(() => {
    return Object.values(attendanceMap).filter((s) => s === 'present').length;
  }, [attendanceMap]);

  const totalCount = students?.length || 0;

  async function handleSubmit() {
    try {
      await saveAttendance({ attendanceMap });
      toast.success(`Attendance saved! ${presentCount}/${totalCount} present.`);
    } catch (err) {
      toast.error('Failed to save attendance. Please try again.');
      console.error(err);
    }
  }

  const isLoading = assignmentLoading || studentsLoading || sessionLoading;

  if (isLoading) {
    return (
      <div className="page-container flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="page-container">
        <div className="glass-card p-6 text-center">
          <p style={{ color: 'var(--color-danger)' }}>Assignment not found.</p>
          <button onClick={() => navigate('/dashboard')} className="btn-primary mt-4">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => navigate('/dashboard')}
          className="p-2 rounded-xl cursor-pointer"
          style={{
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border-default)',
            color: 'var(--color-text-secondary)',
          }}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-extrabold truncate" style={{ color: 'var(--color-text-primary)' }}>
            {assignment.subject_name}
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {assignment.section.section_name} • {YEAR_LABELS[assignment.section.year]}
          </p>
        </div>
      </div>

      {/* Controls row */}
      <div className="glass-card p-4 mb-4 fade-in">
        <div className="flex flex-wrap items-center gap-3">
          {/* Date picker */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }} />
            <input
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              className="input-field"
              style={{ width: 'auto', minWidth: '9rem' }}
            />
          </div>

          {/* Session type toggle */}
          <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border-default)' }}>
            {SESSION_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setSessionType(t.value)}
                className="px-4 py-2 text-sm font-semibold cursor-pointer transition-all"
                style={{
                  background: sessionType === t.value
                    ? 'linear-gradient(135deg, var(--color-accent-start), var(--color-accent-end))'
                    : 'transparent',
                  color: sessionType === t.value
                    ? 'white'
                    : 'var(--color-text-secondary)',
                  border: 'none',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Quick actions */}
          <div className="flex gap-2">
            <button onClick={markAllPresent} className="btn-secondary text-xs py-2 px-3">
              <CheckSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">All Present</span>
            </button>
            <button onClick={resetAll} className="btn-secondary text-xs py-2 px-3">
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          </div>
        </div>
      </div>

      {/* Counter */}
      <div className="glass-card p-4 mb-4 flex items-center justify-between fade-in" style={{ animationDelay: '0.05s' }}>
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5" style={{ color: 'var(--color-accent-start)' }} />
          <span className="font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>
            Present:
            <span className="text-gradient ml-1.5">{presentCount}</span>
            <span style={{ color: 'var(--color-text-muted)' }}> / {totalCount}</span>
          </span>
        </div>
        <div className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
          {totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0}%
        </div>
      </div>

      {/* Seat grid */}
      {totalCount === 0 ? (
        <div className="glass-card p-8 text-center fade-in">
          <p className="text-lg font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
            No students found
          </p>
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            Upload a roster for this section first.
          </p>
          <button
            onClick={() => navigate(`/roster/${sectionId}`)}
            className="btn-primary"
          >
            Upload Roster
          </button>
        </div>
      ) : (
        <div
          className="grid gap-2 mb-6 fade-in"
          style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(3.5rem, 1fr))',
            animationDelay: '0.1s',
          }}
        >
          {students.map((student) => (
            <SeatTile
              key={student.id}
              rollNumber={student.roll_number}
              studentName={student.full_name}
              isPresent={attendanceMap[student.id] === 'present'}
              onToggle={() => toggleStudent(student.id)}
            />
          ))}
        </div>
      )}

      {/* Submit button */}
      {totalCount > 0 && (
        <div className="sticky bottom-4 z-10">
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="btn-primary w-full py-4 text-base"
            style={{
              boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.4)',
            }}
          >
            {isSaving ? (
              <div className="spinner" style={{ width: '1.25rem', height: '1.25rem', borderWidth: '2px' }} />
            ) : (
              <>
                <Save className="w-5 h-5" />
                Submit Attendance ({presentCount}/{totalCount})
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
