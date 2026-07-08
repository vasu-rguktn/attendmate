import { useState } from 'react';
import { useFacultyAssignments, useAddAssignment, useDeleteAssignment, useTodayStatus } from '../hooks/useFacultyAssignments';
import ClassCard from '../components/ClassCard';
import AssignmentPicker from '../components/AssignmentPicker';
import { Plus, X, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const { data: assignments, isLoading, error } = useFacultyAssignments();
  const { data: todayStatus } = useTodayStatus(assignments);
  const addAssignment = useAddAssignment();
  const deleteAssignment = useDeleteAssignment();
  const [showPicker, setShowPicker] = useState(false);

  async function handleAdd(assignment) {
    try {
      await addAssignment.mutateAsync(assignment);
      toast.success(`Added ${assignment.subjectName} — ${assignment.sectionName}`);
    } catch (err) {
      if (err.code === '23505') {
        toast.error('This assignment already exists.');
      } else {
        toast.error('Failed to add assignment.');
        console.error(err);
      }
    }
  }

  async function handleDelete(assignmentId) {
    if (!confirm('Remove this class assignment?')) return;
    try {
      await deleteAssignment.mutateAsync(assignmentId);
      toast.success('Assignment removed.');
    } catch (err) {
      toast.error('Failed to remove assignment.');
      console.error(err);
    }
  }

  if (isLoading) {
    return (
      <div className="page-container flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="glass-card p-6 text-center">
          <p style={{ color: 'var(--color-danger)' }}>Failed to load assignments. Please refresh.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold" style={{ color: 'var(--color-text-primary)' }}>
            Dashboard
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
            {assignments?.length || 0} class{(assignments?.length || 0) !== 1 ? 'es' : ''} assigned
          </p>
        </div>
        <button
          onClick={() => setShowPicker(!showPicker)}
          className={showPicker ? 'btn-secondary' : 'btn-primary'}
        >
          {showPicker ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          <span className="hidden sm:inline">{showPicker ? 'Close' : 'Add Class'}</span>
        </button>
      </div>

      {/* Add class picker (expandable) */}
      {showPicker && (
        <div className="mb-6 fade-in">
          <AssignmentPicker onAdd={handleAdd} loading={addAssignment.isPending} />
        </div>
      )}

      {/* Class cards grid */}
      {assignments && assignments.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {assignments.map((assignment) => {
            const statusKey = `${assignment.section?.id}_${assignment.subject_name}`;
            return (
              <ClassCard
                key={assignment.id}
                assignment={assignment}
                isTodayDone={todayStatus?.[statusKey] ?? false}
                onDelete={handleDelete}
              />
            );
          })}
        </div>
      ) : (
        <div className="glass-card p-12 text-center fade-in">
          <div
            className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: 'var(--color-accent-soft)' }}
          >
            <BookOpen className="w-8 h-8" style={{ color: 'var(--color-accent-start)' }} />
          </div>
          <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
            No classes yet
          </h3>
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            Add your first class assignment to get started
          </p>
          <button onClick={() => setShowPicker(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            Add Class
          </button>
        </div>
      )}
    </div>
  );
}
