# 🗺️ Roadmap — Ski Rush

Plano de evolução do jogo, organizado por fases. A ideia é ir do que dá **mais
retorno com menos esforço** até features mais ambiciosas. Cada item tem uma
estimativa de esforço: 🟢 rápido · 🟡 médio · 🔴 grande.

> Estado atual (v0.3): esquiador com sprites reais, 27 obstáculos variados,
> moedas animadas, 5 poderes (escudo, ímã, fantasma, turbo, 2x), fundo de neve
> rolante, HUD, recorde salvo, controles de teclado e touch.

---

## Fase 1 — Polimento e "game feel" (curto prazo)
O que faz o jogo *parecer* muito melhor sem mudar a estrutura.

- 🟢 **Áudio**: efeitos de moeda, batida, power-up e música de fundo (com botão
  de mudo). Hoje o jogo é silencioso — é o maior salto de imersão por esforço.
- 🟢 **Contagem regressiva** "3 · 2 · 1" ao iniciar, pra não começar já batendo.
- 🟢 **Animação de pernas do esquiador** (ciclo de 2–3 frames das poses que já
  temos) para dar vida ao movimento.
- 🟢 **Tela de game over melhor**: mostrar o sprite do esquiador "caído" e um
  resumo com ícones dos poderes coletados na partida.
- 🟡 **Partículas de neve** ao virar/frear e ao bater, usando os frames de
  neve dos sprites de curva.
- 🟡 **Feedback de quase-batida** (near miss): brilho/câmera quando passa raspando
  num obstáculo — recompensa o risco.

## Fase 2 — Profundidade de jogo (médio prazo)
Dar motivos pra jogar "mais uma vez".

- 🟡 **Combo de moedas**: multiplicador que sobe ao coletar moedas em sequência
  e zera se você bate ou fica muito tempo sem pegar.
- 🟡 **Missões diárias** ("colete 50 moedas", "use 3 poderes", "ande 1000 m").
- 🟡 **Loja de skins**: gastar moedas acumuladas para trocar a roupa/cor do
  esquiador (já dá pra recolorir os sprites por matiz).
- 🟡 **Novos poderes**: trenó (atravessa e empurra obstáculos), câmera lenta,
  escudo duplo, chuva de moedas.
- 🔴 **Sistema de progressão/XP** com níveis e desbloqueios.

## Fase 3 — Mundo e variedade (médio/longo prazo)
Quebrar a monotonia visual e mecânica.

- 🟡 **Biomas/temas** que vão mudando com a distância: floresta → gelo →
  caverna → noite com aurora. Troca de paleta + obstáculos próprios.
- 🟡 **Clima dinâmico**: nevasca (reduz visão), vento (empurra de lado).
- 🟡 **Obstáculos móveis**: outros esquiadores, animais cruzando, avalanche que
  persegue por trás (clássico do Ski Free, o "monstro das neves").
- 🔴 **Rampas e saltos**: zonas de ar com truques e bônus de pontos.
- 🔴 **Chefes/eventos**: a cada X metros, um trecho especial mais difícil.

## Fase 4 — Plataforma e social (longo prazo)
Tirar do "joguinho local" para algo compartilhável.

- 🟡 **PWA**: instalável no celular, joga offline, ícone na tela inicial.
- 🟡 **Placar online** (leaderboard) com nome do jogador.
- 🟡 **Compartilhar resultado** (imagem do score para redes sociais).
- 🔴 **Multiplayer/ghost**: correr contra o "fantasma" do seu melhor run ou de
  amigos.

## Fase 5 — Qualidade técnica (contínuo)
Mantém o projeto saudável conforme cresce.

- 🟢 **GitHub Actions** para deploy automático no Pages a cada push na `main`.
- 🟡 **Refatorar `game.js`** em módulos (entidades, render, input, áudio) com ES
  modules quando passar de ~600 linhas.
- 🟡 **Spritesheet única + atlas** (juntar os PNGs em uma imagem) para reduzir
  requisições e carregar mais rápido.
- 🟡 **Ajuste de dificuldade** mais fino (curva de velocidade, densidade de
  obstáculos) com base em testes.
- 🟢 **Limpeza**: remover os PNGs originais da raiz do `main` (já fatiados em
  `assets/`).

---

## Sugestão de próximos 3 passos
Se for pra escolher só três para começar **agora**, na ordem:

1. 🔊 **Áudio** (efeitos + música) — maior impacto imediato.
2. 🎯 **Combo de moedas** — adiciona estratégia e "só mais uma".
3. 🌄 **Biomas por distância** — renova o visual e dá sensação de progresso.

> Este roadmap é vivo: à medida que avançamos, marcamos itens como ✅ e
> reordenamos prioridades conforme o que for mais divertido.
