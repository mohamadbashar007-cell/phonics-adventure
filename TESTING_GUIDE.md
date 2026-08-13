# Quick Start & Feature Testing Guide

## 🚀 Getting Started

### Prerequisites
- Node.js >= 20 (current: v24.13.1)
- pnpm package manager

### Running the Application
```bash
# Install dependencies (if not already done)
pnpm install

# Start development server
pnpm dev

# Open browser
# Navigate to http://localhost:5173
```

The app automatically reloads on file changes!

---

## 🧪 Feature Testing Checklist

### 1. Welcome Screen (First Time Only)
- [ ] Open app in fresh browser/private window
- [ ] Clear localStorage first: Open DevTools → Application → Clear storage
- [ ] Welcome screen appears with title "Welcome 👋"
- [ ] Can enter name and age
- [ ] Form validation works (button disabled until both fields filled)
- [ ] Confirmation message shows after submitting
- [ ] Redirects to home page automatically

### 2. Home Page
- [ ] Personalized greeting displays: "Hi [Name]! 👋 Ready to learn today?"
- [ ] Profile button in top-right with user name
- [ ] Total stars earned displayed
- [ ] Group cards show progress bars
- [ ] Groups are locked until previous group exam passed
- [ ] Clicking locked group shows lock icon
- [ ] Clicking unlocked group navigates to group page

### 3. Group Page
- [ ] Shows group number and description
- [ ] Progress bar shows letters completed
- [ ] All letter buttons visible in grid
- [ ] Completed letters show green background and checkmark
- [ ] "Take Group Exam" button appears when all letters completed
- [ ] Exam button is highlighted with gradient colors
- [ ] Back button returns to home

### 4. Lessons
- [ ] Story screen loads with image and text
- [ ] Audio playback button works
- [ ] Vocabulary section displays words with images
- [ ] Images display fully without cropping (object-contain)
- [ ] Pronunciation check works (if microphone access granted)
- [ ] Tracing screen shows letter for writing practice
- [ ] Choose exercise shows 3 option buttons
- [ ] Listen and choose exercises work
- [ ] Success message "Great! 🎉" shows on correct answer
- [ ] Error message "Try Again ❌" shows on wrong answer
- [ ] Success sound plays (ascending tone)
- [ ] Error sound plays (descending tone)
- [ ] Completion shows celebration screen
- [ ] Stars awarded after lesson

### 5. Group Exam
- [ ] Exam starts with 5 listening comprehension questions
- [ ] Progress bar shows exam completion percentage
- [ ] Question counter shows "X of 5"
- [ ] Audio plays when button clicked
- [ ] 3 possible answers displayed with images
- [ ] Can only select one answer per question
- [ ] Visual feedback on answer (green ✓ or red ✗)
- [ ] Automatically advances to next question
- [ ] All 5 questions complete the exam

### 6. Exam Results
- [ ] Score displays as percentage (0-100%)
- [ ] Passing score threshold shown (75%)
- ✅ **PASS** (≥75%):
  - [ ] Trophy icon displays
  - [ ] Green background colors
  - [ ] "Excellent! 🎉" message shows
  - [ ] "Next Group ➜" button visible
  - [ ] Success sound plays
  - [ ] Clicking button returns to home
  - [ ] Next group becomes unlocked

❌ **FAIL** (<75%):
  - [ ] Lock icon displays
  - [ ] Orange/red background colors
  - [ ] "Keep Practicing! 💪" message shows
  - [ ] "Try Again ↻" button visible
  - [ ] Error sound plays
  - [ ] Clicking button returns to group page
  - [ ] Can re-take exam

### 7. Profile Page
- [ ] Accessible from profile button in header
- [ ] Displays user name prominently
- [ ] Shows age
- [ ] Shows total stars count
- [ ] Shows groups completed count (X / 5)
- [ ] Shows average exam score %
- [ ] Shows number of exams completed
- [ ] Lists exam history with:
  - [ ] Group number
  - [ ] Score percentage
  - [ ] Pass/fail status with checkmark/X
  - [ ] Date of exam
- [ ] Green cards for passed exams
- [ ] Red cards for failed exams
- [ ] Back button returns to home

### 8. Responsive Design

**Mobile (320px width)**
- [ ] All text readable
- [ ] Buttons are 44px minimum height (touch-friendly)
- [ ] Single column or 2-column grid
- [ ] No horizontal scrolling
- [ ] Images visible without scrolling horizontally
- [ ] Cards stack vertically

**Tablet (768px width)**
- [ ] 2-column grid layout
- [ ] Better use of horizontal space
- [ ] Larger fonts readable
- [ ] Touch-friendly spacing maintained

**Desktop (1024px+ width)**
- [ ] 3-4 column grid layout
- [ ] Full width content with max-width containers
- [ ] Optimal reading width maintained
- [ ] Desktop hover effects work

### 9. Image Display
- [ ] All images show fully (no cropping)
- [ ] Images maintain aspect ratio
- [ ] Images don't distort
- [ ] Story image displays cleanly
- [ ] Vocabulary images show without cutting
- [ ] Exercise option images visible
- [ ] Exam question images display properly

