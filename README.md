# ⛷️ Ski Rush — Descida Radical

Um jogo arcade que mistura **Ski Free** com **Subway Surfers**: o esquiador desce
uma montanha infinita cheia de obstáculos, coletando moedas e poderes especiais
enquanto a velocidade aumenta sem parar.

Feito 100% em **HTML5 Canvas + JavaScript puro** — sem dependências, sem build.
Funciona no navegador do computador e do celular.

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

## 📁 Estrutura

- `index.html` — estrutura e telas (menu, HUD, game over, pausa)
- `style.css` — visual e layout responsivo
- `game.js` — motor do jogo (física, spawns, colisões, render)
