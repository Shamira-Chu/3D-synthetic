import { InfoPoint, CameraPreset } from '../types';

export const INFO_POINTS: InfoPoint[] = [
  {
    id: 'jammer-star',
    title: 'Jammer & Star Helmet Cover',
    shortLabel: 'Jammer & Star Helmet Cover',
    category: 'skater',
    position3D: [-6, 1.2, 11.5],
    subtitle: 'A única patinadora apta a marcar pontos para a equipe',
    description:
      'A Jammer veste a Star Helmet Cover (touca com duas grandes estrelas). Em cada Jam, as Jammers se posicionam atrás da Jammer Line, 9 metros atrás do Pack de Blockers. Ao apito inicial, elas rompem o Pack adversário. A primeira Jammer que ultrapassa todas as Blockers legalmente no Initial Pass conquista o cobiçado status de Lead Jammer, ganhando o poder tático de encerrar o Jam de 2 minutos dando toques sucessivos nos quadris (Call-Off).',
    wftdaRule: 'Regra WFTDA 2.2: Elegibilidade e Pontuação da Jammer (1 pt por Blocker ultrapassada legalmente)',
    tactics: [
      'Apex Jumps: Saltar pelo ar por dentro da curva da pista para ultrapassar a barreira de Blockers sem pisar Out of Bounds.',
      'Whips & Pushes: Segurar o braço ou quadril de uma colega de equipe para ser arremessada à frente com aceleração máxima.',
      'Lead Call-Off: Encerrar o Jam imediatamente após marcar 4 pontos para impedir a Jammer rival de pontuar.',
    ],
    equipmentOrDetails: [
      { label: 'Identificação', value: 'Duas Estrelas no capacete (Star Helmet Cover)' },
      { label: 'Função Principal', value: 'Romper o Pack adversário e marcar pontos' },
      { label: 'Privilégio Tático', value: 'Poder de encerrar o Jam antecipadamente (Lead Jammer)' },
      { label: 'Configuração de Rodas', value: 'Dureza 91A-93A (boa tração para aceleração e agilidade)' },
    ],
    whistleCue: 'lead',
    trivia:
      'Uma Jammer pode transferir sua touca de estrela para sua Pivot durante o Jam (manobra oficial chamada "Star Pass"), passando a responsabilidade de pontuar em tempo real!',
    color: '#ec4899', // Pink
    badge: 'STAR JAMMER',
    iconName: 'Star',
  },
  {
    id: 'pivot-stripe',
    title: 'Pivot & Stripe Helmet Cover',
    shortLabel: 'Pivot & Stripe Helmet Cover',
    category: 'skater',
    position3D: [-15, 1.2, 11.2],
    subtitle: 'Diretora de pista, âncora do Pack e pontuadora reserva',
    description:
      'A Pivot usa a Stripe Helmet Cover com uma faixa longitudinal central contínua da frente para trás do capacete. Alinhada na Pivot Line à frente do Pack no início do Jam, ela dita o ritmo de patinação, comanda a comunicação da barreira defensiva e é a única patinadora apta a receber o Star Pass da Jammer para se converter na Jammer ativa.',
    wftdaRule: 'Regra WFTDA 2.3 e 2.4.2: Designação de Pivot e Passe de Estrela (Star Pass)',
    tactics: [
      'Receptora do Star Pass: Receber a touca de estrela mão a mão da Jammer para assumir imediatamente o ataque.',
      'Pace Control: Acelerar ou desacelerar o Pack para complicar a passagem da Jammer adversária.',
      'Âncora Frontal: Atuar como última linha de contenção na frente da barreira de Blockers.',
    ],
    equipmentOrDetails: [
      { label: 'Identificação', value: 'Faixa contínua central no capacete (Stripe Helmet Cover)' },
      { label: 'Posição Inicial', value: 'Pivot Line (à frente do Pack)' },
      { label: 'Habilidade Chave', value: 'Visão de jogo, liderança vocal e leitura de pista' },
    ],
    whistleCue: 'start',
    trivia:
      'Durante um Star Pass, a touca de estrela deve ser entregue mão a mão ou recolhida do chão de forma limpa; arremessar a touca resulta em penalidade imediata!',
    color: '#06b6d4', // Cyan
    badge: 'STRIPE PIVOT',
    iconName: 'Shield',
  },
  {
    id: 'blocker-wall',
    title: 'Tripod de Blockers & Formação de Barreira',
    shortLabel: 'Tripod de Blockers',
    category: 'skater',
    position3D: [-12, 1.2, 11.5],
    subtitle: 'Formações de barreira simultaneamente defensivas e ofensivas',
    description:
      'Cada equipe alinha 3 Blockers (mais a Pivot) na pista formando o Pack. No Roller Derby moderno, as Blockers atuam em "Tripods" — duas patinadoras de costas/quadris unidas ("butt-to-butt") e uma patinadora de frente ("brace") guiando o deslocamento lateral. O esporte é singular porque defesa e ataque ocorrem ao mesmo tempo: conter a Jammer inimiga e abrir trilhas para a sua.',
    wftdaRule: 'Regra WFTDA 2.4 e 4.1: Zonas de Bloqueio e Áreas de Contato Legal',
    tactics: [
      'Tripod Formation: Três patinadoras formando uma barreira triangular intransponível com alta mobilidade.',
      'Runbacks (Reciclagem): Forçar a Jammer adversária para Out of Bounds e patinar para trás no sentido horário para forçá-la a reentrar atrás de todo o Pack.',
      'Offensive Sweeps: Deslocar Blockers rivais com impacto nos quadris para liberar a linha interna para sua Jammer.',
    ],
    equipmentOrDetails: [
      { label: 'Zonas de Contato Legal', value: 'Quadris, Glúteos, Tronco, Ombros e Braços Superiores' },
      { label: 'Contatos Ilegais', value: 'Cotovelos, Cabeça, Abaixo do Joelho, Antebraços e Bloqueio nas Costas' },
      { label: 'Regra do Pack', value: 'Devem permanecer a até 3 metros do maior grupo de Blockers' },
    ],
    whistleCue: 'penalty',
    trivia:
      'Se as Blockers se afastarem mais de 3 metros entre si, os árbitros declaram "No Pack!" e todo bloqueio deve cessar imediatamente até a recomposição!',
    color: '#8b5cf6', // Purple
    badge: 'TRIPOD BLOCKERS',
    iconName: 'Users',
  },
  {
    id: 'jam-referee',
    title: 'Jam Referee (O Seguidor Zebra)',
    shortLabel: 'Jam Referee (Oficial)',
    category: 'referee',
    position3D: [-4, 1.2, 5.0],
    subtitle: 'Oficial dedicado a monitorar exclusivamente uma Jammer',
    description:
      'Cada equipe possui um Jam Referee dedicado, vestindo munhequeira ou capacete com a cor correspondente da equipe. O Jam Ref patina pelo Infield lado a lado com sua Jammer, validando cada ultrapassagem legal, assinalando os pontos com gestos para a mesa de NSOs e sinalizando o status de Lead Jammer com dois apitos enérgicos e o braço apontado para a patinadora.',
    wftdaRule: 'Manual de Arbitragem WFTDA: Seção 3 - Responsabilidades do Jam Referee',
    tactics: [
      'Sinal de Lead Jammer: Apontar para a Jammer com uma mão e erguer a outra no ar.',
      'Sinalização de Pontos: Levantar de 1 a 4 dedos sobre a cabeça a cada volta completa sobre oponentes.',
      'Perda de Lead: Tocar os quadris caso a Jammer cometa penalidade e perca o privilégio de Lead.',
    ],
    equipmentOrDetails: [
      { label: 'Uniforme', value: 'Listras verticais clássicas pretas e brancas de 2,5 cm (Zebra)' },
      { label: 'Equipamento Essencial', value: 'Apito Fox 40 sem esfera e patins quad de alta velocidade' },
      { label: 'Posicionamento', value: 'Interior da pista (Infield), acompanhando o ritmo da Jammer' },
    ],
    whistleCue: 'lead',
    trivia:
      'Em uma partida de 60 minutos, os Jam Refs costumam patinar em ritmo acelerado e percorrer maior distância contínua do que muitas jogadoras!',
    color: '#f59e0b', // Amber
    badge: 'JAM REFEREE',
    iconName: 'Award',
  },
  {
    id: 'pack-referee',
    title: 'Pack Referees (IPRs e OPRs)',
    shortLabel: 'Pack Referees',
    category: 'referee',
    position3D: [12, 1.2, -14.5],
    subtitle: 'Fiscalização do Pack e aplicação de penalidades por faltas',
    description:
      'Até cinco Pack Referees monitoram o grupo de Blockers. Os Inside Pack Referees (IPRs) patinam no Infield e os Outside Pack Referees (OPRs) no perímetro exterior. Eles fiscalizam cortes de pista ("Track Cuts"), contatos ilegais (cotoveladas, trancos nas costas), saídas de pista e coesão do Pack.',
    wftdaRule: 'Regra WFTDA 5: Penalidades e Aplicação',
    tactics: [
      'Chamada de Penalidade: Verbalizar Cor do Time, Número da Atleta, Nome da Infração + 1 apito longo.',
      'Alerta de No Pack: Gritar "No Pack!" com ambos os braços abertos ao romper a coesão do grupo.',
      'Controle de Reentrada: Garantir que atletas que saíram da pista retornem atrás de quem tinha posição legal.',
    ],
    equipmentOrDetails: [
      { label: 'Faltas Comuns', value: 'Track Cut, Antebraço, Bloqueio Alto, Bloqueio nas Costas e Bloqueio Baixo' },
      { label: 'Tempo de Punição', value: '30 segundos na Penalty Box por infração' },
      { label: 'Limite de Faltas', value: '7 penalidades em uma partida resultam em expulsão (Foul Out)' },
    ],
    whistleCue: 'penalty',
    trivia:
      'Os árbitros devem anunciar as faltas no padrão internacional: "Cor, Número, Infração!" Exemplo: "Cyan, 07, Track Cut!"',
    color: '#10b981', // Emerald
    badge: 'PACK REFEREES',
    iconName: 'Flame',
  },
  {
    id: 'penalty-box',
    title: 'Penalty Box (Bancos com Estrela & NSOs)',
    shortLabel: 'Penalty Box & NSOs',
    category: 'penalty_box',
    position3D: [0, 0.8, -2.2],
    subtitle: 'Local onde as patinadoras cumprem 30 segundos por infrações',
    description:
      'Localizada no centro da pista (Infield), a Penalty Box oficial possui três bancos para cada equipe: 1 banco de Jammer identificado com uma Estrela dourada e 2 bancos para Blockers. A atleta entra patinando, senta-se completamente e aguarda a cronometragem dos NSOs (Non-Skating Officials). Aos 20 segundos de Jam ativo o oficial avisa "Stand up"; aos 30 segundos exatos, sinaliza "Done" liberando-a de volta à pista.',
    wftdaRule: 'Regra WFTDA 6: Protocolo da Penalty Box e Cronometragem',
    tactics: [
      'Power Jam: Quando a Jammer adversária está na Penalty Box, sua equipe desfruta de ampla vantagem ofensiva.',
      'Reentrada Limpa: Retornar à pista pela retaguarda do Pack sem cortar patinadoras ativas.',
      'Transição entre Jams: Se o Jam terminar com a jogadora na Penalty Box, o tempo residual passa para o Jam seguinte.',
    ],
    equipmentOrDetails: [
      { label: 'Assento da Jammer', value: 'Banco de cada equipe demarcado com uma Estrela' },
      { label: 'Duração da Pena', value: '30 segundos de tempo de Jam ativo' },
      { label: 'Oficiais Dedicados', value: 'Penalty Box NSOs (cronometristas e anotadores)' },
      { label: 'Regra de Assento', value: 'Deve permanecer sentada até a instrução do oficial aos 20s' },
    ],
    whistleCue: 'timeout',
    trivia:
      'Se ambas as Jammers forem punidas ao mesmo tempo, a segunda Jammer cumpre apenas o tempo que a primeira Jammer permaneceu na Penalty Box!',
    color: '#ef4444', // Red
    badge: 'PENALTY BOX',
    iconName: 'Clock',
  },
  {
    id: 'oval-track-apex',
    title: 'Pista Oval Oficial e a Curva do Ápice',
    shortLabel: 'Pista Oval & Curva do Ápice',
    category: 'track',
    position3D: [18, 0.8, 4.0],
    subtitle: 'Geometria oficial WFTDA de pista plana com curvas dinâmicas',
    description:
      'Uma pista plana oficial WFTDA mede aproximadamente 33 metros de comprimento por 23 metros de largura. Possui duas retas e duas curvas fechadas. A pista é delimitada por linhas de 5 cm (interna e externa), marcas de intervalo de 3 metros, a Linha de Pivot à frente e a Linha de Jammer 9 metros atrás. O tráfego de patinação é exclusivamente no sentido anti-horário.',
    wftdaRule: 'Apêndice A da WFTDA: Especificações Oficiais da Pista',
    tactics: [
      'Apex Jump: Jammers saltam antes da curva, voando por cima da área interna e aterrissando na pista sem tocar fora dos limites.',
      'Inclinação Centrífuga: Usar as bordas internas das rodas de 4 eixos para contornar curvas a mais de 30 km/h.',
      'Área de Segurança: Uma faixa de recuo de 3 metros cerca todo o perímetro interno e externo da pista.',
    ],
    equipmentOrDetails: [
      { label: 'Superfície', value: 'Piso de madeira polida, placas plásticas esportivas ou concreto liso' },
      { label: 'Sentido de Jogo', value: 'Estritamente Anti-Horário (Derby Direction)' },
      { label: 'Raio das Curvas', value: 'Raio interno aprox. 3,8 m; raio externo aprox. 8 m' },
    ],
    whistleCue: 'start',
    trivia:
      'Patinar no sentido horário ao aplicar um bloqueio é ilegal e rende uma penalidade de "Direção de Jogo"!',
    color: '#3b82f6', // Blue
    badge: 'PISTA OFICIAL',
    iconName: 'Navigation',
  },
  {
    id: 'spectator-stands',
    title: 'Arquibancadas & Cultura da Torcida do Derby',
    shortLabel: 'Arquibancadas & Cultura',
    category: 'spectator',
    position3D: [0, 2.8, 25.5],
    subtitle: 'Comunidade acolhedora, inclusiva e com forte espírito faça-você-mesmo (DIY)',
    description:
      'A torcida de Roller Derby é famosa por sua energia contagiante e atmosfera vibrante. O esporte moderno é gerido pelas próprias atletas ("pelas patinadoras, para as patinadoras"), destacando-se pelo forte compromisso com a inclusão LGBTQIA+, diversidade de corpos e alto rendimento atlético.',
    wftdaRule: 'Código de Conduta e Carta de Esporte Inclusivo da WFTDA',
    tactics: [
      'Batucadas e Sininhos: Ruído constante da torcida durante power jams adversários para dificultar a comunicação tática rival.',
      'Chuck-a-Duck: Tradicional brincadeira de intervalo em que torcedores arremessam patinhos de borracha para arrecadar fundos para a liga.',
      'After-Party do Bout: Tradicional confraternização conjunta entre as duas equipes logo após o apito final do jogo.',
    ],
    equipmentOrDetails: [
      { label: 'Acessórios da Torcida', value: 'Chocalhos, sinos de vaca (cowbells), cartazes e pinturas faciais' },
      { label: 'Tradições', value: 'Derby Names (apelidos criativos), troféus de MVP e trocas de adesivos de ligas' },
      { label: 'Ambiente', value: 'Vibrante, raízes punk-rock, acolhedor para todas as idades e famílias' },
    ],
    whistleCue: 'calloff',
    trivia:
      'Apelidos clássicos de derby misturam trocadilhos e força, como "Freight Train", "Scald Eagle" e "Miracle Whips"!',
    color: '#f97316', // Orange
    badge: 'CULTURA DERBY',
    iconName: 'Heart',
  },
  {
    id: 'announcer-scoreboard',
    title: 'Cabine de Narração e Painel Eletrônico',
    shortLabel: 'Narração & Cronômetros',
    category: 'announcer',
    position3D: [0, 7.8, 18.0],
    subtitle: 'Comentários ao vivo, cronômetro de Jam de 2 minutos e tempos de 30 minutos',
    description:
      'A cabine de narração conduz a energia do ginásio com comentários empolgantes e trilha sonora. Uma partida é dividida em dois tempos de 30 minutos, compostos por múltiplos "jams" de até 2 minutos. Entre um jam e outro, há um intervalo de 30 segundos para o alinhamento das jogadoras. Oficiais Não Patinadores (NSOs) controlam o placar, faltas acumuladas e pedidos de tempo.',
    wftdaRule: 'Regra WFTDA 1: Estrutura da Partida, Períodos e Gerenciamento de Tempo',
    tactics: [
      'Gerenciamento de Tempo: Encerrar o jam faltando poucos segundos para o fim do tempo para negar uma última posse ao rival.',
      'Pedidos de Tempo (Timeouts): Cada time tem direito a três timeouts de 60 segundos por partida para reorganizar a equipe.',
      'Revisão Oficial (Official Review): Solicitar conferência dos árbitros caso haja contestação fundamentada de uma regra.',
    ],
    equipmentOrDetails: [
      { label: 'Duração da Partida', value: 'Dois tempos de 30 minutos (60 min no total)' },
      { label: 'Duração do Jam', value: 'Máximo de 2 minutos (ou até o encerramento pela Lead Jammer)' },
      { label: 'Janela de Alinhamento', value: '30 segundos entre os apitos de término e início' },
    ],
    whistleCue: 'calloff',
    trivia:
      'Um jam é encerrado oficialmente com quatro apitos rápidos e agudos disparados pelos árbitros!',
    color: '#eab308', // Yellow
    badge: 'TRANSMISSÃO AO VIVO',
    iconName: 'Tv',
  },
  {
    id: 'skate-gear-tech',
    title: 'Patins Quad e Equipamento de Proteção',
    shortLabel: 'Equipamentos & Proteção',
    category: 'equipment',
    position3D: [16, 1.2, 17.5],
    subtitle: 'Rodas quad, freios toe stop, bases de alumínio e joelheiras de alto impacto',
    description:
      'O Roller Derby é jogado exclusivamente com patins quad (duas rodas dianteiras, duas traseiras e um freio frontal de borracha - toe stop). As patinadoras ajustam a dureza das rodas (durometer de 84A a 99A) conforme o piso do ginásio. Os itens de proteção obrigatórios incluem capacete multi-impacto, protetor bucal, joelheiras profissionais com placas rígidas, cotoveleiras e munhequeiras reforçadas.',
    wftdaRule: 'Regra WFTDA 9: Equipamento Obrigatório e Padrões de Uniforme',
    tactics: [
      'Corrida no Toe-Stop: Correr na ponta dos pés apoiando-se nos freios de borracha para explosão e arranque instantâneo.',
      'Queda de Joelhos Controlada (Knee Slide): Deslizar com as joelheiras reforçadas para absorver impactos com segurança sem lesões.',
      'Combinação de Rodas (Stagger): Usar rodas mais aderentes no lado interno dos patins para tração máxima nas curvas.',
    ],
    equipmentOrDetails: [
      { label: 'Tipo de Patins', value: 'Botas quad de cano baixo em couro/carbono para máxima flexibilidade no tornozelo' },
      { label: 'Bases (Plates)', value: 'Alumínio aeroespacial ou nylon reforçado com trucks articulados' },
      { label: 'Proteções Obrigatórias', value: 'Capacete, Protetor Bucal, Munhequeiras, Joelheiras e Cotoveleiras' },
    ],
    whistleCue: 'start',
    trivia:
      'Patinar sem protetor bucal ou sem qualquer equipamento de segurança acarreta penalidade imediata e retirada da pista!',
    color: '#14b8a6', // Teal
    badge: 'TECNOLOGIA DE PATINS',
    iconName: 'Zap',
  },
];

