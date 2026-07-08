import { useState } from 'react';
import { YEARS, SEMESTERS } from '../lib/constants';
import { Plus, X } from 'lucide-react';

export default function AssignmentPicker({ onAdd, loading }) {
  const [entries, setEntries] = useState([createEmptyEntry()]);

  function createEmptyEntry() {
    return {
      id: Date.now() + Math.random(),
      year: '',
      semester: '',
      sectionName: '',
      subjectName: '',
    };
  }

  function updateEntry(index, field, value) {
    setEntries((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function addEntry() {
    setEntries((prev) => [...prev, createEmptyEntry()]);
  }

  function removeEntry(index) {
    if (entries.length <= 1) return;
    setEntries((prev) => prev.filter((_, i) => i !== index));
  }

  function isValid(entry) {
    return entry.year && entry.semester && entry.sectionName.trim() && entry.subjectName.trim();
  }

  function canSubmit() {
    return entries.every(isValid) && !loading;
  }

  async function handleSubmit() {
    for (const entry of entries) {
      if (isValid(entry)) {
        await onAdd({
          year: entry.year,
          semester: parseInt(entry.semester),
          sectionName: entry.sectionName.trim().toUpperCase(),
          subjectName: entry.subjectName.trim(),
        });
      }
    }
    setEntries([createEmptyEntry()]);
  }

  return (
    <div className="space-y-4">
      {entries.map((entry, index) => (
        <div
          key={entry.id}
          className="glass-card p-4 space-y-3 fade-in"
        >
          {entries.length > 1 && (
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                CLASS {index + 1}
              </span>
              <button
                onClick={() => removeEntry(index)}
                className="p-1 rounded-lg cursor-pointer"
                style={{ color: 'var(--color-text-muted)', background: 'transparent', border: 'none' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {/* Year */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                Year
              </label>
              <select
                value={entry.year}
                onChange={(e) => updateEntry(index, 'year', e.target.value)}
                className="input-field"
              >
                <option value="">Select year</option>
                {YEARS.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Semester */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                Semester
              </label>
              <select
                value={entry.semester}
                onChange={(e) => updateEntry(index, 'semester', e.target.value)}
                className="input-field"
              >
                <option value="">Select sem</option>
                {SEMESTERS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Section name */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              Section Name
            </label>
            <input
              type="text"
              value={entry.sectionName}
              onChange={(e) => updateEntry(index, 'sectionName', e.target.value)}
              placeholder="e.g. CSE1, CSE3, ECE2"
              className="input-field"
            />
          </div>

          {/* Subject name */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              Subject Name
            </label>
            <input
              type="text"
              value={entry.subjectName}
              onChange={(e) => updateEntry(index, 'subjectName', e.target.value)}
              placeholder="e.g. DBMS, OS, Data Structures"
              className="input-field"
            />
          </div>
        </div>
      ))}

      <div className="flex gap-3">
        <button
          onClick={addEntry}
          className="btn-secondary flex-1 text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Another Class
        </button>
      </div>

      <button
        onClick={handleSubmit}
        disabled={!canSubmit()}
        className="btn-primary w-full"
      >
        {loading ? (
          <div className="spinner" style={{ width: '1.25rem', height: '1.25rem', borderWidth: '2px' }} />
        ) : (
          `Save ${entries.length === 1 ? 'Assignment' : `${entries.length} Assignments`}`
        )}
      </button>
    </div>
  );
}
