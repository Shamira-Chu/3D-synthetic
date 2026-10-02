# 🛼 DERBY SYNTHETICA — Arena 3D de Roller Derby

![Derby Synthetica](https://img.shields.io/badge/Status-Publicado-brightgreen?style=for-the-badge) ![Three.js](https://img.shields.io/badge/Three.js-WebGL-black?style=for-the-badge&logo=three.js) ![React](https://img.shields.io/badge/React_19-Vite-blue?style=for-the-badge&logo=react) ![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=for-the-badge&logo=tailwindcss)

**DERBY SYNTHETICA** é uma experiência 3D imersiva interativa em tempo real de uma arena profissional de **Roller Derby** com pista oval regulamentar WFTDA, mega telões LED, pontos de informação interativos, quiz de regras em português, mini-game arcade secreto "Kings League" e suporte completo a dispositivos móveis e desktop.

---

## 🌟 Principais Recursos

- 🏟️ **Arena 3D em Primeira Pessoa (FPS):** Explore livremente a arena usando controles de teclado e mouse no PC ou joystick virtual no celular.
- 📐 **Pista Oval Regulamentar WFTDA:** Sinalização completa com Pivot Line, Jammer Line, Track Boundaries, Infield, Benches e Penalty Box.
- 📍 **Pontos de Informação Interativos (HUD & Modais):** Descubra e aprenda sobre as funções das patinadoras (*Jammers*, *Blockers*, *Pivots*), árbitros (*NSOs*, *Referees*), pontuação, equipamentos de proteção e faltas.
- 🎮 **Mini-Game Kings League:** Sala secreta com arcade interativo inspirada nas regras de tirometa / shootout do Roller Derby e Kings League.
- 🧠 **Quiz do Roller Derby:** Teste seus conhecimentos sobre as regras oficiais do Roller Derby em um quiz interativo com pontuação e feedback imediato.
- 📱 **Controles Mobile Touch:** Suporte nativo a telas de toque com joystick duplo virtual, botão de pulo, sprint e interação rápida.
- 🔊 **Efeitos Sonoros Imersivos:** Áudio sintetizado via Web Audio API para apitos de arbitragem, patins na pista, cliques e teletransporte.

---

## 🕹️ Controles de Navegação

### 💻 Desktop
- **`W` `A` `S` `D` / Setas:** Mover o personagem pela arena.
- **Mouse (Arrastar/Olhar):** Girar a câmera em 360°.
- **`E` / Espaço:** Interagir com o ponto de informação mais próximo.
- **`Shift`:** Correr / Acelerar movimento.
- **`Esc`:** Fechar modais, gaveta de diretório ou salas secretas.

### 📱 Dispositivos Móveis
- **Joystick Virtual (Canto Inferior Esquerdo):** Movimentação do jogador.
- **Área Touch (Canto Inferior Direito):** Controle de olhar / rotação da câmera.
- **Botões Dinâmicos na Tela:** Pular, Correr (Sprint) e Botão "Interagir [E]".

---

## 🚀 Tecnologias Utilizadas

- **[React 19](https://react.dev/):** Interface de usuário e gerenciamento de estado.
- **[Three.js](https://threejs.org/):** Renderização gráfica 3D e iluminação WebGL.
- **[Vite](https://vitejs.org/):** Bundler e servidor de desenvolvimento ultrarrápido.
- **[Tailwind CSS v4](https://tailwindcss.com/):** Estilização moderna e responsiva.
- **[Lucide React](https://lucide.dev/):** Ícones vetoriais elegantes.
- **[Canvas Confetti](https://www.npmjs.com/package/canvas-confetti):** Efeitos de comemoração no Quiz e Mini-Game.

---

## 💻 Como Executar Localmente

1. **Clone o repositório:**
   ```bash
   git clone <url-do-repositorio>
   cd derby-synthetica
   ```

2. **Instale as dependências:**
   ```bash
   npm install
   ```

3. **Inicie o servidor de desenvolvimento:**
   ```bash
   npm run dev
   ```

4. **Acesse no navegador:**
   Abra `http://localhost:3000` para visualizar a arena.

---

## 📄 Licença

Este projeto é disponibilizado sob a licença **Apache 2.0**.
