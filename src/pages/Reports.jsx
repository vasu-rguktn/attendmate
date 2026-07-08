import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useStudents } from '../hooks/useStudents';
import { YEAR_LABELS, SESSION_TYPES } from '../lib/constants';
import { utils, writeFile } from 'xlsx';
import {
  ArrowLeft, Download, Calendar, Filter, Table2,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Reports() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Default to current month range
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [startDate, setStartDate] = useState(firstOfMonth.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);
  const [sessionType, setSessionType] = useState('class');

  // Fetch assignment
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

  // Fetch students
  const { data: students, isLoading: studentsLoading } = useStudents(sectionId);

  // Fetch sessions in date range
  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['report-sessions', sectionId, assignment?.subject_name, startDate, endDate, sessionType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance_sessions')
        .select(`
          id,
          session_date,
          session_type
        `)
        .eq('faculty_id', user.id)
        .eq('section_id', sectionId)
        .eq('subject_name', assignment.subject_name)
        .eq('session_type', sessionType)
        .gte('session_date', startDate)
        .lte('session_date', endDate)
        .order('session_date', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!sectionId && !!assignment?.subject_name && !!startDate && !!endDate,
  });

  // Fetch all records for those sessions
  const sessionIds = sessions?.map((s) => s.id) || [];
  const { data: records, isLoading: recordsLoading } = useQuery({
    queryKey: ['report-records', sessionIds],
    queryFn: async () => {
      if (sessionIds.length === 0) return [];
      const { data, error } = await supabase
        .from('attendance_records')
        .select('session_id, student_id, status')
        .in('session_id', sessionIds);
      if (error) throw error;
      return data || [];
    },
    enabled: sessionIds.length > 0,
  });

  // Build pivot table data
  const pivotData = useMemo(() => {
    if (!students || !sessions || !records) return null;
    if (sessions.length === 0) return { rows: [], dates: [] };

    // Build a map: sessionId -> { studentId -> status }
    const recordMap = {};
    records.forEach((r) => {
      if (!recordMap[r.session_id]) recordMap[r.session_id] = {};
      recordMap[r.session_id][r.student_id] = r.status;
    });

    const dates = sessions.map((s) => s.session_date);

    const rows = students.map((student) => {
      let presentCount = 0;
      const statuses = sessions.map((session) => {
        const status = recordMap[session.id]?.[student.id] || 'absent';
        if (status === 'present') presentCount++;
        return status;
      });

      const percentage = sessions.length > 0
        ? Math.round((presentCount / sessions.length) * 100)
        : 0;

      return {
        roll_number: student.roll_number,
        student_id: student.student_id,
        full_name: student.full_name,
        statuses,
        presentCount,
        percentage,
      };
    });

    return { rows, dates };
  }, [students, sessions, records]);

  function handleExport() {
    if (!pivotData || pivotData.rows.length === 0) {
      toast.error('No data to export.');
      return;
    }

    // Build sheet data
    const header = [
      'Roll Number', 'Student ID', 'Name',
      ...pivotData.dates.map((d) => formatDate(d)),
      'Present', 'Total', '%',
    ];

    const sheetData = [header];
    pivotData.rows.forEach((row) => {
      sheetData.push([
        row.roll_number,
        row.student_id,
        row.full_name,
        ...row.statuses.map((s) => s === 'present' ? 'P' : 'A'),
        row.presentCount,
        sessions.length,
        row.percentage,
      ]);
    });

    const ws = utils.aoa_to_sheet(sheetData);

    // Set column widths
    ws['!cols'] = [
      { wch: 12 }, { wch: 14 }, { wch: 25 },
      ...pivotData.dates.map(() => ({ wch: 10 })),
      { wch: 8 }, { wch: 6 }, { wch: 5 },
    ];

    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'Attendance');

    const typeLabel = sessionType === 'lab' ? '_Lab' : '';
    const monthLabel = formatMonthYear(startDate);
    const fileName = `${assignment.section.section_name}_${assignment.subject_name}${typeLabel}_${monthLabel}.xlsx`;

    writeFile(wb, fileName);
    toast.success('Excel file downloaded!');
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  }

  function formatMonthYear(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }).replace(' ', '');
  }

  const isLoading = assignmentLoading || studentsLoading || sessionsLoading || recordsLoading;

  if (assignmentLoading) {
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
      <div className="flex items-center gap-3 mb-6">
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
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold" style={{ color: 'var(--color-text-primary)' }}>
            Reports
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {assignment.subject_name} • {assignment.section.section_name} • {YEAR_LABELS[assignment.section.year]}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 mb-6 fade-in">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[8rem]">
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              From
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input-field"
            />
          </div>
          <div className="flex-1 min-w-[8rem]">
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              To
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              Type
            </label>
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
                    color: sessionType === t.value ? 'white' : 'var(--color-text-secondary)',
                    border: 'none',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <button onClick={handleExport} className="btn-primary" disabled={!pivotData || pivotData.rows.length === 0}>
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export Excel</span>
          </button>
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="spinner" />
        </div>
      ) : !pivotData || pivotData.dates.length === 0 ? (
        <div className="glass-card p-8 text-center fade-in">
          <div
            className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: 'var(--color-accent-soft)' }}
          >
            <Table2 className="w-7 h-7" style={{ color: 'var(--color-accent-start)' }} />
          </div>
          <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
            No sessions found
          </h3>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            No attendance sessions found for the selected date range and type.
          </p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'rgba(30, 41, 59, 0.8)' }}>
                  <th className="text-left py-3 px-3 font-semibold sticky left-0 z-10"
                    style={{
                      color: 'var(--color-text-secondary)',
                      background: 'rgba(30, 41, 59, 0.95)',
                      minWidth: '4rem',
                    }}
                  >
                    Roll
                  </th>
                  <th className="text-left py-3 px-3 font-semibold"
                    style={{ color: 'var(--color-text-secondary)', minWidth: '10rem' }}
                  >
                    Name
                  </th>
                  {pivotData.dates.map((date) => (
                    <th key={date} className="text-center py-3 px-2 font-semibold"
                      style={{ color: 'var(--color-text-secondary)', minWidth: '4rem' }}
                    >
                      {formatDate(date)}
                    </th>
                  ))}
                  <th className="text-center py-3 px-3 font-semibold"
                    style={{ color: 'var(--color-accent-start)', minWidth: '3.5rem' }}
                  >
                    %
                  </th>
                </tr>
              </thead>
              <tbody>
                {pivotData.rows.map((row) => (
                  <tr
                    key={row.roll_number}
                    style={{ borderBottom: '1px solid var(--color-border-default)' }}
                  >
                    <td className="py-2.5 px-3 font-medium sticky left-0 z-10"
                      style={{
                        color: 'var(--color-text-primary)',
                        background: 'var(--color-bg-secondary)',
                      }}
                    >
                      {row.roll_number}
                    </td>
                    <td className="py-2.5 px-3 truncate" style={{ color: 'var(--color-text-primary)' }}>
                      {row.full_name}
                    </td>
                    {row.statuses.map((status, i) => (
                      <td key={i} className="text-center py-2.5 px-2">
                        <span
                          className="inline-block w-7 h-7 rounded-lg text-xs font-bold leading-7"
                          style={{
                            background: status === 'present'
                              ? 'rgba(16, 185, 129, 0.15)'
                              : 'rgba(239, 68, 68, 0.1)',
                            color: status === 'present'
                              ? 'var(--color-success)'
                              : 'var(--color-danger)',
                          }}
                        >
                          {status === 'present' ? 'P' : 'A'}
                        </span>
                      </td>
                    ))}
                    <td className="text-center py-2.5 px-3 font-bold"
                      style={{
                        color: row.percentage >= 75
                          ? 'var(--color-success)'
                          : row.percentage >= 50
                          ? 'var(--color-warning)'
                          : 'var(--color-danger)',
                      }}
                    >
                      {row.percentage}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary */}
          <div className="p-4 flex items-center justify-between text-sm"
            style={{
              borderTop: '1px solid var(--color-border-default)',
              background: 'rgba(30, 41, 59, 0.5)',
            }}
          >
            <span style={{ color: 'var(--color-text-secondary)' }}>
              {pivotData.rows.length} students • {pivotData.dates.length} sessions
            </span>
            <button onClick={handleExport} className="btn-primary text-sm py-2">
              <Download className="w-4 h-4" />
              Download .xlsx
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
