import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEffect } from 'react';
import { GraduationCap, LogIn } from 'lucide-react';
import toast from 'react-hot-toast';
import { Toaster } from 'react-hot-toast';

export default function Login() {
  const { user, isOnboarded, loading, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate(isOnboarded ? '/dashboard' : '/onboarding', { replace: true });
    }
  }, [user, isOnboarded, loading, navigate]);

  async function handleLogin() {
    try {
      await signInWithGoogle();
    } catch (err) {
      toast.error('Failed to sign in. Please try again.');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ background: 'var(--color-bg-primary)' }}
    >
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: 'var(--color-bg-secondary)',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--color-border-default)',
            borderRadius: '0.75rem',
          },
        }}
      />

      {/* Background glow effect */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 600px 400px at 50% 30%, rgba(99, 102, 241, 0.08), transparent)',
        }}
      />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10 fade-in">
          <div
            className="w-20 h-20 rounded-2xl bg-gradient-accent flex items-center justify-center mb-5"
            style={{ boxShadow: '0 8px 40px rgba(99, 102, 241, 0.3)' }}
          >
            <GraduationCap className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-extrabold text-gradient mb-2">
            AttendMate
          </h1>
          <p className="text-center text-sm" style={{ color: 'var(--color-text-secondary)', maxWidth: '20rem' }}>
            Smart attendance tracking for college faculty.
            Tap. Track. Export.
          </p>
        </div>

        {/* Login card */}
        <div className="glass-card p-6 sm:p-8 fade-in" style={{ animationDelay: '0.1s' }}>
          <h2 className="text-xl font-bold text-center mb-2" style={{ color: 'var(--color-text-primary)' }}>
            Welcome back
          </h2>
          <p className="text-sm text-center mb-6" style={{ color: 'var(--color-text-secondary)' }}>
            Sign in with your college Google account to continue
          </p>

          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl font-semibold text-sm cursor-pointer transition-all"
            style={{
              background: 'white',
              color: '#1f2937',
              border: 'none',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(255, 255, 255, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {/* Google icon */}
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>
        </div>

        {/* Footer */}
        <p
          className="text-center text-xs mt-6 fade-in"
          style={{ color: 'var(--color-text-muted)', animationDelay: '0.2s' }}
        >
          Built for faster attendance, fewer spreadsheets.
        </p>
      </div>
    </div>
  );
}
