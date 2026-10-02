import React, { useState } from 'react';
import {
  Compass,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Eye,
  Camera,
  Layers,
  HelpCircle,
  Zap,
  MapPin,
  ChevronDown,
  Sparkles,
  Keyboard,
  X,
} from 'lucide-react';
import { InfoPoint, ViewMode, CameraPreset } from '../types';
import { INFO_POINTS, CAMERA_PRESETS } from '../data/infoPointsData';
import { soundManager } from '../utils/audioEngine';

interface HUDProps {
  nearestPoint: InfoPoint | null;
  onInteractNearest: () => void;
  onSelectInfoPoint: (point: InfoPoint) => void;
  viewMode: ViewMode;
  onChangeViewMode: (mode: ViewMode) => void;
  onSelectPreset: (preset: CameraPreset) => void;
  isJamSimulating: boolean;
  onToggleJamSim: () => void;
  onOpenQuiz: () => void;
  playerPos: { x: number; z: number; rotationY: number };
  onOpenDirectory: () => void;
  isNearTouchTable?: boolean;
  isNearKingsPortal?: boolean;
  onOpenKingsLeague?: () => void;
}

export const HUD: React.FC<HUDProps> = ({
  nearestPoint,
  onInteractNearest,
  onSelectInfoPoint,
  viewMode,
  onChangeViewMode,
  onSelectPreset,
  isJamSimulating,
  onToggleJamSim,
  onOpenQuiz,
  playerPos,
  onOpenDirectory,
  isNearTouchTable,
  isNearKingsPortal,
  onOpenKingsLeague,
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [showPresetsMenu, setShowPresetsMenu] = useState(false);
  const [showSoundboard, setShowSoundboard] = useState(false);
  const [showCommands, setShowCommands] = useState(false);

  const handleToggleMute = () => {
    const muted = soundManager.toggleMute();
    setIsMuted(muted);
  };

  return (
    <div id="roller-derby-hud" className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-3 sm:p-5">
      {/* Top Header Controls Bar */}
      <div className="flex items-start justify-end gap-3 w-full">
        {/* Top Right Controls & Minimap Radar */}
        <div className="pointer-events-auto flex flex-col items-end gap-2.5">
          {/* Top Quick Actions Bar */}
          <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 p-1.5 rounded-xl shadow-xl">
            {/* View Mode Switcher */}
            <div className="flex items-center bg-slate-950/80 p-0.5 rounded-lg border border-slate-800">
              <button
                id="view-mode-fps"
                onClick={() => onChangeViewMode('fps')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition cursor-pointer ${
                  viewMode === 'fps' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
                title="Visão em 1ª Pessoa"
              >
                1ª Pessoa
              </button>
              <button
                id="view-mode-drone"
                onClick={() => onChangeViewMode('drone')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition cursor-pointer ${
                  viewMode === 'drone' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
                title="Visão Aérea (Drone)"
              >
                Drone
              </button>
            </div>

            {/* Presets Teleport Dropdown */}
            <div className="relative">
              <button
                id="camera-presets-btn"
                onClick={() => setShowPresetsMenu(!showPresetsMenu)}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 border border-slate-700 transition cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">Pontos de Vista</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {showPresetsMenu && (
                <div
                  id="presets-menu-dropdown"
                  className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 z-50 text-xs space-y-1"
                >
                  <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Teletransporte para Local
                  </div>
                  {CAMERA_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => {
                        onSelectPreset(preset);
                        setShowPresetsMenu(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-cyan-300 flex items-center justify-between transition cursor-pointer"
                    >
                      <span className="font-semibold">{preset.name}</span>
                      <span className="text-[10px] text-slate-400 capitalize">{preset.category}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Sound Effects & Whistles Button */}
            <button
              id="soundboard-toggle-btn"
              onClick={() => setShowSoundboard(!showSoundboard)}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg border border-slate-700 transition cursor-pointer"
              title="Painel de Apitos e Efeitos de Árbitro"
            >
              <Volume2 className="w-4 h-4" />
            </button>

            {/* Audio Mute Button */}
            <button
              id="mute-toggle-btn"
              onClick={handleToggleMute}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition cursor-pointer"
              title={isMuted ? 'Ativar Áudio' : 'Mutar Áudio'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>

          {/* Soundboard Popover */}
          {showSoundboard && (
            <div className="bg-slate-900 border border-amber-500/40 rounded-xl p-2.5 shadow-2xl text-xs space-y-2 w-64">
              <div className="flex items-center justify-between text-amber-300 font-bold text-[11px] uppercase">
                <span>Sinais de Apito de Árbitros</span>
                <button onClick={() => setShowSoundboard(false)} className="text-slate-400 hover:text-white">✕</button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => soundManager.playWhistle('start')}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-md font-semibold text-slate-200 text-[11px] text-left"
                >
                  1 Apito (Início)
                </button>
                <button
                  onClick={() => soundManager.playWhistle('lead')}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-md font-semibold text-cyan-300 text-[11px] text-left"
                >
                  2 Trinados (Lead)
                </button>
                <button
                  onClick={() => soundManager.playWhistle('penalty')}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-md font-semibold text-rose-300 text-[11px] text-left"
                >
                  1 Longo (Falta)
                </button>
                <button
                  onClick={() => soundManager.playWhistle('calloff')}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-md font-semibold text-amber-300 text-[11px] text-left"
                >
                  4 Rápidos (Término)
                </button>
                <button
                  onClick={() => soundManager.playBuzzer()}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-md font-semibold text-purple-300 text-[11px] text-left"
                >
                  Buzina / Sirene
                </button>
                <button
                  onClick={() => soundManager.playCheer()}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-md font-semibold text-emerald-300 text-[11px] text-left"
                >
                  Torcida / Aplausos
                </button>
              </div>
            </div>
          )}

          {/* Top-Down 2D Radar / Minimap */}
          <div className="bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-xl p-2 shadow-2xl hidden sm:block">
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mb-1 px-1">
              <span>RADAR DA PISTA</span>
              <Compass className="w-3 h-3 text-cyan-400" />
            </div>
            <div className="relative w-36 h-28 bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex items-center justify-center">
              {/* Oval Track visual */}
              <div className="absolute w-28 h-18 border-2 border-dashed border-cyan-500/40 rounded-full" />
              <div className="absolute w-20 h-10 border border-pink-500/30 rounded-full bg-slate-950/60" />

              {/* Info Points markers on Radar */}
              {INFO_POINTS.map((pt) => {
                // Map [-32, 32] -> [0, 100%]
                const left = ((pt.position3D[0] + 32) / 64) * 100;
                const top = ((pt.position3D[2] + 30) / 60) * 100;
                return (
                  <button
                    key={pt.id}
                    onClick={() => onSelectInfoPoint(pt)}
                    className="absolute w-2.5 h-2.5 rounded-full transform -translate-x-1/2 -translate-y-1/2 hover:scale-150 transition cursor-pointer shadow-sm"
                    style={{ left: `${left}%`, top: `${top}%`, backgroundColor: pt.color }}
                    title={pt.title}
                  />
                );
              })}

              {/* Player Position Blip */}
              {(() => {
                const pLeft = ((playerPos.x + 32) / 64) * 100;
                const pTop = ((playerPos.z + 30) / 60) * 100;
                return (
                  <div
                    className="absolute w-3 h-3 bg-white border border-cyan-400 rounded-full transform -translate-x-1/2 -translate-y-1/2 shadow-lg z-10 flex items-center justify-center"
                    style={{ left: `${pLeft}%`, top: `${pTop}%` }}
                  >
                    <div
                      className="w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-b-[6px] border-b-cyan-400 transform"
                      style={{ transform: `rotate(${-playerPos.rotationY}rad)` }}
                    />
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Center Reticle & Dynamic Proximity Prompt */}
      <div className="flex flex-col items-center justify-center">
        {/* Reticle */}
        <div className="w-4 h-4 relative flex items-center justify-center">
          <div className="w-1.5 h-1.5 bg-white/70 rounded-full shadow-sm" />
          <div className="absolute w-6 h-6 border border-white/20 rounded-full" />
        </div>

        {/* Proximity Interaction Prompt (Kings League Portal, Touch Table, or Info Point) */}
        {isNearKingsPortal ? (
          <div
            id="kings-portal-interaction-banner"
            onClick={onOpenKingsLeague}
            className="pointer-events-auto mt-4 px-5 py-3 bg-gradient-to-r from-amber-950/95 via-slate-950/95 to-amber-950/95 backdrop-blur-md border-2 border-amber-400 rounded-2xl shadow-[0_0_35px_rgba(245,158,11,0.5)] flex items-center gap-3.5 cursor-pointer hover:scale-105 transition duration-150 animate-bounce"
          >
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-black text-sm shadow-md">
              👑
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider font-extrabold text-amber-300">
                Sala Secreta da Kings League • Pressione [E] ou Toque
              </div>
              <div className="text-sm font-black text-white flex items-center gap-1.5">
                <span>Entrar no Mini-Game 3D Real (Jammer Speedway)</span>
                <span className="text-amber-400 text-xs">▶</span>
              </div>
            </div>
          </div>
        ) : isNearTouchTable ? (
          <div
            id="touch-table-interaction-banner"
            onClick={onToggleJamSim}
            className="pointer-events-auto mt-4 px-4 py-2.5 bg-slate-950/95 backdrop-blur-md border-2 border-cyan-400 rounded-2xl shadow-2xl flex items-center gap-3 cursor-pointer hover:scale-105 transition duration-150 animate-bounce"
          >
            <div className="w-7 h-7 rounded-xl flex items-center justify-center bg-cyan-400 text-slate-950 font-black text-xs shadow-md">
              E
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider font-bold text-cyan-300">
                Mesa Touch Central • Pressione [E] ou Toque
              </div>
              <div className="text-sm font-black text-white">
                {isJamSimulating ? 'Pausar Simulação do Jam' : 'Iniciar Simulação do Jam'}
              </div>
            </div>
          </div>
        ) : nearestPoint ? (
          <div
            id="interaction-prompt-banner"
            onClick={onInteractNearest}
            className="pointer-events-auto mt-4 px-4 py-2.5 bg-slate-900/95 backdrop-blur-md border-2 rounded-2xl shadow-2xl flex items-center gap-3 cursor-pointer hover:scale-105 transition duration-150 animate-bounce"
            style={{ borderColor: nearestPoint.color }}
          >
            <div
              className="w-7 h-7 rounded-xl flex items-center justify-center text-slate-950 font-bold text-xs shadow-md"
              style={{ backgroundColor: nearestPoint.color }}
            >
              E
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                Pressione [E] ou Toque para Inspecionar
              </div>
              <div className="text-sm font-black text-white">{nearestPoint.title}</div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Bottom Bar: Commands Button, Info Directory & Quiz button */}
      <div className="flex flex-row items-center justify-between gap-3">
        {/* Commands Trigger Button & Popup */}
        <div className="relative pointer-events-auto">
          <button
            id="toggle-commands-btn"
            onClick={() => {
              setShowCommands((prev) => !prev);
              soundManager.playClick();
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold shadow-xl flex items-center gap-2 transition cursor-pointer backdrop-blur-md border ${
              showCommands
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/60 shadow-cyan-500/20 ring-2 ring-cyan-500/30'
                : 'bg-slate-900/90 hover:bg-slate-800 text-slate-100 border-slate-700 hover:border-slate-600'
            }`}
          >
            <Keyboard className="w-4 h-4 text-cyan-400" />
            <span>Comandos</span>
          </button>

          {/* Commands Popover Window */}
          {showCommands && (
            <div className="absolute bottom-full left-0 mb-2.5 w-80 sm:w-96 bg-slate-950/95 backdrop-blur-xl border border-cyan-500/40 rounded-2xl p-4 shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-cyan-500/10 rounded-lg border border-cyan-500/30 text-cyan-400">
                    <Keyboard className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Comandos da Arena</h4>
                    <p className="text-[10px] text-slate-400">Guia de movimentação e câmera</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowCommands(false);
                    soundManager.playClick();
                  }}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-lg transition cursor-pointer"
                  title="Fechar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between bg-slate-900/80 px-3 py-2 rounded-xl border border-slate-800">
                  <span className="text-slate-300 font-medium">Patinar / Mover-se</span>
                  <div className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-white font-mono text-[10px]">W</kbd>
                    <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-white font-mono text-[10px]">A</kbd>
                    <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-white font-mono text-[10px]">S</kbd>
                    <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-white font-mono text-[10px]">D</kbd>
                  </div>
                </div>

                <div className="flex items-center justify-between bg-slate-900/80 px-3 py-2 rounded-xl border border-slate-800">
                  <span className="text-slate-300 font-medium">Girar Câmera</span>
                  <span className="px-2 py-0.5 bg-pink-500/15 rounded border border-pink-500/30 text-pink-300 text-[10px] font-mono">
                    Botão Esquerdo + Arrastar
                  </span>
                </div>

                <div className="flex items-center justify-between bg-slate-900/80 px-3 py-2 rounded-xl border border-slate-800">
                  <span className="text-slate-300 font-medium">Pular / Apex Jump</span>
                  <kbd className="px-2 py-0.5 bg-slate-800 rounded border border-slate-700 text-white font-mono text-[10px]">Espaço</kbd>
                </div>

                <div className="flex items-center justify-between bg-slate-900/80 px-3 py-2 rounded-xl border border-slate-800">
                  <span className="text-slate-300 font-medium">Subir Arquibancada</span>
                  <span className="px-2 py-0.5 bg-cyan-500/15 rounded border border-cyan-500/30 text-cyan-300 text-[10px] font-mono">
                    Aproxime-se das Escadas
                  </span>
                </div>

                <div className="flex items-center justify-between bg-slate-900/80 px-3 py-2 rounded-xl border border-slate-800">
                  <span className="text-slate-300 font-medium">Interagir / Ver Regras</span>
                  <div className="flex items-center gap-1.5">
                    <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-white font-mono text-[10px]">E</kbd>
                    <span className="text-[10px] text-slate-400">ou Clique no Beacon</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons: Kings League Mini-Game, Directory & Rules Quiz */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            id="open-kings-league-btn"
            onClick={onOpenKingsLeague}
            className="px-3.5 py-2 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black rounded-xl text-xs shadow-xl shadow-amber-500/20 flex items-center gap-1.5 transition cursor-pointer active:scale-95"
            title="Entrar na Sala Secreta da Kings League no formato 3D com regras malucas"
          >
            <span className="text-sm">👑</span>
            <span className="hidden sm:inline">Kings League 3D (Mini-Game)</span>
            <span className="sm:hidden">Kings 3D</span>
          </button>

          <button
            id="open-directory-btn"
            onClick={onOpenDirectory}
            className="px-3.5 py-2 bg-slate-900/90 hover:bg-slate-800 text-slate-100 border border-slate-700 rounded-xl text-xs font-bold shadow-xl flex items-center gap-2 transition cursor-pointer backdrop-blur-md"
          >
            <Layers className="w-4 h-4 text-cyan-400" />
            <span>Pontos Interativos ({INFO_POINTS.length})</span>
          </button>

          <button
            id="open-quiz-hud-btn"
            onClick={onOpenQuiz}
            className="px-3.5 py-2 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold shadow-xl flex items-center gap-1.5 transition cursor-pointer"
          >
            <HelpCircle className="w-4 h-4" />
            <span>Quiz de Regras</span>
          </button>
        </div>
      </div>
    </div>
  );
};
