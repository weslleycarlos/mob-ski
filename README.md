# ⛷️ Ski Rush — Descida Radical

Um jogo arcade que mistura **Ski Free** com **Subway Surfers**: o esquiador desce
uma montanha infinita cheia de obstáculos, coletando moedas e poderes especiais
enquanto a velocidade aumenta sem parar.

Feito 100% em **HTML5 Canvas + JavaScript puro** — sem dependências, sem build.
Apresenta um design **Retro 32-bit** utilizando fontes e gráficos em Pixel Art. Funciona diretamente no navegador do computador e do celular, adaptando-se a qualquer tela.

## ▶️ Como jogar

Abra o `index.html` num navegador. Não precisa de servidor.

Ou rode um servidor local simples:

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

## 🎮 Controles

- **Teclado:** setas `◀` `▶` ou `A` / `D` para mover. `P` ou `Esc` pausa.
- **Celular / touch:** arraste o dedo na tela — o esquiador segue a posição.

## ✨ Poderes especiais

| Poder | Efeito |
|-------|--------|
| 🧲 **Ímã** | Atrai todas as moedas próximas |
| 👻 **Fantasma** | Atravessa obstáculos sem morrer |
| 🔥 **Turbo** | Velocidade extra e pontuação em dobro |
| 🛡️ **Escudo** | Absorve uma batida sem game over |

## 🎯 Objetivo

Desça o máximo que conseguir desviando das árvores, pedras, tocos e bonecos de
neve. Quanto mais longe você for, mais rápido fica. Colete moedas para somar
pontos e aproveite os poderes para sobreviver. Seu recorde fica salvo no
navegador.

## 🗺️ Biomas

Conforme você avança, o cenário muda! Você passará por **Floresta, Gelo, Caverna e Aurora Boreal**, com variações de cores no céu e diferentes obstáculos específicos para cada bioma (como troncos e bonecos de neve).

## 👤 Sistema de Registro e Loja

Na tela inicial, você pode inserir o seu nome de jogador. O jogo funciona inteiramente através do **`localStorage`** do navegador, sendo 100% compatível com *GitHub Pages* e hospedagens estáticas.
Suas **Moedas, Pontuação Máxima e Skins Compradas** da loja ficarão salvas automaticamente na memória do navegador.

## 📁 Estrutura

- `index.html` — estrutura, perfil de jogador e telas (menu, HUD, game over, loja)
- `style.css` — visual estilo arcade retro 32-bit
- `game.js` — motor do jogo (física otimizada para evitar engasgos, transições, spritesheet customizado, registro de localstorage)
