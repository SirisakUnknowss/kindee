# Reply to App Review (Guideline 2.1 - Information Needed)

Paste this into "Reply to App Review" in App Store Connect AND into the Notes field of App Review Information.
Replace the [PLACEHOLDERS]. The screen recording (item 1) must be recorded on a physical iPhone by the owner.

---

Hello App Review team,

Thank you for the review. Here is the information requested for KinDee (com.kindee.app, version 1.0, build 2).

**1. Screen recording (physical device)**
A screen recording captured on a physical iPhone running [iOS VERSION] is attached. It starts from launching the app and shows: start without an account, onboarding (age check, body data, activity, goal), adding a food by search, scanning a barcode with the camera, manual entry, the daily budget screen, the calendar, the Profile screen (data export), email sign-up and sign-in, and account deletion (Profile > "ลบบัญชีและข้อมูลทั้งหมด" / Delete account and all data).

**2. Purpose and target audience**
KinDee is a food-logging and calorie-budget app for adults (18+) who eat Thai food. Most calorie trackers are built around Western foods; KinDee ships a catalogue of about 1,800 Thai dishes, drinks and desserts (available offline) so people can log a meal in seconds. The user enters sex, birth date, height, weight, activity level and goal; the app calculates a daily energy target (TDEE) and shows how much of the day's budget is left. It is a logging tool that gives estimates and does not provide medical advice (stated in the Terms and on the App Store page). The app UI is in Thai.

**3. How to access the main features**
- No account is required. On the first screen tap the top button ("เริ่มบันทึกเลย" = "Start logging") and complete the 5 onboarding steps (use a birth date that makes the user 18 or older), then tap "เริ่มใช้งาน".
- Tap the green "+" button > "ค้นหา" (Search) tab > type "กะเพรา" > tap "+" on a result to log it. The "Health" tab shows the budget ring and the logged meal.
- Barcode scanning: "+" > "สแกน" (Scan). The camera permission is requested only on this tab and is used only to read barcodes. A barcode number can also be typed in, or an image picked from the photo library to read a barcode from it (the image is read on the device and is not uploaded).
- An optional account (email + password with email verification) only backs up and syncs the user's data across devices. Demo account for review: email [DEMO EMAIL], password [DEMO PASSWORD]. [The demo account is already verified.]
- Account deletion: Profile tab > "ลบบัญชีและข้อมูลทั้งหมด". Data export is on the same screen.
- There are no in-app purchases, subscriptions, ads or paid content in this version.

**4. External services used**
- Supabase (Postgres database and email/password authentication): stores the account, profile, weight, food entries and favorites of signed-in users. Guest data stays on the device.
- Cloudflare Pages / Workers: hosts the API the app calls (sync, barcode lookup, feedback/error reports, account deletion).
- Open Food Facts (open database, ODbL): product data for barcode scans, fetched through our API.
- Expo EAS: used only to build and submit the app.
No advertising, analytics SDKs, payment processors or AI services are used in the iOS app (the AI photo feature is not part of this version).

**5. Regional differences**
The app functions identically in all regions. The UI and food catalogue are in Thai. Availability is set to all countries; I have declared non-trader status under the DSA.

**6. Regulated industry / protected material**
The app is not a regulated medical device (declared in App Store Connect) and does not use protected third-party material. Thai dish values are the developer's own estimates; barcode product data is from Open Food Facts under its open licence, with attribution in the app (Profile > data credits).

User-generated content: none is shown to other users. The only user-written text is optional feedback sent privately to the developer, so no reporting/blocking mechanism applies.

Privacy policy: https://kindee-landing.pages.dev/privacy
Support: https://kindee-landing.pages.dev/support

Please let me know if anything else is needed.

Best regards,
Sirisak Daengdensri
