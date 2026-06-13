# 🔊 Áudio do Ski Rush

Coloque os arquivos de som **nesta pasta** (`assets/audio/`) com **exatamente
estes nomes**. Quando estiverem aqui, eu conecto cada um ao evento certo no jogo
(pré-carregamento, volume e mudo eu cuido no código).

## Formato recomendado
- **Formato:** `.mp3` (funciona em todos os navegadores e no GitHub Pages).
- **Taxa:** 44.1 kHz.
- **SFX:** mono, curtos, pico em torno de -3 a -6 dBFS.
- **Músicas:** estéreo, com **loop sem emenda** (o fim casa com o começo),
  e um pouco mais baixas que os efeitos para sobrar espaço.
- Mantenha os arquivos leves (SFX < 50 KB, música < ~1.5 MB).

---

## ✅ Essenciais (MVP)

| Arquivo | Evento no jogo | Tipo | Duração | Observações |
|---|---|---|---|---|
| `music_game.mp3` | Música durante a partida | loop | 30–90 s | Animada, ritmada; loop perfeito |
| `coin.mp3` | Coletar uma moeda | one-shot | ~0.15 s | Curtinho e "brilhante"; vai tocar muito |
| `powerup.mp3` | Pegar qualquer poder | one-shot | ~0.5 s | Som de "power-up" positivo |
| `crash.mp3` | Bater num obstáculo (game over) | one-shot | ~0.6 s | Impacto/queda |
| `shield.mp3` | Escudo absorve uma batida | one-shot | ~0.4 s | Diferente do crash (som de "bloqueio") |
| `button.mp3` | Clique nos botões da UI | one-shot | ~0.1 s | Clique discreto |

## 🎁 Recomendados (deixam mais redondo)

| Arquivo | Evento no jogo | Tipo | Duração | Observações |
|---|---|---|---|---|
| `record.mp3` | Bater novo recorde (game over) | one-shot | ~0.8 s | Jingle de vitória |
| `countdown.mp3` | Bipe da contagem "3 · 2 · 1" | one-shot | ~0.15 s | Toca 3 vezes |
| `go.mp3` | "JÁ!" no fim da contagem | one-shot | ~0.3 s | Mais agudo que o countdown |
| `near_miss.mp3` | Passar raspando num obstáculo | one-shot | ~0.2 s | "Whoosh" rápido |

## 🌟 Opcionais (cues por poder — se quiser caprichar)
Se não criar, eu uso o `powerup.mp3` para todos.

| Arquivo | Evento | Tipo | Duração | Observações |
|---|---|---|---|---|
| `turbo.mp3` | Ativar Turbo | loop curto | 1–2 s | "Whoosh" contínuo enquanto o turbo dura |
| `magnet.mp3` | Ativar Ímã | loop curto | 1–2 s | Zumbido magnético enquanto dura |
| `ghost.mp3` | Ativar Fantasma | one-shot | ~0.4 s | Som "etéreo" |
| `double.mp3` | Ativar 2x Pontos | one-shot | ~0.4 s | Som de "bônus" |
| `music_menu.mp3` | Música do menu | loop | 20–60 s | Mais calma; se faltar, reuso a do jogo |

---

## Dicas para gerar
- Ferramentas fáceis: **jsfxr / sfxr / ChipTone / Bfxr** (efeitos retro 8/16-bit),
  **Audacity** (editar/exportar mp3), ou bancos como **freesound.org** (confira a
  licença antes de usar).
- Para combinar com a pegada 16/32-bit dos sprites, sons estilo **chiptune**
  caem bem.
- Se exportar em `.wav` ou `.ogg`, sem problema — me avise que eu ajusto os nomes
  e o código aceita o formato.

> Pode subir só os essenciais primeiro; eu já ligo esses e os demais ficam
> opcionais. Quando terminar, é só dizer "os áudios estão no repo" que eu
> conecto tudo (com controle de volume e botão de mudo).
