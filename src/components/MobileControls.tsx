import React, { useRef, useState } from 'react';
import { ArrowUp, Zap, ChevronUp } from 'lucide-react';

interface MobileControlsProps {
  onMoveVectorChange: (vector: { x: number; y: number }) => void;
  onTouchLookChange: (vector: { x: number; y: number }) => void;
  onJumpPress: () => void;
  isSprint: boolean;
  onToggleSprint: () => void;
}

export const MobileControls: React.FC<MobileControlsProps> = ({
  onMoveVectorChange,
  onTouchLookChange,
  onJumpPress,
  isSprint,
  onToggleSprint,
}) => {
  const joystickRef = useRef<HTMLDivElement>(null);
  const [joystickPos, setJoystickPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingJoystick, setIsDraggingJoystick] = useState(false);
  const lookTouchIdRef = useRef<number | null>(null);
  const lastLookPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Joystick touch handlers
  const handleJoystickStart = (e: React.TouchEvent) => {
    e.preventDefault();
    setIsDraggingJoystick(true);
    updateJoystick(e.touches[0]);
  };

  const handleJoystickMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (!isDraggingJoystick) return;
    updateJoystick(e.touches[0]);
  };

  const handleJoystickEnd = () => {
    setIsDraggingJoystick(false);
    setJoystickPos({ x: 0, y: 0 });
    onMoveVectorChange({ x: 0, y: 0 });
  };

  const updateJoystick = (touch: React.Touch) => {
    if (!joystickRef.current) return;
    const rect = joystickRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const maxRadius = rect.width / 2 - 10;

    const dx = touch.clientX - centerX;
    const dy = touch.clientY - centerY;
    const dist = Math.hypot(dx, dy);

    let normX = dx;
    let normY = dy;
    if (dist > maxRadius) {
      normX = (dx / dist) * maxRadius;
      normY = (dy / dist) * maxRadius;
    }

    setJoystickPos({ x: normX, y: normY });
    onMoveVectorChange({
      x: normX / maxRadius,
      y: normY / maxRadius,
    });
  };

  // Right side touch look swipe handler
  const handleLookTouchStart = (e: React.TouchEvent) => {
    if (lookTouchIdRef.current === null) {
      const touch = e.changedTouches[0];
      lookTouchIdRef.current = touch.identifier;
      lastLookPosRef.current = { x: touch.clientX, y: touch.clientY };
    }
  };

  const handleLookTouchMove = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === lookTouchIdRef.current) {
        const deltaX = touch.clientX - lastLookPosRef.current.x;
        const deltaY = touch.clientY - lastLookPosRef.current.y;
        onTouchLookChange({ x: deltaX * 0.05, y: deltaY * 0.05 });
        lastLookPosRef.current = { x: touch.clientX, y: touch.clientY };
        break;
      }
    }
  };

  const handleLookTouchEnd = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === lookTouchIdRef.current) {
        lookTouchIdRef.current = null;
        onTouchLookChange({ x: 0, y: 0 });
        break;
      }
    }
  };

  return (
    <div className="md:hidden pointer-events-none absolute inset-0 z-30 flex items-end justify-between p-4 pb-8">
      {/* Virtual Joystick for Movement */}
      <div
        ref={joystickRef}
        onTouchStart={handleJoystickStart}
        onTouchMove={handleJoystickMove}
        onTouchEnd={handleJoystickEnd}
        className="pointer-events-auto relative w-28 h-28 rounded-full bg-slate-900/60 backdrop-blur-md border-2 border-slate-700/80 flex items-center justify-center shadow-2xl"
      >
        <div
          className="w-12 h-12 rounded-full bg-gradient-to-tr from-cyan-500 to-cyan-400 shadow-lg flex items-center justify-center transform transition-transform"
          style={{
            transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)`,
          }}
        >
          <div className="w-4 h-4 rounded-full bg-slate-950/40" />
        </div>
      </div>

      {/* Right-Side Touch Look Area & Action Buttons */}
      <div className="pointer-events-auto flex items-end gap-3">
        {/* Sprint Button */}
        <button
          onClick={onToggleSprint}
          className={`w-13 h-13 rounded-full border flex items-center justify-center shadow-xl transition cursor-pointer ${
            isSprint
              ? 'bg-amber-500 text-slate-950 border-amber-300'
              : 'bg-slate-900/80 text-amber-400 border-slate-700'
          }`}
          aria-label="Patinar em Velocidade / Sprint"
        >
          <Zap className="w-5 h-5 fill-current" />
        </button>

        {/* Jump / Apex Leap Button */}
        <button
          onClick={onJumpPress}
          className="w-15 h-15 rounded-full bg-cyan-600 active:bg-cyan-500 text-white border-2 border-cyan-400 flex items-center justify-center shadow-2xl transition cursor-pointer"
          aria-label="Pular / Salto de Ápice"
        >
          <ChevronUp className="w-7 h-7" />
        </button>

        {/* Look Touch Pad Zone */}
        <div
          onTouchStart={handleLookTouchStart}
          onTouchMove={handleLookTouchMove}
          onTouchEnd={handleLookTouchEnd}
          className="absolute right-0 top-20 bottom-24 w-1/2 pointer-events-auto"
        />
      </div>
    </div>
  );
};
