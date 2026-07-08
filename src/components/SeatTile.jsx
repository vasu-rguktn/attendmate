import { memo } from 'react';

const SeatTile = memo(function SeatTile({ rollNumber, studentName, isPresent, onToggle }) {
  return (
    <button
      type="button"
      className={`seat-tile ${isPresent ? 'seat-present' : 'seat-absent'}`}
      onClick={onToggle}
      title={studentName || `Roll ${rollNumber}`}
      aria-label={`Roll ${rollNumber} - ${studentName || 'Student'} - ${isPresent ? 'Present' : 'Absent'}`}
      aria-pressed={isPresent}
    >
      <span className="text-lg font-bold leading-none">{rollNumber}</span>
      {studentName && (
        <span
          className="text-[0.6rem] leading-tight mt-0.5 text-center px-0.5 truncate w-full"
          style={{ opacity: 0.75 }}
        >
          {studentName.split(' ')[0]}
        </span>
      )}
    </button>
  );
});

export default SeatTile;
