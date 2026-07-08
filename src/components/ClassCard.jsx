import { useNavigate } from 'react-router-dom';
import { BookOpen, ClipboardList, Upload, Trash2, CheckCircle2, Clock } from 'lucide-react';
import { YEAR_LABELS } from '../lib/constants';

export default function ClassCard({ assignment, isTodayDone, onDelete }) {
  const navigate = useNavigate();
  const { section } = assignment;

  return (
    <div className="glass-card glass-card-hover p-5 fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold truncate" style={{ color: 'var(--color-text-primary)' }}>
            {assignment.subject_name}
          </h3>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
            {section.section_name} • {YEAR_LABELS[section.year]} • Sem {section.semester}
          </p>
        </div>
        <div className="ml-3 flex-shrink-0">
          {isTodayDone ? (
            <span className="badge badge-success">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Done
            </span>
          ) : (
            <span className="badge badge-warning">
              <Clock className="w-3.5 h-3.5" />
              Pending
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => navigate(`/attendance/${assignment.id}`)}
          className="btn-primary flex-1 min-w-0 text-sm py-2.5"
        >
          <ClipboardList className="w-4 h-4" />
          <span className="truncate">Take Attendance</span>
        </button>
        <button
          onClick={() => navigate(`/reports/${assignment.id}`)}
          className="btn-secondary text-sm py-2.5 px-3"
          title="View Reports"
        >
          <BookOpen className="w-4 h-4" />
        </button>
        <button
          onClick={() => navigate(`/roster/${section.id}`)}
          className="btn-secondary text-sm py-2.5 px-3"
          title="Upload Roster"
        >
          <Upload className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDelete?.(assignment.id)}
          className="btn-secondary text-sm py-2.5 px-3"
          title="Remove Assignment"
          style={{ color: 'var(--color-danger)' }}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
