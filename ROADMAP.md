# 🗺️ Roadmap — Ski Rush

Plano de evolução do jogo, organizado por fases. A ideia é ir do que dá **mais
retorno com menos esforço** até features mais ambiciosas. Cada item tem uma
estimativa de esforço: 🟢 rápido · 🟡 médio · 🔴 grande.

> Estado atual (v0.4): esquiador com sprites reais, 27 obstáculos variados,
> moedas animadas, 5 poderes (escudo, ímã, fantasma, turbo, 2x), fundo de neve
> rolante, HUD, recorde salvo, controles de teclado e touch.
> **Áudio completo, countdown, animação pernas, partículas neve, near-miss, game over com resumo de poderes** ✅

---

## Fase 1 — Polimento e "game feel" (curto prazo)
O que faz o jogo *parecer* muito melhor sem mudar a estrutura.

- ✅ 🟢 **Áudio**: efeitos de moeda, batida, power-up e música de fundo (com botão de mudo).
- ✅ 🟢 **Contagem regressiva** "3 · 2 · 1" ao iniciar.
- ✅ 🟢 **Animação de pernas do esquiador** (ciclo de 3 frames left/right).
- ⚠️ 🟢 **Tela de game over melhor**: resumo com ícones dos poderes ✅ | **sprite esquiador caído** 🟡 *precisa de asset*
- ✅ 🟡 **Partículas de neve** ao virar/frear e ao bater.
- ✅ 🟡 **Feedback de quase-batida** (near miss): slow-mo, brilho, texto flutuante "+5".

## Fase 2 — Profundidade de jogo (médio prazo)
Dar motivos pra jogar "mais uma vez".

- 🟡 **Combo de moedas**: multiplicador que sobe ao coletar em sequência e zera se bate/tempo.
- 🟡 **Missões diárias** ("colete 50 moedas", "use 3 poderes", "ande 1000 m").
- 🟡 **Loja de skins**: gastar moedas para trocar roupa/cor do esquiador.
- 🟡 **Novos poderes**: trenó, câmera lenta, escudo duplo, chuva de moedas.
- 🔴 **Sistema de progressão/XP** com níveis e desbloqueios.

## Fase 3 — Mundo e variedade (médio/longo prazo)
Quebrar a monotonia visual e mecânica.

- 🟡 **Biomas/temas** por distância: floresta → gelo → caverna → noite/aurora. Paleta + obstáculos próprios.
- 🟡 **Clima dinâmico**: nevasca (reduz visão), vento (empurra de lado).
- 🟡 **Obstáculos móveis**: outros esquiadores, animais, avalanche ("monstro das neves").
- 🔴 **Rampas e saltos**: zonas de ar com truques e bônus.
- 🔴 **Chefes/eventos**: a cada X metros, trecho especial mais difícil.

## Fase 4 — Plataforma e social (longo prazo)
Tirar do "joguinho local" para algo compartilhável.

- 🟡 **PWA**: instalável no celular, joga offline, ícone na tela inicial.
- 🟡 **Placar online** (leaderboard) com nome do jogador.
- 🟡 **Compartilhar resultado** (imagem do score para redes sociais).
- 🔴 **Multiplayer/ghost**: correr contra fantasma do melhor run ou de amigos.

## Fase 5 — Qualidade técnica (contínuo)
Mantém o projeto saudável conforme cresce.

- 🟡 **GitHub Actions** para deploy automático no Pages a cada push na `main`. 👤 *precisa de você (repo settings/secrets)*
- 🟡 **Refatorar `game.js`** em módulos (entidades, render, input, áudio) com ES modules (~700 linhas).
- 🟡 **Spritesheet única + atlas** (juntar PNGs em uma imagem) para reduzir requisições.
- 🟡 **Ajuste de dificuldade** fino (curva velocidade, densidade obstáculos) com base em testes.
- ✅ 🟢 **Limpeza**: PNGs originais já removidos da raiz (estão em `assets/`).

---

## ✅ O que já está feito (pode testar agora)
- Áudio completo (efeitos + música + mute persistente)
- Countdown "3, 2, 1, JÁ!" com sons
- Animação de pernas do esquiador (3 frames cada lado)
- Partículas de neve ao virar e na colisão
- Near-miss: slow-mo + brilho + texto "+5" flutuante
- Game over com resumo de poderes coletados
- Rastro na neve (sulcos que sobem)
- HUD, pause, recorde salvo no localStorage

## 🤖 O que eu posso implementar sem depender de você
- **Combo de moedas** (lógica pura em game.js)
- **Missões diárias** (lógica + localStorage)
- **Loja de skins** (lógica + recolor HSV dos sprites via canvas)
- **Novos poderes** (trenó, slow-mo, etc. — lógica em game.js)
- **Biomas por distância** (troca background/paleta/obstáculos por distância)
- **Clima dinâmico** (neblina, vento — shaders/lógica canvas)
- **Obstáculos móveis** (outros esquiadores, avalanche)
- **Refatorar game.js** em módulos ES6
- **Spritesheet/atlas** (script para gerar + loader)
- **Ajuste de dificuldade** (curvas, parâmetros)

## 👤 O que precisa de **você** (decisão/asset/ação externa)
- **Sprite esquiador caído** (game over) — precisa criar/fornecer PNG
- **GitHub Actions deploy** — precisa ativar Pages no repo + workflow
- **PWA** — precisa manifest.json + service worker + ícones (posso gerar, mas você valida)
- **Leaderboard online** — precisa backend (Firebase/Supabase/outro) + decisão de provedor
- **Compartilhar resultado** — precisa Canvas to blob + Web Share API (posso codar, você testa)
- **Multiplayer/ghost** — precisa backend + sincronização

---

## Sugestão de próximos 3 passos (prioridade)
Se for pra escolher só três para começar **agora**, na ordem:

1. 🎯 **Combo de moedas** — adiciona estratégia e "só mais uma" (posso fazer agora)
2. 🌄 **Biomas por distância** — renova visual e dá sensação de progresso (posso fazer agora)
3. 🛒 **Loja de skins** — usa moedas acumuladas, reaproveita sprites via recolor (posso fazer agora)

> Este roadmap é vivo: à medida que avançamos, marcamos itens como ✅ e
> reordenamos prioridades conforme o que for mais divertido.
