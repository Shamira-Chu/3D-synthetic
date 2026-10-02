import React, { useState } from 'react';
import { X, Search, Filter, Compass, ChevronRight } from 'lucide-react';
import { InfoPoint, InfoCategory } from '../types';
import { INFO_POINTS } from '../data/infoPointsData';
import { soundManager } from '../utils/audioEngine';

interface DirectoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPoint: (point: InfoPoint) => void;
  onOpenKingsLeague?: () => void;
}

export const DirectoryDrawer: React.FC<DirectoryDrawerProps> = ({
  isOpen,
  onClose,
  onSelectPoint,
  onOpenKingsLeague,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  if (!isOpen) return null;

  const categories: { id: string; label: string }[] = [
    { id: 'all', label: 'Todos os Pontos' },
    { id: 'skater', label: 'Patinadoras e Funções' },
    { id: 'referee', label: 'Árbitros e Oficiais' },
    { id: 'track', label: 'Pista e Ápice' },
    { id: 'penalty_box', label: 'Penalty Box (Bancos com Estrela)' },
    { id: 'spectator', label: 'Arquibancadas e Cultura' },
    { id: 'announcer', label: 'Locução e Cronometragem' },
    { id: 'equipment', label: 'Equipamentos e Tecnologia' },
  ];

  const filteredPoints = INFO_POINTS.filter((point) => {
    const matchesSearch =
      point.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      point.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      point.shortLabel.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || point.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div
      id="directory-drawer-backdrop"
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="directory-drawer-panel"
        className="w-full max-w-md bg-slate-900/98 border-l border-slate-700/80 h-full flex flex-col shadow-2xl text-slate-100 animate-in slide-in-from-right duration-200"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <Compass className="w-5 h-5 text-cyan-400" /> Pontos de Informação da Arena
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Explore balizas interativas 3D e regras WFTDA</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Filter */}
        <div className="p-4 border-b border-slate-800 space-y-3 bg-slate-950/40">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar pontos, regras, patins, táticas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-cyan-500 text-slate-950'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Points List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {/* Kings League Arcade Secret Room Card */}
          <div
            onClick={() => {
              onOpenKingsLeague?.();
              soundManager.playTeleport();
              onClose();
            }}
            className="p-3.5 bg-gradient-to-r from-amber-950/70 via-slate-900 to-amber-950/70 hover:from-amber-900/80 hover:to-amber-900/60 border-2 border-amber-500/60 hover:border-amber-400 rounded-xl transition cursor-pointer flex items-center justify-between gap-3 shadow-lg shadow-amber-500/10 group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center text-lg font-black shadow-md shrink-0">
                👑
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-amber-200 group-hover:text-amber-100 transition">
                    Sala Secreta: Kings League Derby 3D
                  </h3>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-400 text-slate-950 uppercase">
                    Parede Norte
                  </span>
                </div>
                <p className="text-xs text-amber-300/80 mt-0.5">
                  Mini-game 3D em tempo real na pele da Jammer com câmeras 1ª/3ª pessoa e cartas secretas
                </p>
              </div>
            </div>
            <div className="flex items-center text-amber-400 group-hover:translate-x-0.5 transition shrink-0">
              <span className="text-[11px] font-bold mr-1 hidden sm:inline">Entrar</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>

          {filteredPoints.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">Nenhum ponto de informação correspondente encontrado.</div>
          ) : (
            filteredPoints.map((point) => (
              <div
                key={point.id}
                onClick={() => {
                  onSelectPoint(point);
                  soundManager.playClick();
                  onClose();
                }}
                className="p-3.5 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/70 hover:border-cyan-500/50 rounded-xl transition cursor-pointer flex items-center justify-between gap-3 group"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-3.5 h-3.5 rounded-full mt-1 shrink-0 shadow-sm"
                    style={{ backgroundColor: point.color }}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition">
                        {point.title}
                      </h3>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{point.subtitle}</p>
                    <span
                      className="inline-block mt-1.5 px-2 py-0.5 rounded text-[10px] font-bold text-slate-950 uppercase"
                      style={{ backgroundColor: point.color }}
                    >
                      {point.badge}
                    </span>
                  </div>
                </div>

                <div className="flex items-center text-slate-500 group-hover:text-cyan-400 transition shrink-0">
                  <span className="text-[11px] font-semibold mr-1 hidden sm:inline">Examinar</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-950/60 text-center text-[11px] text-slate-400">
          Clique em qualquer cartão para se teletransportar na arena 3D e ler detalhes
        </div>
      </div>
    </div>
  );
};
