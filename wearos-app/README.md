# ⌚ San Pogodex — Wear OS App (Active Rotations)

Aplicação nativa para **Wear OS (Android Smartwatches)** desenhada exclusivamente para consultar rapidamente as **Informações de Rotações Ativas** do Pokémon GO diretamente no teu relógio (sem Pokédex pesada, sem doces ou dados desnecessários).

---

## 🚀 Funcionalidades Incluídas

- ⚔️ **Active Raids**: Consulta Raids Super Mega, Megas, 5-Star, Shadow e 1-Star ativas com os respetivos CPs normais e boosted.
- 📅 **Active Events**: Lista de eventos e horas de comunidade a decorrer.
- 🥚 **Egg Pool**: Pokémons a nascer dos ovos de 2km, 5km, 7km, 10km e 12km.
- 🎁 **Promo Codes**: Códigos promocionais ativos prontos a consultar.
- 🌀 **Wear OS Tile**: Widget/Tile para o ecrã do relógio ao deslizar o dedo na hora.

---

## 🛠️ Como Abrir e Compilar no PC

1. **Instalar o Android Studio**:
   - Transfere e instala o [Android Studio](https://developer.android.com/studio).

2. **Abrir o Projeto**:
   - Abre o Android Studio.
   - Seleciona `Open` e escolhe a pasta `wearos-app` dentro deste repositório (`C:\Users\LazyT\Documents\PoGo_Website\wearos-app`).
   - Aguarda que o Gradle sincronize os ficheiros automaticamente.

---

## ⌚ Como Instalar no Teu Relógio (Wireless ADB)

Não precisas de pagar nada nem de publicar na Play Store:

1. **No Relógio**:
   - Vai a `Definições` ➔ `Sobre o Relógio` ➔ `Informações do Software`.
   - Toca **7 vezes seguidas** em `Versão do Build` até ativares o Modo de Programador.
   - Vai a `Definições` ➔ `Opções de Programador`.
   - Ativa **ADB Debugging** e **Wireless Debugging**.
   - Toma nota do **IP e Porta** mostrados (ex: `192.168.1.45:5555`).

2. **No Computador / Terminal**:
   - Liga o PC e o Relógio à mesma rede Wi-Fi.
   - Abre o terminal dentro do Android Studio ou PowerShell e liga ao relógio:
     ```bash
     adb connect 192.168.1.45:5555
     ```

3. **Executar**:
   - No topo do Android Studio, seleciona o teu relógio no menu de dispositivos.
   - Clica no botão verde **Run ▶** (ou `Shift + F10`).
   - A app é instalada instantaneamente no teu relógio!
