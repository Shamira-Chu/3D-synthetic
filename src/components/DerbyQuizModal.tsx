import React, { useState } from 'react';
import { X, Award, CheckCircle, AlertCircle, RotateCcw, Trophy } from 'lucide-react';
import confetti from 'canvas-confetti';
import { soundManager } from '../utils/audioEngine';

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    question: 'Quantos pontos uma Jammer marca para cada Blocker adversária ultrapassada legalmente nas passagens pontuadoras?',
    options: ['1 Ponto', '2 Pontos', '3 Pontos', '5 Pontos'],
    correctIndex: 0,
    explanation:
      'Regra WFTDA 2.2: A Jammer ganha 1 ponto por cada Blocker adversária ultrapassada legalmente e dentro dos limites da pista (in-bounds) nas passagens de pontuação após o Initial Pass.',
  },
  {
    question: 'Qual cobertura especial de capacete a jogadora Pivot usa na pista?',
    options: ['Duas Estrelas (Star Helmet Cover)', 'Faixa contínua central (Stripe Helmet Cover)', 'Dourado sólido', 'Estampa quadriculada'],
    correctIndex: 1,
    explanation:
      'A Pivot usa a Stripe Helmet Cover (faixa contínua central) e pode receber o Star Pass da Jammer para se tornar a pontuadora ativa da equipe.',
  },
  {
    question: 'Na Penalty Box oficial da WFTDA, qual banco de cada equipe é identificado com uma estrela?',
    options: ['O banco exclusivo da Jammer', 'O banco da capitã', 'O banco da treinadora (Bench Coach)', 'O banco da Pivot'],
    correctIndex: 0,
    explanation:
      'Na Penalty Box, cada equipe tem 3 bancos específicos: 1 banco destacado com uma Estrela exclusivo para a Jammer e 2 bancos para as Blockers.',
  },
  {
    question: 'Quanto tempo uma patinadora cumpre na Penalty Box por uma penalidade padrão?',
    options: ['15 segundos', '30 segundos', '1 minuto', '2 minutos'],
    correctIndex: 1,
    explanation:
      'Penalidades padrão no Roller Derby WFTDA são cronometradas em exatamente 30 segundos de tempo de Jam ativo pelos NSOs.',
  },
  {
    question: 'Quantos apitos rápidos e curtos indicam o término ou interrupção oficial de um Jam (Call-Off)?',
    options: ['1 apito longo', '2 trinados curtos', '3 apitos médios', '4 apitos rápidos'],
    correctIndex: 3,
    explanation:
      'Quatro apitos rápidos e enérgicos dos árbitros sinalizam o término oficial daquele Jam (Call-Off).',
  },
  {
    question: 'O que é um "Apex Jump" no Roller Derby?',
    options: [
      'Pular para dentro da Penalty Box',
      'Saltar pelo ar no interior da curva para ultrapassar Blockers e aterrissar dentro dos limites da pista',
      'Comemoração com o banco da equipe',
      'Saltar por cima do árbitro',
    ],
    correctIndex: 1,
    explanation:
      'O Apex Jump é uma manobra aérea pela linha interna da curva onde a Jammer aterrissa perfeitamente in-bounds sem tocar o chão fora dos limites.',
  },
];

