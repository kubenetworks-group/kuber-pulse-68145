import { useEffect, useState } from "react";

interface Particle {
  id: number;
  size: number;
  left: number;
  duration: number;
  delay: number;
  opacity: number;
}

export const AnimatedParticles = () => {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    // Generate random particles
    const generatedParticles: Particle[] = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      size: Math.random() * 3 + 1, // 1-4px
      left: Math.random() * 100, // 0-100%
      duration: Math.random() * 20 + 15, // 15-35s
      delay: Math.random() * 10, // 0-10s
      opacity: Math.random() * 0.5 + 0.2, // 0.2-0.7
    }));
    setParticles(generatedParticles);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute rounded-full bg-primary animate-float"
          style={{
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            left: `${particle.left}%`,
            opacity: particle.opacity,
            animation: `float ${particle.duration}s linear infinite`,
            animationDelay: `${particle.delay}s`,
            top: '100%',
            boxShadow: `0 0 ${particle.size * 2}px hsl(var(--primary))`,
          }}
        />
      ))}
      
      {/* Shooting stars */}
      <div className="shooting-star" style={{ animationDelay: '2s' }} />
      <div className="shooting-star" style={{ animationDelay: '8s', left: '70%' }} />
      <div className="shooting-star" style={{ animationDelay: '15s', left: '30%' }} />
    </div>
  );
};
