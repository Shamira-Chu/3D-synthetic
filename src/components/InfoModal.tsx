import React from 'react';
import {
  Star,
  Shield,
  Users,
  Award,
  Flame,
  Clock,
  Navigation,
  Heart,
  Tv,
  Zap,
  Volume2,
  X,
  ChevronRight,
  BookOpen,
  HelpCircle,
} from 'lucide-react';
import { InfoPoint } from '../types';
import { soundManager } from '../utils/audioEngine';

interface InfoModalProps {
  point: InfoPoint | null;
  onClose: () => void;
  onSelectNext: (offset: number) => void;
  onOpenQuiz: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({ point, onClose, onSelectNext, onOpenQuiz }) => {
  const [activeTab, setActiveTab] = React.useState<'overview' | 'tactics' | 'gear' | 'trivia'>('overview');

  if (!point) return null;

  const getIcon = (name: string) => {
    const props = { className: 'w-6 h-6 text-white' };
    switch (name) {
      case 'Star':
        return <Star {...props} />;
      case 'Shield':
        return <Shield {...props} />;
      case 'Users':
        return <Users {...props} />;
      case 'Award':
        return <Award {...props} />;
      case 'Flame':
        return <Flame {...props} />;
      case 'Clock':
        return <Clock {...props} />;
      case 'Navigation':
        return <Navigation {...props} />;
      case 'Heart':
        return <Heart {...props} />;
      case 'Tv':
        return <Tv {...props} />;
      case 'Zap':
      default:
        return <Zap {...props} />;
    }
  };

  const handlePlayWhistle = () => {
    soundManager.playWhistle(point.whistleCue || 'start');
  };

  return (
    <div
      id="info-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="info-modal-card"
        className="relative w-full max-w-2xl bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[90vh]"
      >
        {/* Color Accent Bar */}
        <div className="h-2 w-full" style={{ backgroundColor: point.color }} />

        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div
              className="p-3 rounded-xl shadow-lg flex items-center justify-center"
              style={{ backgroundColor: point.color }}
            >
              {getIcon(point.iconName)}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="px-2 py-0.5 text-xs font-bold uppercase tracking-wider rounded-md text-slate-950"
                  style={{ backgroundColor: point.color }}
                >
                  {point.badge}
                </span>
                <span className="text-xs text-slate-400 capitalize">Ponto Interativo</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">{point.title}</h2>
              <p className="text-xs sm:text-sm text-slate-300 font-medium">{point.subtitle}</p>
            </div>
          </div>

          <button
            id="close-modal-btn"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-4 sm:px-6 gap-2 overflow-x-auto text-xs sm:text-sm font-semibold">
          <button
            id="tab-overview"
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-3 border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Visão Geral e Regras
          </button>
          <button
            id="tab-tactics"
            onClick={() => setActiveTab('tactics')}
            className={`py-3 px-3 border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'tactics'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Estratégias e Jogadas
          </button>
          {point.equipmentOrDetails && (
            <button
              id="tab-gear"
              onClick={() => setActiveTab('gear')}
              className={`py-3 px-3 border-b-2 transition cursor-pointer whitespace-nowrap ${
                activeTab === 'gear'
                  ? 'border-cyan-400 text-cyan-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Ficha Técnica e Detalhes
            </button>
          )}
          <button
            id="tab-trivia"
            onClick={() => setActiveTab('trivia')}
            className={`py-3 px-3 border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'trivia'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Curiosidades e Cultura
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 text-slate-200 space-y-4 text-sm leading-relaxed">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <p className="text-slate-200 text-base">{point.description}</p>

              {point.wftdaRule && (
                <div className="p-3.5 bg-slate-800/80 border border-slate-700 rounded-xl flex items-start gap-3">
                  <BookOpen className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider block">
                      Código Regulamentar WFTDA
                    </span>
                    <span className="text-sm font-medium text-slate-200">{point.wftdaRule}</span>
                  </div>
                </div>
              )}

              {point.whistleCue && (
                <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Volume2 className="w-4 h-4 text-amber-400" />
                    <span className="text-xs text-slate-300 font-semibold">Sinal Sonoro de Apito Oficial</span>
                  </div>
                  <button
                    id="whistle-test-btn"
                    onClick={handlePlayWhistle}
                    className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5" /> Ouvir Apito
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'tactics' && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Táticas de Pista e Jogadas-Chave</h3>
              <div className="space-y-2.5">
                {point.tactics.map((tac, idx) => (
                  <div key={idx} className="p-3 bg-slate-800/60 border border-slate-700/60 rounded-xl flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold text-xs flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <p className="text-sm text-slate-200">{tac}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'gear' && point.equipmentOrDetails && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Especificações Técnicas</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {point.equipmentOrDetails.map((eq, idx) => (
                  <div key={idx} className="p-3 bg-slate-800/70 border border-slate-700/80 rounded-xl">
                    <span className="text-xs text-slate-400 font-medium block">{eq.label}</span>
                    <span className="text-sm font-bold text-white block mt-0.5">{eq.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'trivia' && (
            <div className="space-y-3">
              <div className="p-4 bg-gradient-to-br from-pink-950/40 to-purple-950/40 border border-pink-500/30 rounded-xl">
                <span className="text-xs font-bold text-pink-400 uppercase tracking-wider block mb-1">
                  Tradições e Cultura Derby
                </span>
                <p className="text-slate-200 text-sm italic">{point.trivia}</p>
              </div>

              <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white">Teste seus Conhecimentos de Roller Derby!</h4>
                  <p className="text-xs text-slate-400">Responda ao desafio interativo de 5 perguntas</p>
                </div>
                <button
                  id="start-quiz-from-modal-btn"
                  onClick={() => {
                    onClose();
                    onOpenQuiz();
                  }}
                  className="px-3.5 py-1.5 bg-pink-600 hover:bg-pink-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <HelpCircle className="w-3.5 h-3.5" /> Fazer Quiz
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs">
          <button
            id="prev-point-btn"
            onClick={() => onSelectNext(-1)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold transition cursor-pointer"
          >
            ← Ponto Anterior
          </button>
          <span className="text-slate-400 font-medium hidden sm:inline">Use WASD para explorar em 3D</span>
          <button
            id="next-point-btn"
            onClick={() => onSelectNext(1)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold transition flex items-center gap-1 cursor-pointer"
          >
            Próximo Ponto <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
