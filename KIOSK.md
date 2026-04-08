# Patient Kiosk — Integrated Allergy Testing

## Overview
The patient kiosk is a touch-screen self-service portal for patient check-in.
URL: /kiosk

## Patient Flow
1. **DOB Entry** (/kiosk) — Patient enters date of birth
2. **Identity Verify** (/kiosk/verify) — Patient enters first name to confirm identity
3. **Update Info** (/kiosk/update-info) — If missing contact/insurance info, prompted to update
4. **Watch Videos** (/kiosk/videos) — Educational videos (skipped if already watched)
5. **Sign Consent** (/kiosk/consent) — Two consent forms with finger signature pad (skipped if already signed)
6. **Done** (/kiosk/done) — "Please be seated" screen, 10-second countdown, auto-resets

## Smart Routing
- If all videos watched AND all consent signed → goes straight to done
- If videos watched but consent not signed → skips to consent
- If new patient → registration wizard, then full flow

## Staff Integration
- Patients appear on Dashboard Waiting Room upon completion
- Video watch count shown, nurse can acknowledge
- Consent form status visible on patient Consent tab
- Nurse verify dropdown for both videos and consent

## Data Captured
- Video activity (VideoActivity table) with timestamp
- Consent signatures (ConsentRecord table) with base64 PNG + timestamp
- Patient added to WaitingRoom with video count
- Missing info collected and saved to Patient record
