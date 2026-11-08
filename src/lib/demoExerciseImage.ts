export function demoExerciseImage(code: string): string | null {
  return /^[A-Z0-9_]+$/.test(code) ? `/demo/exercises/${code.toLowerCase()}.svg` : null;
}
