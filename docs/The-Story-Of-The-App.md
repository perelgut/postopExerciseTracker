# Building the PostOp Exercise Tracker: A Story

## The First Message

It started on the evening of March 5th with a simple idea and a spreadsheet.

Someone had recently had hip replacement surgery. Their physiotherapist had given them a list of twelve exercises to do every day — or most days, depending on the exercise. Some were supposed to be done Monday, Wednesday, and Friday. Others belonged to Tuesday, Thursday, and Saturday. A few had to be done every single day no matter what.

Each exercise had a "progression" — a way to make it harder as you got stronger. You might start doing ten reps of something at the beginner level, and weeks later be doing fifteen reps at the advanced level. And all of it needed to be tracked. The date, the time of day, how many reps, how many sets. The physio needed to know what was happening.

A paper notebook worked fine for a week. But paper notebooks don't sync to your phone. They don't tell you which exercises are scheduled for today. They don't remember what you did last Tuesday.

So the question became: what if there was an app for this?

I received that first message at 8:45 in the evening. The request was clear and serious. Design and manage the implementation of a browser-based web application. Handle the planning. Handle the development. Do it properly — with requirements, a spec, a project plan, and real working code.

Oh, and the exercise list was attached as an Excel file.

I had questions. A lot of them. Who was this app for — one patient or many? Who controlled the exercise progressions — the patient or a therapist? Where would the data live? What happened if you were offline? Did the app need a login?

I asked them all.

---

## The Questions That Shape Everything

The answers came back quickly. The app was for a single patient. The patient would control their own progressions — they knew when an exercise felt too easy. The app needed to work on a phone, a tablet, and a desktop, all at the same time. The data needed to be stored in the cloud. And yes, there should be a history table — thirty days of data in a scrollable grid.

I read through the Excel file. Twelve exercises. Some had multiple progression levels, each one harder than the last. The Walk exercise was measured in minutes. The others used reps or seconds. Some exercises could only be done on alternating days — a scheduling rule that had to be built into the app's logic.

I started building the requirements document. This is the most important step in any project, and the most often skipped. If you don't know exactly what you're building before you start, you end up rewriting the whole thing later. We went through four rounds of questions and answers before the document was locked. Must-have features. Should-have features. Could-have features. Won't-have features. Every line agreed upon before moving forward.

Then came the technical decisions. The app would be built with plain HTML, CSS, and JavaScript — no heavy frameworks. Firebase would handle the database and authentication. GitHub would store the code. GitHub Pages would host the live app, and every time new code was pushed, it would automatically deploy. Clean, simple, professional.

Two days after that first message, the requirements document was approved.

---

## The Blueprint

A requirements document tells you *what* to build. A functional specification tells you *how* it will work.

This is where the project became real. I wrote out every screen the app would have. The loading screen that shows while Firebase starts up. The Today screen where the patient logs their exercises. The History screen with the thirty-day table. The Progressions screen where they could advance or revert each exercise.

I described the data model — how each exercise session would be stored in Firestore, what fields every record would contain, how progressions would be saved separately from daily logs. I wrote the exact startup sequence: nine steps from when the page first loads to when the first exercise card appears on screen.

Every decision had to be made before a single line of code was written. Which Firebase region? Toronto — the app was for a Canadian patient and data should stay close. What happens if the patient opens the app offline? Show a banner, use the cached data, save when connection returns. What if it's the patient's first time? Create a default profile automatically, using today as the surgery date until they update it.

The spec was approved on March 6th.

---

## The Project Plan

With the spec done, I built the project plan. Forty-four tasks across five phases. A GANTT chart mapping out the timeline. A PERT chart showing which tasks depended on which others. An interactive HTML page — the task tracker — that the team could use to record completion dates, with color coding: green for on time, yellow for one day late, red for anything worse.

Phase 1: Set up the infrastructure. GitHub, Firebase, deployment pipeline.
Phase 2: Build the data layer. The JavaScript modules that talk to Firebase.
Phase 3: Build the user interface. Every screen, every button, every card.
Phase 4: Testing, polish, and documentation.
Phase 5: Deploy and hand over.

The plan was approved. It was time to write code.

---

## Phase 1: Laying the Foundation

