# Bike TV

App para TV LG (webOS): vídeos de pedal em 4K no YouTube + tempo, batimentos do Apple Watch (via Pulsoid), zonas e calorias.

A página fica em https://femotta.github.io/bike-tv/ (GitHub Pages, pasta `docs/`). O app instalado na TV só abre essa página
e passa os ajustes no `#cfg=` — token, idade e peso ficam dentro da TV, nunca no repositório.
O YouTube não toca em páginas `file://` dentro de apps da TV (erro 153), por isso a página precisa estar publicada.

## Treinar
1. Apple Watch: abra o **Pulsoid** e toque em Start.
2. TV: abra o **Bike TV** e aperte OK.

Controle: OK iniciar/pausar · ◀ ▶ trocar vídeo · ▼ ou Voltar menu (vídeos, finalizar) · ▲ esconde o painel.
Treinos ficam salvos no navegador da TV (`localStorage`).

## Mudar vídeos
Edite `docs/videos.json` (id do YouTube = o que vem depois de `watch?v=`) e faça push. A TV pega na próxima abertura.

## Mudar ajustes (token Pulsoid, idade, peso)
Edite `config.json` (não versionado) ou rode `./start.sh` e use http://localhost:8787/setup. Depois reinstale:

    ./build-ipk.sh
    ares-install --device tv dist/com.fernando.biketv_1.2.0_all.ipk

## Developer Mode
A sessão dura 999 h. `.github/workflows/devmode.yml` renova todo dia usando o segredo `LG_DEVMODE_TOKEN`
(lido da TV com `ares-novacom -d tv --run "cat /var/luna/preferences/devmode_enabled"`).
Se a TV for resetada ou o Developer Mode desligado, pegue o token novo e atualize o segredo:

    ares-novacom -d tv --run "cat /var/luna/preferences/devmode_enabled" | tail -1 | gh secret set LG_DEVMODE_TOKEN -R FeMotta/bike-tv

Por garantia, dê uma olhada no app Developer Mode da TV uma vez por mês; se o tempo estiver baixo, clique em Extend.

## Rodar pelo Mac (opcional)
`./start.sh` serve a mesma página em http://IP-do-Mac:8787 e `./build-ipk.sh --mac` gera um app que abre essa versão.
