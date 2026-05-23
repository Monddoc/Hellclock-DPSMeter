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

### Core Hotkeys (Fully Customizable!)
| Action | Default Hotkey | Description |
|---|---|---|
| **Toggle Lock** | `F8` or `Ctrl+Shift+L` | Locks window in place, enabling **Click-Through** so you can click *behind* it directly into the game. |
| **Toggle Minimalist** | `F9` | Strips overlay borders, applies click-through lock, and goes fully transparent (F9 again exits). |
| **Toggle Collapse/Expand All** | *Bindable* | Instantly collapses all expanded tree grid levels, or expands all parent nodes statefully. |
| **Reset Encounter** | *Bindable* | Instantly clears logs and sets combat data back to zero. |
| **Open Details** | *Bindable* | Immediately displays the detailed encounter breakdown screen. |

> ⚙️ **Shortcut Customization:** Click the gear icon (`⚙️`) in the header to open settings and assign your own custom keys for any of these controls.

### Advanced Features
*   **Fully Resizable & Draggable Columns:** Position column edges directly in the meter and drag to dynamically resize their width. Your layout settings are persistently saved to local memory.
*   **Dynamic Column Visibility Toggles:** Toggle on or off individual columns (`Source`, `Skill Name`, `SID`, `Damage Type`, `Hits`, `Max Hit`, `Damage/DPS`) inside Settings to clean up your HUD.
*   **Dynamic Column Sorting:** Click any column header to sort the tree grid (alphabetically or numerically) recursively across all nested branch levels, complete with active indicator arrows.
*   **Skill ID (SID) & Skill Name (SN) Separation:** Differentiates identical skill names by capturing their unique ID, enabling clean character/summon breakdown.
*   **Leaf Node Single-Row Bypass:** Flat skills (like *Summon Brute*) automatically bypass collapsible nesting and render as a single flat row, keeping the overlay uncluttered.
*   **Red Overlay Progress Bars for Bleeding:** Bleeding skill branches highlight their relative damage weights with custom crimson progress bar overlays, keeping typography gold/white/grey for high readability.
*   **Combat Ailment Uptime Tracker:** Real-time debuff tracker displaying active combat uptimes for Bleed and Ignite with colored visual bar gauges, available in both the live Details overlay and the exported breakdowns.
*   **HTML Exporter Progress Bars:** Exported HTML details tables feature beautiful linear-gradient progress overlays behind each row, matching the elemental and crimson red overlay colors.
*   **Peak DPS Burst Tracking:** View the highest instantaneous DPS peak achieved for each individual skill row (indicated by the `⚡` peak badge).
*   **Minimalist Mode:** Click the `🗗` icon in the title bar to strip all borders, backgrounds, and buttons for a clean, floating in-game HUD experience.
*   **Custom Opacity:** Drag the slider on the bottom toolbar to adjust the background translucency. Clicks reset to a default 85% transparent background while leaving text fully crisp and readable.
*   **Combat History:** Review up to the last 3 combat sessions using the `1`, `2`, and `3` buttons on the toolbar. Click `← Live` to return to real-time parsing.
*   **Encounter Details Export:** Open a minimalist encounter details overview modal, or export an extremely rich, offline HTML breakdown complete with collapsible tree grids, graphical elements analysis, critical hits breakdown, and ailment contributions.
*   **One-Click Config Reset:** Instantly restore default column widths, visible columns, hotkey bindings, and opacity back to factory settings using the **Reset to Defaults** button.

---

## 📸 Interface Preview
*(Screenshots Soon!)*

| Main HUD Overlay | Combat Breakdown | Minimalist Mode |
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
This single command automatically patches the version number, compiles Vite assets, packages Windows Electron binaries, cleans older distribution files, and exports a clean Windows `.7z` executable package in your root folder:
1. Open PowerShell or Command Prompt **as Administrator**.
2. Run the packaging script:
   ```bash
   npm run build:exe
   ```
3. Your new release archive will be saved cleanly in the root directory.

---

## 📝 License
This project is licensed under the MIT License. Feel free to fork, modify, and share!
