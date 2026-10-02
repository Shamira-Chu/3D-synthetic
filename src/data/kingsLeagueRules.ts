import { KingsLeagueRule } from '../types';

export const KINGS_LEAGUE_RULES: KingsLeagueRule[] = [
  {
    id: 'double_points',
    name: 'Gol / Ponto Duplo',
    tagline: '2x PONTOS POR ULTRAPASSAGEM',
    description:
      'Inspirada na célebre carta da Kings League! Cada ultrapassagem limpa de Blocker adversária computa 2 pontos imediatos em vez de 1 durante todo o Jam ativo.',
    badge: '2X SCORE',
    color: '#eab308', // Gold
    pointMultiplier: 2,
    jammerSpeedMultiplier: 1.15,
  },
  {
    id: 'duel_1v1',
    name: 'Duelo de Jammers 1v1',
    tagline: 'SEM BLOCKERS NA PISTA',
    description:
      'Como a carta 1v1 da Kings League: todas as barreiras defensivas são evacuadas da pista! Restam apenas as duas Jammers em um duelo puro de aceleração e manobras.',
    badge: '1V1 SHOWDOWN',
    color: '#ec4899', // Pink
    pointMultiplier: 1.5,
    jammerSpeedMultiplier: 1.3,
    is1v1Duel: true,
  },
  {
    id: 'instant_penalty',
    name: 'Pênalti do Presidente',
    tagline: 'BLOCKER RIVAL NA PENALTY BOX',
    description:
      'Cartão Vermelho imediato! A Blocker mais experiente da equipe adversária é enviada diretamente para a Penalty Box por 30 segundos, abrindo um corredor livre para sua Jammer.',
    badge: 'PENALTY BOX',
    color: '#ef4444', // Red
    pointMultiplier: 1,
    jammerSpeedMultiplier: 1.1,
    instantPenalty: true,
  },
  {
    id: 'super_nitro',
    name: 'Super Nitro Turbo',
    tagline: 'VELOCIDADE +60% & APEX BOOST',
    description:
      'Propulsores quânticos ativados nos patins! A Jammer ganha aceleração insana, faíscas neon e facilidade para saltar barreiras em Apex Jumps supersônicos.',
    badge: 'NITRO BOOST',
    color: '#06b6d4', // Cyan
    pointMultiplier: 1.5,
    jammerSpeedMultiplier: 1.6,
  },
  {
    id: 'reverse_track',
    name: 'Pista Invertida (Reverse Jam)',
    tagline: 'PATINAÇÃO NO SENTIDO HORÁRIO',
    description:
      'Caos tático total! O sentido tradicional anti-horário é revertido: as barreiras de Blockers ficam desorientadas e a pista precisa ser percorrida no sentido horário.',
    badge: 'REVERSE TRACK',
    color: '#8b5cf6', // Violet
    pointMultiplier: 2,
    jammerSpeedMultiplier: 1.1,
    isReverse: true,
  },
  {
    id: 'golden_star',
    name: 'Estrela de Ouro (+5 Pontos)',
    tagline: 'BÔNUS DE 5 PONTOS POR APEX',
    description:
      'Uma Golden Star flutuante brilha na linha interna da curva do ápice. O primeiro salto ou passagem limpa pela linha concede um jackpot instantâneo de +5 pontos!',
    badge: 'GOLDEN STAR',
    color: '#f59e0b', // Amber
    pointMultiplier: 1,
    jammerSpeedMultiplier: 1.2,
    bonusStarPoints: 5,
  },
  {
    id: 'reduced_2v2',
    name: 'Dado 2v2 (Pista Aberta)',
    tagline: 'APENAS 2 JOGADORAS POR TIME',
    description:
      'Como o clássico dado da Kings League que esvazia o campo! Apenas a Jammer e 1 Blocker permanecem na pista por equipe, transformando o jogo em corrida aberta de pura habilidade.',
    badge: 'DADO 2V2',
    color: '#10b981', // Emerald
    pointMultiplier: 1.5,
    jammerSpeedMultiplier: 1.25,
    is2v2Reduced: true,
  },
  {
    id: 'steal_lead',
    name: 'Roubo de Lead Jammer',
    tagline: 'PRIVILÉGIO DE CALL-OFF IMEDIATO',
    description:
      'Carta secreta de virada! Concede o cobiçado status de Lead Jammer sem precisar ultrapassar o Pack no Initial Pass, permitindo dar Call-Off e encerrar o Jam na hora exata.',
    badge: 'LEAD STEAL',
    color: '#38bdf8', // Sky
    pointMultiplier: 1.5,
    jammerSpeedMultiplier: 1.2,
  },
];
