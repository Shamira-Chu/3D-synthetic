/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Arena3D } from './components/Arena3D';
import { HUD } from './components/HUD';
import { InfoModal } from './components/InfoModal';
import { DirectoryDrawer } from './components/DirectoryDrawer';
import { DerbyQuizModal } from './components/DerbyQuizModal';
import { MobileControls } from './components/MobileControls';
import { KingsLeagueMiniGame } from './components/KingsLeagueMiniGame';
import { InfoPoint, ViewMode, CameraPreset } from './types';
import { INFO_POINTS } from './data/infoPointsData';
import { soundManager } from './utils/audioEngine';

export default function App() {
  const [selectedInfoPoint, setSelectedInfoPoint] = useState<InfoPoint | null>(null);
  const [nearestPoint, setNearestPoint] = useState<InfoPoint | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<CameraPreset | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('fps');
  const [isJamSimulating, setIsJamSimulating] = useState<boolean>(true);
  const [isDirectoryOpen, setIsDirectoryOpen] = useState<boolean>(false);
  const [isQuizOpen, setIsQuizOpen] = useState<boolean>(false);
  const [isNearTouchTable, setIsNearTouchTable] = useState<boolean>(false);
  const [isNearKingsPortal, setIsNearKingsPortal] = useState<boolean>(false);
  const [isKingsLeagueOpen, setIsKingsLeagueOpen] = useState<boolean>(false);

  // Mobile virtual joystick & touch look state
  const [joystickVector, setJoystickVector] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [touchLookVector, setTouchLookVector] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isJumpRequested, setIsJumpRequested] = useState<boolean>(false);
  const [isSprintActive, setIsSprintActive] = useState<boolean>(false);

  // Player position for HUD radar compass
  const [playerPos, setPlayerPos] = useState<{ x: number; z: number; rotationY: number }>({
    x: -6,
    z: 11.5,
    rotationY: Math.PI / 2,
  });

  // Handle interacting with nearest point (via 'E' or UI click)
  const handleInteractNearest = useCallback(() => {
    if (nearestPoint) {
      setSelectedInfoPoint(nearestPoint);
      soundManager.playClick();
    }
  }, [nearestPoint]);

  // Handle cycling through next/previous info point inside modal
  const handleCyclePoint = (offset: number) => {
    if (!selectedInfoPoint) return;
    const currentIdx = INFO_POINTS.findIndex((p) => p.id === selectedInfoPoint.id);
    if (currentIdx === -1) return;
    let nextIdx = currentIdx + offset;
    if (nextIdx < 0) nextIdx = INFO_POINTS.length - 1;
    if (nextIdx >= INFO_POINTS.length) nextIdx = 0;
    setSelectedInfoPoint(INFO_POINTS[nextIdx]);
    soundManager.playClick();
  };

  // Keyboard shortcut listener for ESC to close modals/drawers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isKingsLeagueOpen) setIsKingsLeagueOpen(false);
        if (selectedInfoPoint) setSelectedInfoPoint(null);
        if (isDirectoryOpen) setIsDirectoryOpen(false);
        if (isQuizOpen) setIsQuizOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedInfoPoint, isDirectoryOpen, isQuizOpen, isKingsLeagueOpen]);

  return (
    <main
      id="roller-derby-arena-root"
      className="relative w-screen h-screen overflow-hidden bg-slate-950 text-slate-100 select-none font-sans"
    >
      {/* 3D Three.js First-Person Arena Canvas */}
      {!isKingsLeagueOpen && (
        <Arena3D
          onSelectInfoPoint={setSelectedInfoPoint}
          activeInfoPoint={selectedInfoPoint}
          selectedPreset={selectedPreset}
          onClearPreset={() => setSelectedPreset(null)}
          viewMode={viewMode}
          isJamSimulating={isJamSimulating}
          onToggleJamSim={() => setIsJamSimulating((prev) => !prev)}
          joystickVector={joystickVector}
          touchLookVector={touchLookVector}
          isJumpRequested={isJumpRequested}
          isSprintActive={isSprintActive}
          onInteractNearest={handleInteractNearest}
          setNearestPoint={setNearestPoint}
          playerPos={playerPos}
          setPlayerPos={setPlayerPos}
          setIsNearTouchTable={setIsNearTouchTable}
          setIsNearKingsPortal={setIsNearKingsPortal}
          onOpenKingsLeague={() => setIsKingsLeagueOpen(true)}
        />
      )}

      {/* First-Person HUD Layer */}
      {!isKingsLeagueOpen && (
        <HUD
          nearestPoint={nearestPoint}
          onInteractNearest={handleInteractNearest}
          onSelectInfoPoint={(pt) => {
            setSelectedInfoPoint(pt);
            soundManager.playClick();
          }}
          viewMode={viewMode}
          onChangeViewMode={(mode) => {
            setViewMode(mode);
            soundManager.playClick();
          }}
          onSelectPreset={(preset) => setSelectedPreset(preset)}
          isJamSimulating={isJamSimulating}
          onToggleJamSim={() => {
            setIsJamSimulating((prev) => !prev);
            soundManager.playClick();
          }}
          onOpenQuiz={() => {
            setIsQuizOpen(true);
            soundManager.playClick();
          }}
          playerPos={playerPos}
          onOpenDirectory={() => {
            setIsDirectoryOpen(true);
            soundManager.playClick();
          }}
          isNearTouchTable={isNearTouchTable}
          isNearKingsPortal={isNearKingsPortal}
          onOpenKingsLeague={() => {
            setIsKingsLeagueOpen(true);
            soundManager.playTeleport();
          }}
        />
      )}

      {/* Mobile Touch Virtual Controls */}
      {!isKingsLeagueOpen && (
        <MobileControls
          onMoveVectorChange={setJoystickVector}
          onTouchLookChange={setTouchLookVector}
          onJumpPress={() => {
            setIsJumpRequested(true);
            setTimeout(() => setIsJumpRequested(false), 200);
          }}
          isSprint={isSprintActive}
          onToggleSprint={() => setIsSprintActive((s) => !s)}
        />
      )}

      {/* Detailed Interactive Information Modal */}
      <InfoModal
        point={selectedInfoPoint}
        onClose={() => setSelectedInfoPoint(null)}
        onSelectNext={handleCyclePoint}
        onOpenQuiz={() => setIsQuizOpen(true)}
      />

      {/* Information Points Directory Drawer */}
      <DirectoryDrawer
        isOpen={isDirectoryOpen}
        onClose={() => setIsDirectoryOpen(false)}
        onSelectPoint={(pt) => {
          setSelectedInfoPoint(pt);
        }}
        onOpenKingsLeague={() => {
          setIsKingsLeagueOpen(true);
          soundManager.playTeleport();
        }}
      />

      {/* Derby Rules Quiz Modal */}
      <DerbyQuizModal isOpen={isQuizOpen} onClose={() => setIsQuizOpen(false)} />

      {/* Kings League Secret Room Arcade Mini-Game */}
      <KingsLeagueMiniGame
        isOpen={isKingsLeagueOpen}
        onClose={() => setIsKingsLeagueOpen(false)}
      />
    </main>
  );
}
