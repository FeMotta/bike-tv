#!/bin/bash
# Sobe o servidor do Bike TV e impede o Mac de dormir enquanto ele estiver rodando.
cd "$(dirname "$0")"
exec caffeinate -dimsu node server.js
