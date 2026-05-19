# ⚔️ Hell Clock DPS Meter

A lightweight, secure, and beautiful real-time DPS overlay and combat analyzer for the ARPG **Hell Clock**. It runs as a transparent window on top of your game, reading combat logs in real-time.

---

## 🚀 Quick Start (Players)

### Step 1: Enable Damage Logging in Steam
You **must** enable damage logging in the game client for the DPS meter to work:
1. Open your **Steam Library**.
2. Right-click **Hell Clock** and select **Properties**.
3. In the **General** tab, scroll down to **Launch Options**.
4. Paste the following launch option:
   ```text
   --damageLog
   ```
5. Close the window and launch the game. This will generate a `Damage.log` file in your game directory containing all real-time combat data.

---

### Step 2: Download & Extract
1. Download the latest `Hell Clock DPS-x.x.x-win.7z` archive from the **Releases** tab.
2. **Extract the archive** using a tool like [7-Zip](https://www.7-zip.org/) or WinRAR into a permanent folder (e.g. `C:\Users\YourName\Documents\`).
   > ⚠️ **IMPORTANT:** Running the `.exe` directly inside the unextracted compressed view will cause crashes. Always extract the folder first!
3. Open the extracted folder and double-click `Hell Clock DPS.exe`.
4. Click **Select Game Folder** and navigate to your Hell Clock game folder (where `Damage.log` is generated).

---

## 🎮 Key Controls & Features

### Core Hotkeys
| Action | Key Combination | Description |
|---|---|---|
| **Toggle Lock** | `F8` or `Ctrl+Shift+L` | Locks window in place, enabling **Click-Through** so you can click *behind* it directly into the game. |
| **Exit Minimalist** | `F9` | Restores standard borders and buttons when in Minimalist mode. |

### Advanced Features
*   **Minimalist Mode:** Click the `🗗` icon in the title bar to strip all borders, backgrounds, and buttons for a clean, floating in-game experience.
*   **Custom Opacity:** Use the opacity slider at the bottom to adjust how translucent the overlay is.
*   **Metric Toggling:** Toggle between sorting your rows by **Total Damage** or **DPS** with a single click.
*   **Combat History:** Review up to the last 3 combat sessions using the `-1`, `-2`, and `-3` buttons on the toolbar. Click `← Live` to return to real-time parsing.
*   **Encounter Report:** Click **Report** to open a comprehensive death-analysis modal or export a beautiful, self-contained offline HTML chart to share with your friends.

---

## 📸 Interface Preview
*(Screenshots Soon!)

| Main HUD Overlay | Combat Report | Minimalist Mode |
|---|---|---|
| ![HUD Placeholder](https://via.placeholder.com/350x220?text=Sleek+HUD+Overlay) | ![Report Placeholder](https://via.placeholder.com/350x220?text=Interactive+Charts) | ![Minimalist Placeholder](https://via.placeholder.com/350x220?text=Zero+Borders) |

---

## 🛠️ Development & Local Run (Developers)

If you'd like to run or build the application from source code:

### Prerequisites
*   [Node.js](https://nodejs.org/) (v18 or higher)
*   **Administrator Terminal** (Required only for packaging the final release executable on Windows)

### 1. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/Monddoc/Hellclock-DPSMeter.git
cd Hellclock-DPSMeter
npm install
```

### 2. Run Locally in Development Mode
Launches the Electron application with instant Hot-Module Reloading (HMR) for the interface:
```bash
npm run dev
```

### 3. Build a New Release Archive
This will compile the TypeScript, bundle the Vite client, clean older distribution zip files, and build a optimized instant-launch `.7z` distribution folder:
1. Open PowerShell or Command Prompt **as Administrator**.
2. Run the build script:
   ```bash
   npm run build:exe
   ```
3. Your new release archive will be saved cleanly in the root directory.

---

## 📝 License
This project is licensed under the MIT License. Feel free to fork, modify, and share!
