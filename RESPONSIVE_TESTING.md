# ShroomSync Responsive Design Checklist

## Testing Instructions

To properly test the responsive design across all pages:

### Browser DevTools Setup
1. Open Chrome DevTools (F12 or Ctrl+Shift+I)
2. Click the device toggle button (top-left of DevTools)
3. Select desired device or customize dimensions

### Recommended Device Sizes for Testing

**Smartphones:**
- iPhone SE (375x667)
- iPhone 12 (390x844)
- iPhone 14 Pro (393x852)
- Pixel 5 (393x851)
- Galaxy S21 (360x800)

**Tablets:**
- iPad (768x1024)
- iPad Pro 11" (834x1194)
- iPad Air (768x1024)

**Desktop:**
- 1920x1080 (Full HD)
- 1366x768 (HD)
- 1024x768 (Tablet-like desktop)

## Page-by-Page Responsive Checklist

### ✅ Dashboard Page

**Desktop (1025px+)**
- [ ] Stats row displays 4 columns
- [ ] Dashboard grid shows 2-column layout
- [ ] Sidebar fully visible and expanded (250px)
- [ ] Charts display with full height
- [ ] All data readable without horizontal scroll
- [ ] Notifications list visible alongside content

**Tablet (769px-1024px)**
- [ ] Stats row shows 2 columns
- [ ] Dashboard grid maintains 2-column layout
- [ ] Sidebar displays at 220px width
- [ ] Charts remain responsive
- [ ] All text readable
- [ ] No overflow issues

**Mobile (481px-768px)**
- [ ] Stats row displays as single column
- [ ] Dashboard grid converts to single column
- [ ] Sidebar transforms to drawer overlay
- [ ] Menu toggle button visible and functional
- [ ] Charts stack vertically
- [ ] Touch targets are minimum 44px
- [ ] Notifications sidebar mobile-friendly

**Small Mobile (≤480px)**
- [ ] All content visible without horizontal scroll
- [ ] Header padding minimal (12px)
- [ ] Button spacing sufficient for touch
- [ ] Modal dialogs fit within screen
- [ ] Text remains readable
- [ ] No layout shifts during interaction

---

### ✅ Kumbung Saya (My Farms) Page

**All Sizes**
- [ ] Table responsive (card layout on mobile)
- [ ] Each row converts to card on small screens
- [ ] Action buttons (Edit/Delete) accessible
- [ ] Add new button visible and functional
- [ ] Search/filter bar responsive
- [ ] Column headers stack properly on mobile

**Mobile Specific**
- [ ] Table transitions to card view
- [ ] No horizontal table scroll
- [ ] Device names display prominently
- [ ] Status badges visible
- [ ] Action buttons stacked vertically
- [ ] Swipe actions work (if implemented)

---

### ✅ Monitoring Page

**All Sizes**
- [ ] Sensor grid displays responsively
- [ ] Real-time data updates visible
- [ ] Chart containers scale properly
- [ ] Sensor cards maintain 44px minimum height for touch

**Mobile Specific**
- [ ] Sensor grid becomes single column
- [ ] Charts stack vertically
- [ ] Temperature/Humidity displays side-by-side or stacked appropriately
- [ ] Legend/Labels visible without overflow
- [ ] Touch-friendly legend selection (if applicable)

---

### ✅ Siklus & Panen (Cycles & Harvest) Page

**All Sizes**
- [ ] Cycle list displays responsively
- [ ] Progress indicators visible
- [ ] Timeline readable at all sizes
- [ ] Harvest data clearly presented

**Mobile Specific**
- [ ] Timeline converts to mobile-friendly format
- [ ] Timeline events stack vertically
- [ ] Dates and durations readable
- [ ] Status badges visible
- [ ] Action buttons accessible

---

### ✅ Kontrol (Control) Page

**All Sizes**
- [ ] Control grid layout responsive
- [ ] Device controls accessible
- [ ] Mode selector visible
- [ ] Schedule editor functional

**Mobile Specific**
- [ ] Control panels stack vertically
- [ ] Setpoint inputs remain accessible
- [ ] Toggle switches/buttons 44px minimum
- [ ] Modal forms fit within screen height
- [ ] Keyboard doesn't obscure critical controls

---

### ✅ Analitik (Analytics) Page

**All Sizes**
- [ ] Charts display with proper aspect ratio
- [ ] Data points visible
- [ ] Legend readable
- [ ] Filter options accessible

**Mobile Specific**
- [ ] Charts maintain readability at reduced size
- [ ] Axis labels don't overlap
- [ ] Legend stacks vertically if needed
- [ ] Date picker accessible
- [ ] Export buttons functional

---

### ✅ Notifikasi (Notifications) Page

