import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useFacultyAssignments } from '../hooks/useFacultyAssignments';
import { read, utils } from 'xlsx';
import {
  ArrowLeft, Upload, FileSpreadsheet, Check, AlertTriangle, Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function RosterUpload() {
  const { sectionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);

  const [parsedRows, setParsedRows] = useState(null);
  const [parseError, setParseError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState('');

  // Get section info
  const { data: section } = useQuery({
    queryKey: ['section', sectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sections')
        .select('*')
        .eq('id', sectionId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!sectionId,
  });

  // Get existing students for this section
  const { data: existingStudents } = useQuery({
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

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setParseError(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = read(evt.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = utils.sheet_to_json(ws, { defval: '' });

        if (json.length === 0) {
          setParseError('The spreadsheet is empty.');
          setParsedRows(null);
          return;
        }

        // Normalize column names (case-insensitive, trim)
        const normalized = json.map((row) => {
          const obj = {};
          Object.keys(row).forEach((key) => {
            obj[key.trim().toLowerCase().replace(/\s+/g, '_')] = String(row[key]).trim();
          });
          return obj;
        });

        // Validate required columns
        const firstRow = normalized[0];
        const requiredCols = ['roll_number', 'student_id', 'full_name'];
        const missingCols = requiredCols.filter((c) => !(c in firstRow));

        if (missingCols.length > 0) {
          setParseError(`Missing columns: ${missingCols.join(', ')}. Expected: roll_number, student_id, full_name`);
          setParsedRows(null);
          return;
        }

        // Filter out empty rows
        const valid = normalized.filter(
          (r) => r.roll_number && r.student_id && r.full_name
        );

        if (valid.length === 0) {
          setParseError('No valid rows found (all rows missing required fields).');
          setParsedRows(null);
          return;
        }

        // Check for duplicate roll numbers
        const rollSet = new Set();
        const dupes = [];
        valid.forEach((r) => {
          if (rollSet.has(r.roll_number)) dupes.push(r.roll_number);
          rollSet.add(r.roll_number);
        });

        if (dupes.length > 0) {
          setParseError(`Duplicate roll numbers found: ${dupes.join(', ')}`);
          setParsedRows(null);
          return;
        }

        setParsedRows(valid);
      } catch (err) {
        setParseError('Failed to parse the file. Make sure it\'s a valid .xlsx file.');
        setParsedRows(null);
        console.error(err);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function handleUpload() {
    if (!parsedRows || parsedRows.length === 0) return;

    setUploading(true);
    try {
      const records = parsedRows.map((r) => ({
        section_id: sectionId,
        roll_number: r.roll_number,
        student_id: r.student_id,
        full_name: r.full_name,
      }));

      const { error } = await supabase
        .from('students')
        .upsert(records, { onConflict: 'section_id,roll_number' });

      if (error) throw error;

      toast.success(`${records.length} students uploaded successfully!`);
      queryClient.invalidateQueries({ queryKey: ['students', sectionId] });
      setParsedRows(null);
      setFileName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      toast.error('Upload failed. Please try again.');
      console.error(err);
    } finally {
      setUploading(false);
    }
  }

  function handleClear() {
    setParsedRows(null);
    setParseError(null);
    setFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
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
            Upload Roster
          </h1>
          {section && (
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {section.section_name} • {section.year} • Sem {section.semester}
            </p>
          )}
        </div>
      </div>

      {/* Existing students */}
      {existingStudents && existingStudents.length > 0 && (
        <div className="glass-card p-4 mb-6 fade-in">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold" style={{ color: 'var(--color-text-primary)' }}>
              Current Roster ({existingStudents.length} students)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border-default)' }}>
                  <th className="text-left py-2 px-3 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Roll</th>
                  <th className="text-left py-2 px-3 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>ID</th>
                  <th className="text-left py-2 px-3 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Name</th>
                </tr>
              </thead>
              <tbody>
                {existingStudents.slice(0, 10).map((s) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--color-border-default)' }}>
                    <td className="py-2 px-3" style={{ color: 'var(--color-text-primary)' }}>{s.roll_number}</td>
                    <td className="py-2 px-3" style={{ color: 'var(--color-text-secondary)' }}>{s.student_id}</td>
                    <td className="py-2 px-3" style={{ color: 'var(--color-text-primary)' }}>{s.full_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {existingStudents.length > 10 && (
              <p className="text-xs text-center py-2" style={{ color: 'var(--color-text-muted)' }}>
                ...and {existingStudents.length - 10} more students
              </p>
            )}
          </div>
        </div>
      )}

      {/* Upload area */}
      <div className="glass-card p-6 mb-6 fade-in">
        <div className="flex flex-col items-center">
          <div
            className="w-16 h-16 rounded-2xl mb-4 flex items-center justify-center"
            style={{ background: 'var(--color-accent-soft)' }}
          >
            <FileSpreadsheet className="w-8 h-8" style={{ color: 'var(--color-accent-start)' }} />
          </div>

          <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
            {fileName || 'Select an Excel file'}
          </h3>
          <p className="text-sm mb-4 text-center" style={{ color: 'var(--color-text-secondary)' }}>
            Upload a <code>.xlsx</code> with columns: <strong>roll_number</strong>, <strong>student_id</strong>, <strong>full_name</strong>
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
            id="roster-file"
          />
          <label htmlFor="roster-file" className="btn-secondary cursor-pointer">
            <Upload className="w-4 h-4" />
            Choose File
          </label>
        </div>
      </div>

      {/* Parse error */}
      {parseError && (
        <div
          className="glass-card p-4 mb-6 flex items-start gap-3 fade-in"
          style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}
        >
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--color-danger)' }} />
          <p className="text-sm" style={{ color: 'var(--color-danger)' }}>{parseError}</p>
        </div>
      )}

      {/* Preview */}
      {parsedRows && parsedRows.length > 0 && (
        <div className="glass-card p-4 mb-6 fade-in">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold" style={{ color: 'var(--color-text-primary)' }}>
              Preview ({parsedRows.length} students)
            </h3>
            <button onClick={handleClear} className="btn-secondary text-xs py-1.5 px-3">
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border-default)' }}>
                  <th className="text-left py-2 px-3 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Roll</th>
                  <th className="text-left py-2 px-3 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>ID</th>
                  <th className="text-left py-2 px-3 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Name</th>
                </tr>
              </thead>
              <tbody>
                {parsedRows.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--color-border-default)' }}>
                    <td className="py-2 px-3" style={{ color: 'var(--color-text-primary)' }}>{row.roll_number}</td>
                    <td className="py-2 px-3" style={{ color: 'var(--color-text-secondary)' }}>{row.student_id}</td>
                    <td className="py-2 px-3" style={{ color: 'var(--color-text-primary)' }}>{row.full_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={handleUpload}
            disabled={uploading}
            className="btn-primary w-full mt-4"
          >
            {uploading ? (
              <div className="spinner" style={{ width: '1.25rem', height: '1.25rem', borderWidth: '2px' }} />
            ) : (
              <>
                <Check className="w-4 h-4" />
                Upload {parsedRows.length} Students
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
