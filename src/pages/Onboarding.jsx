import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAddAssignment } from '../hooks/useFacultyAssignments';
import AssignmentPicker from '../components/AssignmentPicker';
import { supabase } from '../lib/supabaseClient';
import { GraduationCap, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Onboarding() {
  const { user, refreshFaculty } = useAuth();
  const navigate = useNavigate();
  const addAssignment = useAddAssignment();

  async function handleAdd(assignment) {
    try {
      await addAssignment.mutateAsync(assignment);
    } catch (err) {
      if (err.code === '23505') {
        toast.error('This assignment already exists.');
      } else {
        toast.error('Failed to add assignment.');
        console.error(err);
      }
      throw err;
    }
  }

  async function handleComplete() {
    try {
      // Mark as onboarded
      const { error } = await supabase
        .from('faculty')
        .update({ onboarded: true })
        .eq('id', user.id);

      if (error) throw error;

      await refreshFaculty();
      toast.success('Welcome aboard! 🎉');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toast.error('Something went wrong.');
      console.error(err);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ background: 'var(--color-bg-primary)' }}
    >
      {/* Background glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 600px 400px at 50% 20%, rgba(168, 85, 247, 0.06), transparent)',
        }}
      />

      <div className="relative z-10 w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8 fade-in">
          <div className="inline-flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5" style={{ color: 'var(--color-accent-start)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--color-accent-start)' }}>
              Almost there
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold mb-2" style={{ color: 'var(--color-text-primary)' }}>
            Set up your classes
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Add the sections and subjects you teach. You can always add more later.
          </p>
        </div>

        {/* Assignment picker */}
        <div className="fade-in" style={{ animationDelay: '0.1s' }}>
          <AssignmentPickerWithComplete
            onAdd={handleAdd}
            onComplete={handleComplete}
            loading={addAssignment.isPending}
          />
        </div>
      </div>
    </div>
  );
}

// Wraps AssignmentPicker and adds a "Done, go to Dashboard" button after first save
function AssignmentPickerWithComplete({ onAdd, onComplete, loading }) {
  const [saved, setSaved] = useState(0);

  async function handleAdd(assignment) {
    await onAdd(assignment);
    setSaved((prev) => prev + 1);
  }

  return (
    <div className="space-y-4">
      <AssignmentPicker onAdd={handleAdd} loading={loading} />
      {saved > 0 && (
        <button onClick={onComplete} className="btn-primary w-full fade-in">
          <GraduationCap className="w-5 h-5" />
          Done — Go to Dashboard
        </button>
      )}
    </div>
  );
}