**All Sizes**
- [ ] Notification list displays properly
- [ ] Timestamps visible
- [ ] Action buttons (mark as read, delete) accessible

**Mobile Specific**
- [ ] Notification items have 44px minimum touch height
- [ ] Swipe actions work (if implemented)
- [ ] Mark as read/delete buttons accessible
- [ ] Message text wraps properly
- [ ] No horizontal scroll

---

### ✅ Profil (Profile) Page

**All Sizes**
- [ ] Profile card displays properly
- [ ] Avatar visible and appropriately sized
- [ ] User information readable
- [ ] Edit buttons accessible

**Mobile Specific**
- [ ] Profile card details stack vertically
- [ ] Edit forms stack vertically
- [ ] Input fields full-width where appropriate
- [ ] Save/Cancel buttons accessible
- [ ] Modal dialogs fit within screen

---

## Cross-Device Testing Checklist

### Visual Elements
- [ ] All text remains readable without zoom
- [ ] Images scale proportionally
- [ ] Icons maintain visibility
- [ ] Color contrast meets WCAG AA standards
- [ ] No content hidden unintentionally
- [ ] Spacing appears balanced

### Functionality
- [ ] All buttons are clickable/tappable
- [ ] Form inputs have minimum 44px height on mobile
- [ ] Links are distinguishable and accessible
- [ ] Modals close properly
- [ ] Navigation works smoothly
- [ ] Sidebar toggle functions on mobile

### Performance
- [ ] Pages load quickly on mobile connections
- [ ] No janky animations
- [ ] Scrolling smooth on all devices
- [ ] Touch interactions responsive

### Orientation (Mobile)
- [ ] Layout adjusts on portrait orientation
- [ ] Content readable in landscape
- [ ] No content lost during rotation
- [ ] Keyboard handling works properly

---

## Common Issues & Solutions

### Issue: Horizontal Scroll on Mobile
**Solution:** Check CSS width values; ensure all elements use max-width: 100% or 100vw constraints

### Issue: Text Too Small on Mobile
**Solution:** Verify font sizes scale down in media queries; minimum 13-14px on mobile

### Issue: Buttons Hard to Tap
**Solution:** Ensure minimum 44x44px touch targets; increase padding if needed

### Issue: Modal Overflow on Mobile
**Solution:** Use max-height: calc(100dvh - 32px) and overflow-y: auto for scrollable content

### Issue: Sidebar Cuts Off Content
**Solution:** Verify z-index on sidebar drawer; ensure overlay backdrop appears properly

### Issue: Charts Not Responsive
**Solution:** Ensure ResponsiveContainer from Recharts wraps chart components; no fixed width on parent

---

## Browser DevTools Responsive Testing Tips

1. **Throttle Network:** Test on "Slow 3G" to simulate real mobile conditions
2. **Emulate Touch:** Enable touch emulation in DevTools
3. **Test Multiple Orientations:** Use landscape mode testing for tablets
4. **Check Font Sizes:** Right-click → Inspect element → check computed styles
5. **Verify Media Queries:** Open DevTools console and check `window.innerWidth`

---

## Keyboard Navigation Testing (Accessibility)

- [ ] Tab through all interactive elements
- [ ] Keyboard shortcuts work (if implemented)
- [ ] Form submission works with Enter key
- [ ] Modal escape key closes dialog
- [ ] Focus visible on all focused elements

---

## Performance Testing

**Mobile Performance:**
- [ ] First Contentful Paint < 3s (good), < 1.8s (excellent)
- [ ] Largest Contentful Paint < 2.5s
- [ ] Cumulative Layout Shift < 0.1
- [ ] First Input Delay < 100ms

Use Google Lighthouse for automated testing:
1. Open DevTools → Lighthouse
2. Select "Mobile" 
3. Run audit
4. Review performance metrics

---

## Sign-off Checklist

- [ ] All 8 pages tested on phone (768px and below)
- [ ] All 8 pages tested on tablet (769px-1024px)
- [ ] All 8 pages tested on desktop (1025px+)
- [ ] No horizontal scroll on mobile
- [ ] All touch targets minimum 44px
- [ ] Font sizes readable at all sizes
- [ ] Navigation intuitive on mobile
- [ ] Performance acceptable
- [ ] No console errors
- [ ] Responsive design documentation reviewed

---

## Bugs Found During Testing

Use this section to document any responsive design issues found:

```
Date: ___________
Page: ___________
Device Size: ___________
Issue: ___________
Steps to Reproduce: ___________
Expected Behavior: ___________
Actual Behavior: ___________
Screenshot/Notes: ___________
```

---

## Contact & Support

For responsive design issues or questions:
1. Review RESPONSIVE_DESIGN.md guide
2. Check CSS in src/App.css media queries
3. Verify component structure in src/App.jsx
4. Test in multiple browsers and devices
