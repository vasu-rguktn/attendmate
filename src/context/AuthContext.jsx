import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext(null);

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

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Sign-out error:', error);
      throw error;
    }
    setUser(null);
    setFaculty(null);
  }

  async function refreshFaculty() {
    if (user) {
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
    signOut,
    refreshFaculty,
    isOnboarded: faculty?.onboarded ?? false,
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
