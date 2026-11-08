import type { CSSProperties } from 'react';

const colors = ['hsl(var(--primary))', '#f59e0b', '#f97373', '#53b6a1', '#f8c85a'];
const pieces = Array.from({ length: 32 }, (_, index) => {
  const side = index % 2 === 0 ? -1 : 1;
  return {
    left: 27 + ((index * 37) % 46),
    x: side * (30 + (index * 29) % 70),
    y: -(95 + (index * 41) % 155),
    rotate: side * (220 + (index * 47) % 360),
    delay: (index * 19) % 260,
    color: colors[index % colors.length]
  };
});

export function TrainingConfetti() {
  return <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0">
    {pieces.map((piece, index) => <span key={index} className="training-confetti-piece" style={{ left: `${piece.left}%`, backgroundColor: piece.color, animationDelay: `${piece.delay}ms`, '--confetti-x': `${piece.x}px`, '--confetti-y': `${piece.y}px`, '--confetti-rotate': `${piece.rotate}deg` } as CSSProperties}/>)}
  </div>;
}