Phase 1 was about putting the skeleton in place. Create the GitHub repository. Set up the automatic deployment workflow. Create the Firebase project, point it at a Toronto data center, turn on the database, set the security rules.

The security rules deserve a mention. Firestore's default rules block everything — nobody can read or write anything. You have to explicitly open up the paths you need. We wrote rules that said: a signed-in user can read and write only their own data, and nothing else. Simple, tight, correct.

The Firebase configuration — the API keys and project IDs — could never be committed to the repository. GitHub repositories are public. Committing real keys would be like posting your house keys on a billboard. Instead, the keys were stored as GitHub Secrets, and the deployment workflow injected them into the code automatically during every deploy.

Phase 1 was done in a day.

---

## Phase 2: The Data Layer

Phase 2 was where the real programming started. Five JavaScript modules, each with a specific job.

`exercises.js` held all twelve exercises — their names, their descriptions, their progression levels, their scheduling rules. It was pure data, carefully structured.

`scheduler.js` answered one question: given today's date and a list of exercises, which ones should the patient do today? It had to know that Monday, Wednesday, and Friday were "Alt1" days, and Tuesday, Thursday, and Saturday were "Alt2" days, and Sunday belonged to neither. It had to calculate how many days since surgery to figure out which week the patient was on.

`firestore.js` was the layer that talked to the database. Save a log entry. Read the last thirty days of entries. Save a progression level. Read all the progressions. Every function returned the same shape of response: a success flag, and either data or an error message. Consistent. Predictable.

`auth.js` handled login. At first, this used anonymous authentication — Firebase creates a silent, invisible account so you don't have to sign in. This seemed fine at the time.

It was not fine at the time.

---

## The First Real Problem

When all the Phase 2 modules were built and tested, it was time for the integration test — making sure everything worked together on the live site. The patient opened their laptop, opened Edge, went to the GitHub Pages URL, and... nothing appeared in the developer console.

No output. No errors. Nothing.

We spent an hour diagnosing this. Was there a Content Security Policy blocking the scripts? No. Was there a browser extension interfering? No. Was the code failing silently? We couldn't tell.

Finally, the answer appeared: "It is greyed out saying 'Custom levels' and that there are 2 hidden."

The Edge browser's developer console had been filtering out all `console.log` output this entire time. Every test we ran was working perfectly. We just couldn't see it. The filter was stuck on "Custom levels" and was hiding the very messages we needed. Once that was fixed — after much troubleshooting involving undocking the DevTools panel, resetting the settings, and trying `Ctrl+Shift+J` instead of F12 — every message appeared at once. The modules were loading. Firebase was connecting. The tests passed.

But there was a second problem hiding underneath this one.

When I first wrote `firebase-config.js`, I had used a Firebase function called `enableIndexedDbPersistence` to turn on offline support. That function existed in Firebase version 9. We were using version 10. In version 10, Google had replaced it with a completely different approach.

When I was called out on this, I admitted it plainly: I had reached for the pattern I'd seen most often in my training data, without checking it against the version number that was *right there in the import statement*. The response from the stakeholder was pointed, and correct:

"Even if v9 is more frequent, we're clearly using v10. That's like saying lots of people eat beef so I'll give a vegetarian a hamburger."

That was a fair and accurate analogy. The version number was explicit. There was no excuse. The code was fixed, the lesson was logged, and we moved on.

---

## Phase 3: Building What the Patient Would Actually Touch

Phase 3 was the biggest phase — eleven tasks covering every piece of the user interface.

First came the HTML shell and the CSS. The visual design: a clean white background, a teal color scheme, card-based exercise tiles that expand when you tap them, a sticky navigation bar at the bottom with three tabs. Everything designed to work on a phone screen first, then scale up to larger screens.

Then came `app.js` — the conductor of the whole orchestra. Nine steps it had to execute in the right order, every time the app loaded. Check if Firebase is ready. Check if the user is signed in. Load their profile. Calculate which day of recovery they're on. Load their progressions and today's log from Firestore simultaneously. Figure out which exercises apply today. Update the header. Wire up the navigation buttons. Show the Today screen. Tell all the other modules to wake up.

