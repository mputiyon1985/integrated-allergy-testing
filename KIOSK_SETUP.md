# Clinic Tablet Kiosk Setup Guide

## Overview
This guide sets up a dedicated clinic tablet running the Integrated Allergy Testing kiosk in a locked-down Chrome Kiosk Mode. Patients cannot escape the kiosk, access other apps, or modify settings.

---

## Hardware Requirements
- Windows tablet or laptop (Surface, etc.) OR iPad with Chrome
- Chrome browser installed (latest version)
- Internet connection

---

## Step 1 — Windows: Create a Kiosk Shortcut

### Option A: Chrome Kiosk Mode (Recommended)
Create a desktop shortcut with this target:
```
"C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk --incognito --disable-pinch --overscroll-history-navigation=0 https://integrated-allergy-testing.vercel.app/kiosk
```

**What `--kiosk` does:**
- Launches Chrome in true full-screen (no title bar, no address bar)
- `Esc` does NOT exit (unlike regular fullscreen)
- No navigation buttons
- `Alt+F4` is the only way to exit (requires keyboard)

### Option B: Chrome App Mode (Less locked)
```
"C:\Program Files\Google\Chrome\Application\chrome.exe" --app=https://integrated-allergy-testing.vercel.app/kiosk --start-fullscreen
```

---

## Step 2 — Windows: Auto-launch on Startup

1. Press `Win + R` → type `shell:startup` → Enter
2. Copy the kiosk shortcut into this folder
3. Tablet will auto-launch the kiosk on boot

---

## Step 3 — Windows: Lock Down the Tablet

### Disable Task Manager shortcut (optional)
1. Open Group Policy Editor (`gpedit.msc`)
2. User Configuration → Administrative Templates → System → Ctrl+Alt+Del Options
3. Enable "Remove Task Manager"

### Set Auto-Login (so kiosk starts without password)
1. Run `netplwiz`
2. Uncheck "Users must enter a username and password"
3. Enter the kiosk user account password

### Create a Limited Kiosk User Account
1. Settings → Accounts → Family & Other Users → Add account
2. Create local account: `KioskUser` (no password or simple PIN)
3. Set account type to **Standard User** (not Administrator)
4. Log in as KioskUser for kiosk use

---

## Step 4 — iPad: Guided Access Mode

For iPads, use Apple's built-in Guided Access:

1. Settings → Accessibility → Guided Access → Enable
2. Set a passcode (staff-only PIN)
3. Open Chrome → navigate to `/kiosk`
4. Triple-click the Home/Side button → Start Guided Access
5. Patient is now locked to the kiosk screen
6. **To exit:** Triple-click Home/Side button → enter passcode

---

## Step 5 — Test the Setup

1. Launch kiosk mode
2. Verify:
   - ✅ No address bar visible
   - ✅ No browser tabs visible
   - ✅ F12 does nothing (DevTools blocked by app)
   - ✅ Right-click shows nothing
   - ✅ Can enter a patient DOB and flow through check-in
   - ✅ Tap logo 5× → exits fullscreen (staff escape hatch)
   - ✅ `Esc` does nothing in regular fullscreen mode (App blocks it)

---

## Staff Escape Hatch
- **Tap the Integrated Allergy logo 5 times quickly** → exits fullscreen
- On Chrome `--kiosk` mode: press `Alt+F4` to close Chrome entirely
- On iPad Guided Access: triple-click Home/Side button + enter staff PIN

---

## Kiosk URL
```
https://integrated-allergy-testing.vercel.app/kiosk
```

---

## Troubleshooting

| Issue | Solution |
|---|---|
| Kiosk shows login page | Navigate directly to `/kiosk` — that URL bypasses staff login |
| Videos not playing | Ensure clinic WiFi allows YouTube. Test: `youtube.com` |
| Patient stuck on consent | Staff tap logo 5× to exit, help patient manually |
| Tablet won't auto-boot to kiosk | Check startup folder shortcut, verify auto-login is set |
| Chrome crashes | Check tablet has 4GB+ RAM and latest Chrome |

---

## Security Notes
- The kiosk account should be a **Standard User** (no admin rights)
- Network should be on a **separate VLAN** from staff systems if possible
- Kiosk sessions do not retain patient data between patients (sessionStorage cleared on reset)
- All patient interactions are logged in the audit trail
