export const MATH_GRADE_LABELS = {
  1: 'Kindergarten',
  2: 'Grade 1',
  3: 'Grade 2',
  4: 'Grade 3',
  5: 'Grade 4',
  6: 'Grade 5',
  7: 'Grade 6',
  8: 'Highschool 1-3',
}

export function mathGradeLabel(level) {
  return MATH_GRADE_LABELS[level] || `Level ${level}`
}