Then came `logger.js`, the module that rendered the exercise cards. Each card showed the exercise name, whether it was Daily or Alt1 or Alt2, the current progression level, and a form with two number inputs: count and sets. A time-of-day selector let the patient record whether they exercised in the morning or evening. Press "Log Exercise" and the data went to Firestore.

The history table came next. Thirty rows, one per day, today at the top. Twelve columns, one per exercise. Each cell showed the progression level, the reps, and the number of sets. Non-applicable days showed a small dot. Days where the exercise was skipped showed a dash. It scrolled horizontally on small screens and stayed readable throughout.

Then the progressions screen: twelve cards, one for each exercise. Each card had an Advance button and a Revert button. Advance was disabled when you were already at the maximum level. Revert was disabled when you were at level zero. Clean, simple, impossible to break by tapping too many times.

Phase 3 was declared complete on March 7th.

---

## The Problem That Changed the Design

Phase 4 began with testing. The offline banner worked. The recovery day counter worked. The completion badge — showing "3 of 8 exercises logged today" — worked.

And then came the question that unraveled one of the original design assumptions.

The patient had been testing the app on their Windows laptop. Now they wanted to use it on their iPhone too. They opened Safari, went to the URL... and saw an empty app. No history. No progressions. A completely fresh start.

The reason was buried in the original design: anonymous authentication. Firebase's anonymous auth creates a different invisible user ID for every device and browser combination. The laptop had one ID. The iPhone had a completely different one. They were strangers to each other in the database.

I explained the problem, laid out three options, and made a recommendation: replace anonymous auth with Google Sign-In. One Google account, one consistent user ID, data that follows the patient across every device they own.

The response: "Let's go with Option A. It's just too bad if there isn't a Google account — get one for free. And Google already knows everything so why worry about this."

We replaced the authentication layer. New sign-in screen. Google popup. Persistent sessions. The patient signed into both devices with the same Google account and their data appeared on both. Confirmed working on Windows Edge and iPhone Safari.

---

## The Last Feature

While reviewing the app after the auth change, a new need became clear. Sometimes the patient walked twice in a day. Sometimes they did their bridge exercises in the morning and again in the afternoon. The original design only allowed one log entry per exercise per day — a second tap would overwrite the first.

That wasn't good enough.

We designed the Add Session feature. The decision was made to keep it simple: the Log Exercise button would be disabled after the first session, locking in that record. A new "+ Add Session" button would appear, allowing any number of additional sessions to be recorded. No overwriting. No deletion. Every session preserved.

This required changes to how the app stored data in memory, how the exercise cards displayed their state, how the history table aggregated multiple sessions into a single cell, and how the summary badges showed progress.

For the Walk exercise, the badge would now show "2 sessions · 45min total." For rep-based exercises, it would show "2 of 3 sets" until the recommended number was reached, then "3+ sets" after.

Every piece of this was built in a single session. All five files changed. All tests passed.

---

## The Finish Line

The README was written. Forty-four tasks across five phases. Every screen, every button, every database call, every edge case handled.

The final commits went up. The GitHub Actions workflow ran green. The live URL loaded cleanly. Twelve exercises. Offline support. Cross-device sync. Thirty days of history. Google Sign-In. Multiple sessions per day. A recovery day counter that always knew exactly where in the rehabilitation journey the patient was.

Smoke test: all passed.

Patient handover: done.

Project docs archived to the repository.

The app is live at `https://perelgut.github.io/postopExerciseTracker/`.

---

## What This Was Really About

Hip replacement recovery is not glamorous. It hurts. It is slow. It requires doing the same exercises, the same way, day after day after day, for months. The exercises are not optional — they are how you get your mobility back.

A paper notebook works. But a paper notebook doesn't tell you that today is an Alt2 day. It doesn't show you that you've done six of eight exercises. It doesn't let you check your history from your phone while sitting in the physiotherapist's office.

This app does all of that.

It took three days from the first message to a working application. It took a few more days of refinements, a debugging session that turned out to be a console filter all along, an authentication rethink, and a new feature added mid-project because real usage revealed a real need.

That is what software development actually looks like: good planning, careful building, honest debugging, and staying flexible when the real world has different ideas than the plan did.

The patient is somewhere out there right now, doing their exercises. The app is keeping track.

That is a good enough reason to have built it.