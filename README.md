# Bike TV

App para TV LG (webOS): vídeos de pedal em 4K no YouTube + tempo, batimentos do Apple Watch (via Pulsoid), zonas e calorias.

## Uso diário
1. No Mac: `./start.sh` (deixe o terminal aberto; o Mac não dorme enquanto roda)
2. Na TV: abra o app **Bike TV**

Sem instalar nada, também funciona no navegador da TV: http://192.168.0.11:8787

## Controle
OK iniciar/pausar · ◀ ▶ trocar vídeo · ▼ ou Voltar menu (vídeos, finalizar) · ▲ esconde o painel

## Ajustes (token Pulsoid, idade, peso)
http://localhost:8787/setup no Mac

## Vídeos
Edite `videos.json` (id do YouTube = o que vem depois de `watch?v=`).

## Instalar / reinstalar na TV (Developer Mode ligado)
    ares-novacom --device tv --getkey      # pede a passphrase que aparece na TV
    ./build-ipk.sh
    ares-install --device tv dist/com.fernando.biketv_1.0.0_all.ipk
    ares-launch --device tv com.fernando.biketv

Se o IP do Mac mudar, rode `./build-ipk.sh` e reinstale.
O Developer Mode expira em ~50 h; renove no app Developer Mode da TV.
Treinos ficam salvos em `sessions.json`.
