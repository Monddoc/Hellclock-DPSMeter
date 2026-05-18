# ⚔️ Hell Clock DPS Meter

A lightweight, secure, and beautiful real-time DPS meter and combat analyzer designed for the ARPG **Hell Clock**.

Built with **React, Vite, TypeScript, and Electron**, this tool provides a frameless, transparent overlay that sits seamlessly over your game, reading your `Damage.log` file in real-time without injecting into or modifying the game client.

---

## ✨ Features

- **Real-Time Combat Parsing:** Instantly reads and updates damage as the `Damage.log` updates.
- **Dealt & Received Breakdown:** Easily toggle between damage you've dealt to enemies and damage enemies have dealt to you.
- **Death Cause Analysis:** Prominently displays the **Latest Hit Received** (including the exact enemy name, Skill ID, and damage type) to help you understand exactly what killed you.
- **Advanced Encounter Reports:** Export your combat sessions into interactive, beautifully styled HTML reports. The reports feature pure CSS/HTML stacked bar charts to analyze Element Damage distribution, Critical Hit rates, and Ailment (Bleed/Ignite) contributions. Works 100% offline.
- **Transparent Overlay:** A sleek, dark-themed UI with adjustable opacity that sits gracefully on top of your game window.
- **Resizable Columns:** Drag and resize columns to customize your data view.
- **Portable & Zero-Install:** Distributed as a highly compressed, portable `.exe`. Just double-click and use. No registry keys, no administrator privileges required, and no installation footprint.

---

## 🔒 Security Posture

This application is built with security as a primary concern:
- **Zero Vulnerabilities:** All dependencies are up to date with zero known vulnerabilities.
- **Sandboxed Electron:** Strict Electron security policies are enforced (`nodeIntegration: false`, `contextIsolation: true`). The frontend UI has zero direct access to the Node.js file system.
- **Strict IPC Bridge:** Communication between the UI and backend is tightly controlled. The renderer can only trigger bounded, predefined actions (like selecting a folder or saving an HTML file).
- **ReDoS Immune:** Log parsing relies on strict string splitting and index mapping rather than nested regular expressions, making it immune to Regular Expression Denial of Service attacks.
- **Memory Efficient:** The file watcher reads only byte deltas rather than loading the entire 50MB log file into memory, preventing crashes during multi-hour gaming sessions.

---

## 🎮 Usage (For Players)

1. Download the latest `Hell Clock DPS.exe`.
2. Double-click to run it (No installation required).
3. Click **"Select Game Folder"** and choose the folder where your `Damage.log` file is located.
4. Go play! The window will stay on top of your game. You can adjust opacity using the slider at the bottom.
5. Click **"Report"** after a boss fight to see a detailed breakdown and export it to an interactive HTML file.

---

## 🛠️ Development & Building (For Contributors)

If you wish to modify the code or build the portable executable yourself from the source code, follow these steps:

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- A terminal with Administrator privileges (required ONLY for the final `.exe` packaging step on Windows).

### 1. Installation
Clone the repository and install the dependencies:
```bash
git clone https://github.com/Monddoc/Hellclock-DPSMeter.git
cd Hellclock-DPSMeter
npm install
```

### 2. Running in Development Mode
This will launch the app with Hot-Module Replacement (HMR) enabled. Whenever you save a `.tsx` or `.css` file, the app will update instantly.
```bash
npm run dev
```

### 3. Building the Portable `.exe`
Because `electron-builder` must create specific Windows symbolic links during the packaging phase, **you must run your terminal as an Administrator** to build the `.exe`.

1. Open **cmd** or **PowerShell** as Administrator.
2. Navigate to the project folder.
3. Run the build script:
```bash
npm run build:exe
```
4. Once completed, your portable executable will be located in the `dist-electron` folder!

---

## 📝 License

This project is licensed under the MIT License. Feel free to fork, modify, and distribute!