interface DerbyQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DerbyQuizModal: React.FC<DerbyQuizModalProps> = ({ isOpen, onClose }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [isAnswered, setIsAnswered] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  if (!isOpen) return null;

  const currentQ = QUIZ_QUESTIONS[currentIdx];

  const handleSelectOption = (idx: number) => {
    if (isAnswered) return;
    setSelectedOpt(idx);
    setIsAnswered(true);

    if (idx === currentQ.correctIndex) {
      setScore((s) => s + 1);
      soundManager.playWhistle('lead');
    } else {
      soundManager.playWhistle('penalty');
    }
  };

  const handleNext = () => {
    if (currentIdx + 1 < QUIZ_QUESTIONS.length) {
      setCurrentIdx((c) => c + 1);
      setSelectedOpt(null);
      setIsAnswered(false);
    } else {
      setIsFinished(true);
      soundManager.playCheer();
      try {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 },
        });
      } catch {
        // Confetti fallback
      }
    }
  };

  const handleRestart = () => {
    setCurrentIdx(0);
    setSelectedOpt(null);
    setIsAnswered(false);
    setScore(0);
    setIsFinished(false);
  };

  return (
    <div
      id="derby-quiz-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in"
    >
      <div
        id="derby-quiz-card"
        className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col"
      >
        {/* Top Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-pink-950/40 to-purple-950/40">
          <div className="flex items-center gap-2.5">
            <Trophy className="w-6 h-6 text-pink-400" />
            <div>
              <h2 className="text-lg font-black text-white">Desafio de Regras de Roller Derby</h2>
              <p className="text-xs text-slate-400">Teste seus conhecimentos da pista e regulamentos WFTDA</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {!isFinished ? (
          <div className="p-6 space-y-5">
            {/* Progress Bar */}
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
              <span>
                Pergunta {currentIdx + 1} de {QUIZ_QUESTIONS.length}
              </span>
              <span className="text-cyan-400">Pontuação: {score}</span>
            </div>
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 to-pink-500 transition-all duration-300"
                style={{ width: `${((currentIdx + 1) / QUIZ_QUESTIONS.length) * 100}%` }}
              />
            </div>

            {/* Question Text */}
            <h3 className="text-base font-bold text-white leading-snug">{currentQ.question}</h3>

            {/* Options */}
            <div className="space-y-2.5">
              {currentQ.options.map((opt, idx) => {
                let btnStyle = 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 text-slate-200';
                if (isAnswered) {
                  if (idx === currentQ.correctIndex) {
                    btnStyle = 'bg-emerald-900/60 border-emerald-500 text-emerald-200 font-bold';
                  } else if (selectedOpt === idx) {
                    btnStyle = 'bg-rose-900/60 border-rose-500 text-rose-200';
                  } else {
                    btnStyle = 'bg-slate-800/40 border-slate-800 text-slate-500 opacity-60';
                  }
                }

                return (
                  <button
                    key={idx}
                    disabled={isAnswered}
                    onClick={() => handleSelectOption(idx)}
                    className={`w-full p-3.5 rounded-xl border text-left text-xs sm:text-sm font-semibold transition cursor-pointer flex items-center justify-between gap-3 ${btnStyle}`}
                  >
                    <span>{opt}</span>
                    {isAnswered && idx === currentQ.correctIndex && (
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    )}
                    {isAnswered && selectedOpt === idx && idx !== currentQ.correctIndex && (
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Feedback / Explanation Box */}
            {isAnswered && (
              <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1 text-xs">
                <span className="font-bold text-cyan-400 uppercase tracking-wider block">Explicação da Regra</span>
                <p className="text-slate-300">{currentQ.explanation}</p>
              </div>
            )}

            {/* Next Button */}
            {isAnswered && (
              <button
                onClick={handleNext}
                className="w-full py-3 bg-pink-600 hover:bg-pink-500 text-white rounded-xl text-sm font-bold shadow-lg transition cursor-pointer"
              >
                {currentIdx + 1 < QUIZ_QUESTIONS.length ? 'Próxima Pergunta →' : 'Ver Resultado Final'}
              </button>
            )}
          </div>
        ) : (
          /* Finished State */
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-pink-500/20 border-2 border-pink-500 flex items-center justify-center text-pink-400">
              <Award className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-xl font-black text-white">Desafio Concluído!</h3>
              <p className="text-sm text-slate-300 mt-1">
                Você acertou <span className="font-bold text-pink-400">{score}</span> de{' '}
                <span className="font-bold text-white">{QUIZ_QUESTIONS.length}</span> perguntas!
              </p>
            </div>

            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {score === QUIZ_QUESTIONS.length
                ? 'Conhecimento Perfeito! Você domina as regras da WFTDA como uma árbitra oficial!'
                : score >= 3
                ? 'Ótimo raciocínio de derby! Você já está pronta para alinhar na linha de pivot!'
                : 'Bom esforço! Explore os pontos informativos em 3D pela arena para aprofundar suas táticas e regras.'}
            </p>

            <div className="pt-3 flex gap-3">
              <button
                onClick={handleRestart}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" /> Tentar Novamente
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Voltar à Arena 3D
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