export const CAMERA_PRESETS: CameraPreset[] = [
  {
    id: 'jammer_line',
    name: 'Jammer Line (Partida)',
    description: 'Visão atrás da Jammer com Star Helmet Cover na linha de partida',
    position: [-6, 1.6, 11.5],
    lookAt: [-14, 1.2, 11.5],
    category: 'track',
  },
  {
    id: 'turn_apex',
    name: 'Apex da Curva 2',
    description: 'Curva de alta velocidade onde ocorrem Apex Jumps e bloqueios intensos',
    position: [17, 1.6, 3.5],
    lookAt: [14, 1.2, 10.0],
    category: 'track',
  },
  {
    id: 'infield_ref',
    name: 'Infield & Referees',
    description: 'Dentro do Infield observando a movimentação do Pack e das Jammers',
    position: [0, 1.6, 3.0],
    lookAt: [0, 1.4, 11.5],
    category: 'referee',
  },
  {
    id: 'touch_table_cam',
    name: 'Mesa Touch Central (Simulação)',
    description: 'Console tátil holográfico no centro da pista para ativar e desativar o Jam',
    position: [0, 1.5, 2.3],
    lookAt: [0, 1.0, 0],
    category: 'infield',
  },
  {
    id: 'penalty_box_cam',
    name: 'Penalty Box (Bancos com Estrela)',
    description: 'Visão ao nível dos olhos da Penalty Box com os bancos de Jammer identificados com estrela',
    position: [0, 1.4, -1.2],
    lookAt: [0, 1.4, -2.4],
    category: 'penalty_box',
  },
  {
    id: 'spectator_stand',
    name: 'Arquibancada da Torcida',
    description: 'Setor elevado na arquibancada com visão panorâmica de toda a pista oval',
    position: [0, 5.2, 33.0],
    lookAt: [0, 1.0, 0],
    category: 'spectator',
  },
  {
    id: 'announcer_vip',
    name: 'Cabine de Narração (Skybox)',
    description: 'Visão aérea privilegiada da mesa de transmissão acima das arquibancadas',
    position: [0, 9.5, 32.5],
    lookAt: [0, 1.2, 0],
    category: 'announcer',
  },
  {
    id: 'pack_blockers',
    name: 'Tripod de Blockers & Pack',
    description: 'Imersão no meio do Tripod de Blockers contendo a Jammer rival',
    position: [-13.5, 1.5, 11.5],
    lookAt: [-6, 1.3, 11.5],
    category: 'skater',
  },
  {
    id: 'kings_portal_cam',
    name: 'Portal Kings League (Parede Norte)',
    description: 'Visão direta do portal da Sala Secreta com regras aleatórias na parede norte',
    position: [0, 4.2, -27.5],
    lookAt: [0, 5.8, -35.2],
    category: 'track',
  },
];
