import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useStudents } from '../hooks/useStudents';
import { useSections } from '../hooks/useSections';
import { useFacultyAssignments } from '../hooks/useFacultyAssignments';
import { YEAR_LABELS } from '../lib/constants';
import { utils, writeFile } from 'xlsx';
import {
  ArrowLeft,
  Download,
  Save,
  Award,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Sparkles,
  RotateCcw,
  Upload,
  BookOpen,
  FileSpreadsheet,
  Check,
  ChevronDown,
  UserCheck,
  Sliders,
  AlertCircle,
  HelpCircle,
  Printer
} from 'lucide-react';
import toast from 'react-hot-toast';

// Quick remark suggestions for faculty
const QUICK_REMARKS = [
  '⭐ Excellent presentation',
  '👏 Great confidence & voice',
  '💡 Good content & teamwork',
  '🎯 Clear dialogue delivery',
  '👍 Good effort',
  '📈 Needs more practice',
  '🗣️ Improve voice modulation',
  '⚠️ Low participation',
];

export default function RolePlayMarks() {
  const { sectionId: urlSectionId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, faculty } = useAuth();

  // Faculty assignments (for quick section pills)
  const { data: assignments, isLoading: assignmentsLoading } = useFacultyAssignments();
  
  // All sections list (for selecting any section e.g. CSE 3, CSE 4, CSE-AIML)
  const { data: allSections, isLoading: sectionsLoading } = useSections();

  // Determine active sectionId
  const initialSectionId = urlSectionId || searchParams.get('section') || '';
  const [selectedSectionId, setSelectedSectionId] = useState(initialSectionId);

  // Activity configuration
  const [activityTitle, setActivityTitle] = useState('Role-Play Activity: Communication & Scenario');
  const [maxMarks, setMaxMarks] = useState(20);
  const [activityDate, setActivityDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Search and filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'graded' | 'pending'

  // Marks map: { [studentId]: { marks: string | number, remarks: string } }
  const [marksMap, setMarksMap] = useState({});
  const [lastSavedTime, setLastSavedTime] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Active remark suggestion popover state
  const [activeRemarkStudentId, setActiveRemarkStudentId] = useState(null);

  // Sync state if urlSectionId changes
  useEffect(() => {
    if (urlSectionId && urlSectionId !== selectedSectionId) {
      setSelectedSectionId(urlSectionId);
    }
  }, [urlSectionId]);

  // Set default section if none selected and assignments exist
  useEffect(() => {
    if (!selectedSectionId && assignments && assignments.length > 0) {
      const defaultId = assignments[0].section?.id;
      if (defaultId) {
        setSelectedSectionId(defaultId);
      }
    }
  }, [assignments, selectedSectionId]);

  // Combine unique sections from assignments & allSections for the selector
  const availableSections = useMemo(() => {
    const map = new Map();
    // Add faculty assigned sections first with a tag
    assignments?.forEach((a) => {
      if (a.section) {
        map.set(a.section.id, {
          ...a.section,
          assignedSubject: a.subject_name,
          isAssigned: true,
        });
      }
    });
    // Add all other sections from DB
    allSections?.forEach((s) => {
      if (!map.has(s.id)) {
        map.set(s.id, {
          ...s,
          isAssigned: false,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) =>
      (a.section_name || '').localeCompare(b.section_name || '', undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [assignments, allSections]);

  // Get currently selected section details
  const currentSection = useMemo(() => {
    return availableSections.find((s) => s.id === selectedSectionId);
  }, [availableSections, selectedSectionId]);

  // Fetch students for the selected section
  const {
    data: students,
    isLoading: studentsLoading,
    error: studentsError,
  } = useStudents(selectedSectionId);

  // Storage key for local persistence
  const storageKey = useMemo(() => {
    if (!selectedSectionId) return null;
    return `roleplay_marks_${selectedSectionId}_${activityTitle.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  }, [selectedSectionId, activityTitle]);

  // Load marks from storage on section/activity change
  useEffect(() => {
    if (!selectedSectionId || !students) return;

    let initialMap = {};
    // Pre-populate keys for all students
    students.forEach((s) => {
      initialMap[s.id] = { marks: '', remarks: '' };
    });

    if (storageKey) {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object') {
            students.forEach((s) => {
              if (parsed[s.id]) {
                initialMap[s.id] = {
                  marks: parsed[s.id].marks ?? '',
                  remarks: parsed[s.id].remarks ?? '',
                };
              }
            });
            setLastSavedTime(parsed._meta?.savedAt ? new Date(parsed._meta.savedAt) : new Date());
          }
        }
      } catch (e) {
        console.warn('Error reading from localStorage:', e);
      }
    }

    setMarksMap(initialMap);
  }, [selectedSectionId, storageKey, students]);

  // Auto-save debounced to localStorage
  useEffect(() => {
    if (!storageKey || !students || Object.keys(marksMap).length === 0) return;

    const timer = setTimeout(() => {
      try {
        const payload = {
          ...marksMap,
          _meta: {
            activityTitle,
            maxMarks,
            activityDate,
            sectionId: selectedSectionId,
            sectionName: currentSection?.section_name,
            savedAt: new Date().toISOString(),
          },
        };
        localStorage.setItem(storageKey, JSON.stringify(payload));
        setLastSavedTime(new Date());
      } catch (err) {
        console.warn('Failed to auto-save to localStorage', err);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [marksMap, storageKey, activityTitle, maxMarks, activityDate, selectedSectionId, currentSection, students]);

  // Manual save handler
  async function handleManualSave() {
    if (!storageKey) return;
    setIsSaving(true);
    try {
      const payload = {
        ...marksMap,
        _meta: {
          activityTitle,
          maxMarks,
          activityDate,
          sectionId: selectedSectionId,
          sectionName: currentSection?.section_name,
          savedAt: new Date().toISOString(),
        },
      };
      localStorage.setItem(storageKey, JSON.stringify(payload));
      setLastSavedTime(new Date());

      // Attempt Supabase sync if table exists
      try {
        const rowsToUpsert = students.map((s) => {
          const entry = marksMap[s.id] || { marks: '', remarks: '' };
          return {
            faculty_id: user?.id,
            section_id: selectedSectionId,
            student_id: s.id,
            roll_number: s.roll_number,
            activity_title: activityTitle,
            marks_obtained: entry.marks !== '' ? Number(entry.marks) : null,
            max_marks: Number(maxMarks),
            remarks: entry.remarks || '',
            evaluation_date: activityDate,
          };
        }).filter((r) => r.marks_obtained !== null || r.remarks !== '');

        if (rowsToUpsert.length > 0) {
          // Attempt upsert (silently catch if custom table is not created yet)
          await supabase.from('roleplay_marks').upsert(rowsToUpsert, {
            onConflict: 'section_id, student_id, activity_title',
          });
        }
      } catch (dbErr) {
        // Fallback is already saved in localStorage, notify user calmly
        console.info('Supabase sync skipped (local storage verified):', dbErr?.message || dbErr);
      }

      toast.success('Marks and remarks saved successfully!');
    } catch (e) {
      toast.error('Failed to save marks');
    } finally {
      setIsSaving(false);
    }
  }

  // Update a student's marks or remarks
  function handleMarkChange(studentId, val) {
    if (val !== '') {
      const num = Number(val);
      if (isNaN(num)) return;
      if (num < 0) val = '0';
      if (num > maxMarks) val = String(maxMarks);
    }
    setMarksMap((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { remarks: '' }),
        marks: val,
      },
    }));
  }

  function handleRemarkChange(studentId, val) {
    setMarksMap((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { marks: '' }),
        remarks: val,
      },
    }));
  }

  function selectQuickRemark(studentId, remarkText) {
    setMarksMap((prev) => {
      const current = prev[studentId]?.remarks || '';
      const newRemarks = current ? `${current}, ${remarkText}` : remarkText;
      return {
        ...prev,
        [studentId]: {
          ...(prev[studentId] || { marks: '' }),
          remarks: newRemarks,
        },
      };
    });
    setActiveRemarkStudentId(null);
  }

  // Batch actions
  function handleFillDefaultMarks() {
    const defaultVal = prompt(`Enter default marks for all students (Max: ${maxMarks}):`, String(Math.round(maxMarks * 0.75)));
    if (defaultVal === null) return;
    const num = Number(defaultVal);
    if (isNaN(num) || num < 0 || num > maxMarks) {
      toast.error(`Please enter a valid number between 0 and ${maxMarks}`);
      return;
    }

    setMarksMap((prev) => {
      const next = { ...prev };
      students?.forEach((s) => {
        next[s.id] = {
          ...(next[s.id] || { remarks: '' }),
          marks: String(num),
        };
      });
      return next;
    });
    toast.success(`Set marks to ${num} for all students`);
  }

  function handleClearAll() {
    if (!confirm('Are you sure you want to clear all entered marks and remarks for this activity?')) return;
    const cleared = {};
    students?.forEach((s) => {
      cleared[s.id] = { marks: '', remarks: '' };
    });
    setMarksMap(cleared);
    toast.success('Marks cleared');
  }

  // Compute stats
  const stats = useMemo(() => {
    if (!students || students.length === 0) {
      return { total: 0, graded: 0, avg: 0, max: 0, min: 0, percent: 0 };
    }
    let gradedCount = 0;
    let sum = 0;
    let maxScored = -Infinity;
    let minScored = Infinity;

    students.forEach((s) => {
      const entry = marksMap[s.id];
      if (entry && entry.marks !== '' && entry.marks !== undefined && entry.marks !== null) {
        const val = Number(entry.marks);
        if (!isNaN(val)) {
          gradedCount++;
          sum += val;
          if (val > maxScored) maxScored = val;
          if (val < minScored) minScored = val;
        }
      }
    });

    return {
      total: students.length,
      graded: gradedCount,
      avg: gradedCount > 0 ? (sum / gradedCount).toFixed(1) : 0,
      max: gradedCount > 0 ? maxScored : 0,
      min: gradedCount > 0 ? minScored : 0,
      percent: Math.round((gradedCount / students.length) * 100),
    };
  }, [students, marksMap]);

  // Filtered student list
  const filteredStudents = useMemo(() => {
    if (!students) return [];

    return students.filter((s) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (s.full_name || '').toLowerCase().includes(q) ||
        (s.roll_number || '').toLowerCase().includes(q) ||
        (s.student_id || '').toLowerCase().includes(q);

      if (!matchesSearch) return false;

      const entry = marksMap[s.id];
      const hasMarks = entry && entry.marks !== '' && entry.marks !== undefined;

      if (statusFilter === 'graded') return hasMarks;
      if (statusFilter === 'pending') return !hasMarks;
      return true;
    });
  }, [students, searchQuery, statusFilter, marksMap]);

  // Helper for performance badge color
  function getGradeBadge(marks) {
    if (marks === '' || marks === undefined || marks === null) {
      return { label: 'Pending', color: 'badge-secondary' };
    }
    const score = Number(marks);
    const ratio = maxMarks > 0 ? score / maxMarks : 0;
    if (ratio >= 0.85) return { label: 'Excellent', color: 'badge-success' };
    if (ratio >= 0.70) return { label: 'Good', color: 'badge-primary' };
    if (ratio >= 0.50) return { label: 'Average', color: 'badge-warning' };
    return { label: 'Needs Improvement', color: 'badge-danger' };
  }

  // Export to Excel (.xlsx)
  function handleExportExcel() {
    if (!students || students.length === 0) {
      toast.error('No student data to export.');
      return;
    }

    const sectionName = currentSection?.section_name || 'Section';
    const yearSem = currentSection?.year ? `${YEAR_LABELS[currentSection.year] || currentSection.year} Sem ${currentSection.semester || 1}` : '';
    const facultyName = faculty?.full_name || user?.email?.split('@')[0] || 'Faculty';

    // 1. Meta / Information Header Block
    const sheetData = [
      ['ATTENDMATE — ROLE-PLAY MARKS EVALUATION SHEET'],
      ['Section:', `${sectionName} (${yearSem})`],
      ['Activity / Topic:', activityTitle],
      ['Maximum Marks:', maxMarks],
      ['Evaluation Date:', activityDate],
      ['Faculty Evaluator:', facultyName],
      [''], // empty row
      [
        'S.No',
        'Roll Number',
        'Student ID',
        'Student Name',
        'Marks Obtained',
        'Max Marks',
        'Percentage (%)',
        'Performance Grade',
        'Remarks / Feedback',
      ],
    ];

    // 2. Student Rows
    students.forEach((s, idx) => {
      const entry = marksMap[s.id] || { marks: '', remarks: '' };
      const marksVal = entry.marks !== '' ? Number(entry.marks) : '';
      const percentage = marksVal !== '' && maxMarks > 0 ? `${Math.round((marksVal / maxMarks) * 100)}%` : 'N/A';
      const grade = getGradeBadge(entry.marks).label;

      sheetData.push([
        idx + 1,
        s.roll_number,
        s.student_id,
        s.full_name,
        marksVal !== '' ? marksVal : 'ABSENT / NOT GRADED',
        maxMarks,
        percentage,
        grade,
        entry.remarks || '',
      ]);
    });

    // 3. Summary Statistics Rows
    sheetData.push(['']);
    sheetData.push(['SUMMARY EVALUATION METRICS']);
    sheetData.push(['Total Students in Roster', stats.total]);
    sheetData.push(['Students Evaluated', stats.graded]);
    sheetData.push(['Class Average Marks', `${stats.avg} / ${maxMarks}`]);
    sheetData.push(['Highest Marks', `${stats.max} / ${maxMarks}`]);
    sheetData.push(['Lowest Marks (Evaluated)', `${stats.min} / ${maxMarks}`]);

    const ws = utils.aoa_to_sheet(sheetData);

    // Format column widths
    ws['!cols'] = [
      { wch: 6 },  // S.No
      { wch: 14 }, // Roll Number
      { wch: 16 }, // Student ID
      { wch: 28 }, // Student Name
      { wch: 16 }, // Marks Obtained
      { wch: 12 }, // Max Marks
      { wch: 15 }, // Percentage
      { wch: 20 }, // Grade
      { wch: 38 }, // Remarks
    ];

    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'RolePlay_Marks');

    const cleanSecName = sectionName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `RolePlay_Marks_${cleanSecName}_${activityDate}.xlsx`;

    writeFile(wb, fileName);
    toast.success(`Exported ${fileName} successfully!`);
  }

  // Print view
  function handlePrint() {
    window.print();
  }

  return (
    <div className="page-container fade-in pb-16">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="btn-secondary py-2 px-3 text-sm rounded-xl"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold flex items-center gap-2.5" style={{ color: 'var(--color-text-primary)' }}>
                <span className="w-8 h-8 rounded-lg bg-gradient-accent flex items-center justify-center text-white shadow-lg">
                  <Award className="w-5 h-5" />
                </span>
                Role-Play Marks
              </h1>
              <span className="badge badge-success text-xs font-semibold py-0.5 px-2">
                Assessment Matrix
              </span>
            </div>
            <p className="text-xs sm:text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              Evaluate student participation, record individual scores, attach remarks, and export reports.
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleManualSave}
            disabled={isSaving || !students || students.length === 0}
            className="btn-secondary text-sm py-2 px-3.5"
            title="Save evaluation data"
          >
            <Save className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
            <span>{isSaving ? 'Saving...' : 'Save Draft'}</span>
          </button>

          <button
            onClick={handleExportExcel}
            disabled={!students || students.length === 0}
            className="btn-primary text-sm py-2 px-4 shadow-md"
            title="Download formatted Excel sheet"
          >
            <Download className="w-4 h-4" />
            <span>Export to Excel</span>
          </button>
        </div>
      </div>

      {/* Section Selector & Activity Configuration Card */}
      <div className="glass-card p-5 mb-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between flex-wrap gap-2 border-b pb-3" style={{ borderColor: 'var(--color-border-default)' }}>
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4" style={{ color: 'var(--color-accent-start)' }} />
            <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-primary)' }}>
              1. Select Section & Activity Details
            </h2>
          </div>
          {lastSavedTime && (
            <span className="text-xs flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              Auto-saved at {lastSavedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        {/* Quick Section Pills (Faculty Assigned + Common Sections) */}
        <div>
          <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>
            Choose Section (e.g. CSE 3, CSE 4, CSE-AIML):
          </label>
          <div className="flex flex-wrap gap-2 items-center">
            {availableSections && availableSections.length > 0 ? (
              availableSections.map((sec) => {
                const isSelected = sec.id === selectedSectionId;
                return (
                  <button
                    key={sec.id}
                    onClick={() => {
                      setSelectedSectionId(sec.id);
                      setSearchParams({ section: sec.id });
                    }}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-gradient-accent text-white shadow-lg scale-105'
                        : 'glass-card text-slate-300 hover:text-white hover:border-slate-500'
                    }`}
                  >
                    <span>{sec.section_name}</span>
                    {sec.year && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${isSelected ? 'bg-white/20' : 'bg-slate-700'}`}>
                        {sec.year}
                      </span>
                    )}
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                  </button>
                );
              })
            ) : (
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Loading sections...
              </span>
            )}

            {/* Dropdown for manual section select if list is large */}
            <div className="relative min-w-[160px]">
              <select
                value={selectedSectionId}
                onChange={(e) => {
                  setSelectedSectionId(e.target.value);
                  setSearchParams({ section: e.target.value });
                }}
                className="input-field text-xs py-1.5 px-3"
              >
                <option value="">-- All Sections Dropdown --</option>
                {availableSections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.section_name} {sec.year ? `(${sec.year} Sem ${sec.semester || 1})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Activity Details Form Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2">
          {/* Activity Title */}
          <div className="sm:col-span-6">
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text-secondary)' }}>
              Activity / Topic Name
            </label>
            <input
              type="text"
              value={activityTitle}
              onChange={(e) => setActivityTitle(e.target.value)}
              placeholder="e.g. Role-Play: Client Software Requirement Negotiation"
              className="input-field text-sm"
            />
          </div>

          {/* Max Marks */}
          <div className="sm:col-span-3">
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text-secondary)' }}>
              Maximum Marks
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                max="500"
                value={maxMarks}
                onChange={(e) => setMaxMarks(Math.max(1, Number(e.target.value) || 1))}
                className="input-field text-sm font-bold"
              />
              {/* Quick preset pills */}
              <div className="flex gap-1">
                {[10, 20, 25, 50].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMaxMarks(m)}
                    className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                      maxMarks === m
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Evaluation Date */}
          <div className="sm:col-span-3">
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text-secondary)' }}>
              Assessment Date
            </label>
            <input
              type="date"
              value={activityDate}
              onChange={(e) => setActivityDate(e.target.value)}
              className="input-field text-sm"
            />
          </div>
        </div>
      </div>

      {/* KPI Stats Bar */}
      {students && students.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          <div className="glass-card p-3.5 flex flex-col justify-between">
            <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
              Total Students
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black" style={{ color: 'var(--color-text-primary)' }}>
                {stats.total}
              </span>
              <span className="text-xs font-medium text-slate-400">Roster</span>
            </div>
          </div>

          <div className="glass-card p-3.5 flex flex-col justify-between">
            <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
              Graded Progress
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-emerald-400">
                {stats.graded}
              </span>
              <span className="text-xs font-medium text-slate-400">/ {stats.total} ({stats.percent}%)</span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-slate-700/50 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${stats.percent}%` }}
              />
            </div>
          </div>

          <div className="glass-card p-3.5 flex flex-col justify-between">
            <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
              Class Average
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-black text-indigo-400">
                {stats.avg}
              </span>
              <span className="text-xs text-slate-400">/ {maxMarks}</span>
            </div>
          </div>

          <div className="glass-card p-3.5 flex flex-col justify-between">
            <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
              Highest Mark
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-black text-amber-400">
                {stats.max}
              </span>
              <span className="text-xs text-slate-400">/ {maxMarks}</span>
            </div>
          </div>

          <div className="glass-card p-3.5 flex flex-col justify-between col-span-2 sm:col-span-1">
            <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
              Lowest Graded
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-black text-rose-400">
                {stats.graded > 0 ? stats.min : 0}
              </span>
              <span className="text-xs text-slate-400">/ {maxMarks}</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Students List & Evaluation Table */}
      <div className="glass-card p-4 sm:p-5 shadow-2xl">
        {/* Table Controls (Search, Filters, Batch tools) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by student name, roll number, or ID..."
                className="input-field text-sm pl-9 py-2"
              />
            </div>
          </div>

          {/* Status Filter Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center rounded-xl p-1 bg-slate-900/60 border border-slate-700/50">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === 'all'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All ({students?.length || 0})
              </button>
              <button
                onClick={() => setStatusFilter('graded')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === 'graded'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Graded ({stats.graded})
              </button>
              <button
                onClick={() => setStatusFilter('pending')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === 'pending'
                    ? 'bg-amber-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Pending ({stats.total - stats.graded})
              </button>
            </div>

            {/* Batch Helper Menu */}
            <button
              onClick={handleFillDefaultMarks}
              disabled={!students || students.length === 0}
              className="btn-secondary text-xs py-1.5 px-2.5"
              title="Set same default marks for all students"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Fill Default</span>
            </button>
            <button
              onClick={handleClearAll}
              disabled={!students || students.length === 0}
              className="btn-secondary text-xs py-1.5 px-2.5 text-rose-400 hover:text-rose-300"
              title="Clear all entered marks"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        {studentsLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="spinner mb-3" />
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Loading section roster...
            </p>
          </div>
        ) : !selectedSectionId ? (
          <div className="text-center py-16">
            <Award className="w-12 h-12 mx-auto mb-3 text-indigo-400/80" />
            <h3 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
              No Section Selected
            </h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto mt-1 mb-4">
              Please choose a section from the buttons above (such as CSE 3, CSE 4, or CSE-AIML) to load the student roster.
            </p>
          </div>
        ) : students && students.length === 0 ? (
          <div className="text-center py-16 glass-card border border-dashed border-slate-700 rounded-2xl">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 text-amber-400/80" />
            <h3 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
              No Roster Found for {currentSection?.section_name || 'This Section'}
            </h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto mt-1 mb-5">
              This section does not have any student records uploaded yet. Upload the student roster Excel sheet to enable role-play marks evaluation.
            </p>
            <button
              onClick={() => navigate(`/roster/${selectedSectionId}`)}
              className="btn-primary text-sm py-2 px-5 inline-flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Roster for {currentSection?.section_name}</span>
            </button>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No students match your search or filter.</p>
          </div>
        ) : (
          /* Table of Students */
          <div className="overflow-x-auto rounded-xl border border-slate-700/40">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-900/80 border-b border-slate-700/60 text-xs font-bold uppercase tracking-wider text-slate-300">
                  <th className="py-3 px-3 w-12 text-center">#</th>
                  <th className="py-3 px-3 w-28">Roll No</th>
                  <th className="py-3 px-3 w-28 hidden md:table-cell">ID</th>
                  <th className="py-3 px-4 min-w-[180px]">Student Name</th>
                  <th className="py-3 px-4 w-44">
                    Marks (Out of {maxMarks})
                  </th>
                  <th className="py-3 px-4 min-w-[240px]">
                    Remarks / Feedback
                  </th>
                  <th className="py-3 px-3 w-28 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredStudents.map((student, idx) => {
                  const entry = marksMap[student.id] || { marks: '', remarks: '' };
                  const isGraded = entry.marks !== '' && entry.marks !== undefined;
                  const gradeBadge = getGradeBadge(entry.marks);

                  return (
                    <tr
                      key={student.id}
                      className="hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* S.No */}
                      <td className="py-3 px-3 text-center text-xs font-mono text-slate-400">
                        {idx + 1}
                      </td>

                      {/* Roll Number */}
                      <td className="py-3 px-3">
                        <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-indigo-300 inline-block">
                          {student.roll_number}
                        </span>
                      </td>

                      {/* Student ID */}
                      <td className="py-3 px-3 text-xs font-mono text-slate-400 hidden md:table-cell">
                        {student.student_id}
                      </td>

                      {/* Full Name */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-100 flex items-center gap-2">
                          <span>{student.full_name}</span>
                          {isGraded && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                          )}
                        </div>
                      </td>

                      {/* Marks Input (Side by side with Name) */}
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <input
                              type="number"
                              min="0"
                              max={maxMarks}
                              step="0.5"
                              value={entry.marks}
                              onChange={(e) => handleMarkChange(student.id, e.target.value)}
                              placeholder="0"
                              className={`input-field py-1.5 px-3 text-sm font-bold text-center w-full transition-all ${
                                isGraded
                                  ? 'border-indigo-500/70 bg-indigo-950/20 text-indigo-200'
                                  : 'text-slate-300'
                              }`}
                            />
                          </div>
                          <span className="text-xs font-medium text-slate-400 flex-shrink-0">
                            / {maxMarks}
                          </span>
                        </div>
                      </td>

                      {/* Remarks Column with Quick Suggestions */}
                      <td className="py-2.5 px-4 relative">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={entry.remarks}
                            onChange={(e) => handleRemarkChange(student.id, e.target.value)}
                            placeholder="Enter remarks (e.g. Good delivery, confident...)"
                            className="input-field py-1.5 px-3 text-xs w-full"
                          />

                          {/* Quick Preset Dropdown Trigger */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() =>
                                setActiveRemarkStudentId(
                                  activeRemarkStudentId === student.id ? null : student.id
                                )
                              }
                              className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                              title="Choose quick remark"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>

                            {/* Suggestion Dropdown Popover */}
                            {activeRemarkStudentId === student.id && (
                              <div
                                className="absolute right-0 top-full mt-1 w-64 z-50 glass-card p-2 shadow-2xl border border-slate-600 rounded-xl space-y-1 fade-in"
                                style={{ background: '#131b2e' }}
                              >
                                <div className="text-[11px] font-bold text-slate-400 px-2 py-1 uppercase">
                                  Quick Remarks
                                </div>
                                {QUICK_REMARKS.map((rem, rIdx) => (
                                  <button
                                    key={rIdx}
                                    type="button"
                                    onClick={() => selectQuickRemark(student.id, rem)}
                                    className="w-full text-left text-xs px-2.5 py-1.5 rounded-lg text-slate-200 hover:bg-indigo-600 hover:text-white transition-colors"
                                  >
                                    {rem}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Status / Grade Badge */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`badge text-[11px] font-semibold py-0.5 px-2.5 ${
                            isGraded ? 'badge-success' : 'badge-warning'
                          }`}
                        >
                          {isGraded ? `${gradeBadge.label}` : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer Navigation & Export Reminder */}
        {students && students.length > 0 && (
          <div className="mt-5 pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
            <div>
              Showing {filteredStudents.length} of {students.length} students in {currentSection?.section_name || 'selected section'}.
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleExportExcel}
                className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download {currentSection?.section_name || ''} Excel</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