### 10. Sound Effects
- [ ] Click sound plays when clicking buttons
- [ ] Success sound (ascending tone) plays on correct answers
- [ ] Error sound (descending tone) plays on wrong answers
- [ ] Sounds don't overlap or cause issues
- [ ] Volume is appropriate (not too loud)
- [ ] Microphone permission request appears for pronunciation

### 11. Data Persistence
- [ ] User name/age saved in localStorage
- [ ] Progress saved across page refreshes
- [ ] Exam scores saved and displayed
- [ ] Stars earned persist
- [ ] Group unlock status persists
- [ ] Profile data appears even after closing/reopening browser

### 12. Navigation
- [ ] Home → Group works (click group card)
- [ ] Group → Home works (click back button)
- [ ] Home → Profile works (click profile button)
- [ ] Profile → Home works (click back button)
- [ ] Exam results redirect properly
- [ ] No dead links
- [ ] URL changes correctly for routes

### 13. Animations & Transitions
- [ ] Page transitions are smooth
- [ ] Button hover effects work on desktop
- [ ] Button tap effects work on mobile
- [ ] Card animations on page load
- [ ] Progress bar animations smooth
- [ ] Star animations on profile page
- [ ] Celebration animations on lesson completion

### 14. Accessibility
- [ ] All text has sufficient contrast
- [ ] Font sizes readable on all devices
- [ ] Buttons clearly clickable/focusable
- [ ] Form inputs have proper labels
- [ ] Alt text on images (check DevTools)
- [ ] Color not only indicator of status (shapes + text used)

### 15. Browser Compatibility
- [ ] Works in Chrome/Chromium
- [ ] Works in Firefox
- [ ] Works in Safari
- [ ] Works in Edge
- [ ] Works on iOS Safari
- [ ] Works on Android Chrome

---

## 🐛 Troubleshooting

### Welcome Screen Doesn't Appear
**Solution**: Clear localStorage
```javascript
// In browser console
localStorage.clear()
// Refresh the page
```

### Images Not Loading
**Solution**: Check console for 404 errors
- Ensure image paths in curriculum.json are correct
- Images should exist in `/public/images/`

### Sound Not Playing
**Solution**: Check browser audio permissions
- Allow microphone/audio permissions
- Check browser muted status
- Check system volume

### Exam Button Not Appearing
**Solution**: Complete all letters in group first
- Return to group page
- Ensure all 6 letters are completed
- All letters should show green background

### Profile Data Not Saving
**Solution**: Check localStorage is enabled
- Open DevTools → Application
- Verify localStorage is available
- Check "phonics-progress" key exists

### TypeScript Errors
**Solution**: Run type checking
```bash
pnpm lint
```

---

## 📊 Performance Tips

### Build for Production
```bash
pnpm build
# Output in /dist folder
```

### Optimize Images
Images already use:
- `object-contain` for proper display
- Caching via query parameters
- Lazy loading support

### Monitor Bundle Size
```bash
# Check Vite build output
pnpm build
```

---

## 🔐 Data Structure

### LocalStorage Key
```
phonics-progress
```

### Data Format
```json
{
  "username": "Ahmed",
  "profile": {
    "name": "Ahmed",
    "age": 7,
    "hasSetupProfile": true
  },
  "progress": [
    {
      "groupId": 1,
      "letterId": "s",
      "stars": 3
    }
  ],
  "examScores": [
    {
      "groupId": 1,
      "score": 85,
      "passed": true,
      "date": "2024-03-14T10:30:00.000Z"
    }
  ]
}
```

---

## 📝 Common Tasks

### Add New Group
1. Edit `src/data/curriculum.json`
2. Add new group object with letters
3. Each letter needs all required fields:
   - id, letter, sound, story, vocabulary
   - choose, listening exercises

### Customize Colors
1. Edit `src/index.css` - modify Tailwind theme colors
2. Update component className colors
3. Test on all screen sizes

### Change Passing Score Requirement
1. Edit `src/components/GroupExamResultScreen.tsx`
2. Find `const PASSING_SCORE = 75;`
3. Change to desired threshold

### Add More Questions to Exam
1. Edit `src/components/GroupExamScreen.tsx`
2. Modify `.slice(0, 5)` to desired number
3. Note: Only listening exercises used

---

## ✅ Deployment Checklist

Before deploying to production:
- [ ] All tests pass (`pnpm lint`)
- [ ] Build succeeds (`pnpm build`)
- [ ] No console errors
- [ ] Welcome screen works on first visit
- [ ] All features tested
- [ ] Images load correctly
- [ ] Responsive design verified
- [ ] Performance acceptable
- [ ] localStorage working
- [ ] Analytics/tracking configured (if needed)

---

## 📞 Support

For issues or questions:
1. Check console errors (F12 → Console)
2. Check Application tab (F12 → Application → LocalStorage)
3. Verify curriculum.json is valid JSON
4. Check image paths exist
5. Check browser permissions for audio/microphone

Happy learning! 🎓
