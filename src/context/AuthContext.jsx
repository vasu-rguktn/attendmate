import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext(null);

const DEMO_USER = {
  id: 'demo-faculty-001',
  email: 'faculty@rguktn.ac.in',
  user_metadata: {
    full_name: 'Dr. Faculty Member',
  },
};

const DEMO_FACULTY = {
  id: 'demo-faculty-001',
  email: 'faculty@rguktn.ac.in',
  full_name: 'Dr. Faculty Member',
  onboarded: true,
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [faculty, setFaculty] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch faculty profile from our faculty table
  async function fetchFacultyProfile(userId) {
    const { data, error } = await supabase
      .from('faculty')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching faculty profile:', error);
      return null;
    }
    return data;
  }

  useEffect(() => {
    // Check if demo session is active
    if (localStorage.getItem('attendmate_demo_auth') === 'true') {
      setUser(DEMO_USER);
      setFaculty(DEMO_FACULTY);
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        fetchFacultyProfile(currentUser.id).then((profile) => {
          setFaculty(profile);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (localStorage.getItem('attendmate_demo_auth') === 'true') {
          return;
        }
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          const profile = await fetchFacultyProfile(currentUser.id);
          setFaculty(profile);
        } else {
          setFaculty(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + window.location.pathname,
      },
    });
    if (error) {
      console.error('Google sign-in error:', error);
      throw error;
    }
  }

  function signInDemo() {
    localStorage.setItem('attendmate_demo_auth', 'true');
    setUser(DEMO_USER);
    setFaculty(DEMO_FACULTY);
  }

  async function signOut() {
    localStorage.removeItem('attendmate_demo_auth');
    try {
      const { error } = await supabase.auth.signOut();
      if (error) console.error('Sign-out error:', error);
    } catch (e) {}
    setUser(null);
    setFaculty(null);
  }

  async function refreshFaculty() {
    if (user) {
      if (user.id === 'demo-faculty-001') {
        setFaculty(DEMO_FACULTY);
        return DEMO_FACULTY;
      }
      const profile = await fetchFacultyProfile(user.id);
      setFaculty(profile);
      return profile;
    }
    return null;
  }

  const value = {
    user,
    faculty,
    loading,
    signInWithGoogle,
    signInDemo,
    signOut,
    refreshFaculty,
    isOnboarded: (faculty?.onboarded ?? false) || user?.id === 'demo-faculty-001',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
