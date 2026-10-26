import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';

function generateSampleStudents(sectionId) {
  const prefix = sectionId?.includes('cse4') ? 'CSE4' : sectionId?.includes('aiml') ? 'AIML' : 'CSE3';
  const names = [
    'A. Sai Kumar', 'B. Bhavani', 'C. Charan Teja', 'D. Divya Sri', 'E. Eshwar Rao',
    'G. Ganesh Reddy', 'H. Harika Devi', 'I. Imran Khan', 'J. Jahnavi Priya', 'K. Kalyan Varma',
    'L. Lavanya', 'M. Manoj Kumar', 'N. Nikhil Reddy', 'P. Prashanth', 'R. Rahul Sharma',
    'S. Sneha Latha', 'T. Tarun Kumar', 'V. Varun Tej', 'Y. Yashwanth', 'Z. Zoya Siddiqui',
    'A. Ananya', 'B. Bharat', 'D. Deepak', 'G. Geetha', 'K. Kavya',
    'M. Meena', 'P. Pranav', 'R. Rohith', 'S. Swathi', 'V. Vijay Kumar'
  ];

  return names.map((name, idx) => {
    const num = idx + 1;
    const roll = `${num}`;
    const studentId = `N190${String(num).padStart(3, '0')}`;
    return {
      id: `stud-${prefix.toLowerCase()}-${num}`,
      roll_number: roll,
      student_id: studentId,
      full_name: name,
    };
  });
}

export function useStudents(sectionId) {
  return useQuery({
    queryKey: ['students', sectionId],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('students')
          .select('id, roll_number, student_id, full_name')
          .eq('section_id', sectionId);

        if (!error && data && data.length > 0) {
          return data.sort((a, b) =>
            (a.roll_number || '').localeCompare(b.roll_number || '', undefined, { numeric: true, sensitivity: 'base' })
          );
        }
      } catch (e) {
        // Fall through to sample/local roster
      }

      // Check local storage roster
      const localRoster = localStorage.getItem(`roster_${sectionId}`);
      if (localRoster) {
        try {
          const parsed = JSON.parse(localRoster);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.sort((a, b) =>
              (a.roll_number || '').localeCompare(b.roll_number || '', undefined, { numeric: true, sensitivity: 'base' })
            );
          }
        } catch (e) {}
      }

      // Default sample roster for CSE 3, CSE 4, CSE-AIML or demo
      return generateSampleStudents(sectionId);
    },
    enabled: !!sectionId,
  });
}

