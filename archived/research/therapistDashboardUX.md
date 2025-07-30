# Therapist Dashboard UX Design
## GHOSTLY+ Autonomous Session Monitoring Interface

### Core User Needs
**Primary Questions Therapists Need Answered:**
1. **Compliance Status**: "Was today's session compliant?"
2. **Progress Tracking**: "How is the patient improving over time?"

### UX Design Principles

#### 1. **At-a-Glance Status (Dashboard Landing)**
```
Patient: John Doe (Room 302)                    Week 1 of 2

TODAY'S SESSION STATUS
┌─────────────────────────────────────────────────────────────┐
│ ✅ SESSION COMPLETED                                8:30 AM  │
│ Duration: 12 min | Sets: 3/3 | MVC: 78% | BFR: ✅         │
│ Compliance Score: 92% (Excellent)                          │
└─────────────────────────────────────────────────────────────┘

WEEKLY PROGRESS (5 sessions target)
█████████░ 4/5 sessions detected (80%)
```

#### 2. **Visual Status Indicators**
- **✅ Green**: Session detected and compliant
- **⚠️ Yellow**: Session detected but partially compliant
- **❌ Red**: No session detected today
- **❓ Gray**: Technical issue (data incomplete)

#### 3. **Weekly Calendar View**
```
      Mon   Tue   Wed   Thu   Fri   Sat   Sun
Week 1  ✅    ✅    ❌    ✅    ⚠️    -     -
Week 2  ✅    ❓    
```

#### 4. **Progress Tracking Interface**

**A. Compliance Trend Graph**
```
Compliance Over Time
100% ┤                    ●
 90% ┤           ●───────●
 80% ┤    ●─────●
 70% ┤●───●
 60% ┤
     └────────────────────────────
     Day 1  2  3  4  5  6  7  8
```

**B. Performance Metrics Trends**
- **MVC Achievement**: Track strength improvements
- **Duration Compliance**: Monitor endurance progress
- **Session Quality**: Overall therapeutic effectiveness

#### 5. **Detailed Session View (Drill-down)**
```
Session Details - Day 5 (Yesterday 8:30 AM)

COMPLIANCE BREAKDOWN:
├─ Completion: 12/12 reps per set (100%) ✅
├─ MVC Quality: 9/12 reps ≥75% (75%) ⚠️
├─ Duration: 11/12 reps ≥3.2s (92%) ✅
└─ BFR Pressure: 48-52% AOP (100%) ✅

THERAPEUTIC PROGRESS:
├─ Left Muscle: 76% compliance (+3% vs Day 4)
├─ Right Muscle: 71% compliance (+1% vs Day 4)
└─ Symmetry: 95% (Excellent balance)

EMG SIGNAL QUALITY:
├─ Signal-to-Noise Ratio: 8.2 dB (Good)
├─ Electrode Contact: Stable throughout
└─ Fatigue Index: -0.3 Hz/s (Normal)
```

### Semi-Autonomous Measurement UX Considerations

**IMPORTANT**: Not all elderly patients can be fully autonomous. Support systems implemented:

#### 1. **Enhanced Data Availability Indicators**
```
DETECTION STATUS:
🟢 Self-Initiated        - Patient launched session independently
🔔 Nurse-Prompted        - Session completed after nurse reminder
🤝 Nurse-Assisted        - Required nurse help with setup/execution
🟡 Partial Data Available - Some metrics missing/incomplete  
🔴 No Data Detected      - No session attempt or app launch
🔧 Technical Issue       - App/sensor malfunction suspected
```

#### 2. **Missing Data Handling with Support Options**
```
❌ No Session Detected Today

Possible Reasons:
• Patient didn't perform session
• Patient needs reminder/assistance
• Technical issue with app/sensors
• Patient forgot to wear sensors

Recommended Actions:
👩‍⚕️ Schedule nurse reminder visit (Trial)
🔔 Send bedside notification (Post-trial)
📞 Contact patient/family to verify status
🔧 Check equipment functionality
📋 Document patient feedback and support needs
```

#### 3. **Progress Confidence Indicators**
```
Progress Reliability: 85% ⚠️

Based on 6/7 sessions with complete data
Missing: Day 3 (technical issue suspected)
Confidence: High for detected sessions
```

### Dashboard Layout Hierarchy

#### **Level 1: Executive Summary (5-second scan)**
- Patient status indicator
- Today's compliance status
- Weekly progress bar
- Alert notifications

#### **Level 2: Weekly Overview (30-second review)**
- Calendar view with status icons
- Trend indicators (improving/declining)
- Key metrics summary
- Action items/alerts

#### **Level 3: Detailed Analysis (2-minute deep dive)**
- Session-by-session breakdown
- Therapeutic progress metrics
- Technical data quality assessment
- Clinical decision support

### Responsive Design Considerations

#### **Mobile/Tablet View (Bedside Rounds)**
```
┌─────────────────────────┐
│ 👤 John Doe - Room 302  │
│ ✅ Today: Compliant     │
│ 📊 Week: 4/5 sessions   │
│ 📈 Progress: +5%        │
│ [View Details →]        │
└─────────────────────────┘
```

#### **Desktop View (Office Review)**
- Multi-patient overview
- Detailed analytics panels
- Export capabilities for reports
- Integration with hospital EMR

### Interaction Patterns

#### **Quick Actions**
- **Tap/Click Status**: Expand to show details
- **Swipe/Hover Progress Bar**: Show day-by-day breakdown
- **Long Press/Right-click Patient**: Access full history
- **Pull-to-refresh**: Update latest session data

#### **Notification System**
```
🔔 ALERTS (2)
├─ Room 302: No session detected today
└─ Room 418: Technical issue - BFR cuff

📊 INSIGHTS (1)
└─ 3 patients showing improvement trend
```

### Clinical Decision Support Integration

#### **Smart Recommendations**
```
💡 CLINICAL INSIGHTS

Patient shows 15% improvement in MVC over 5 days
→ Consider progressing difficulty level

Right muscle lagging behind left (82% vs 91%)
→ Monitor for compensation patterns

Adherence declining (Day 1: 100% → Day 5: 72%)
→ Patient motivation intervention recommended
```

#### **Report Generation**
- **Daily Summary**: Print/export for medical records
- **Weekly Progress**: Trend analysis for team meetings
- **Discharge Summary**: Complete rehabilitation outcomes

### Accessibility & Usability

#### **Visual Design**
- High contrast for medical environment lighting
- Large touch targets for mobile use
- Color-blind friendly status indicators
- Consistent iconography throughout

#### **Cognitive Load Management**
- Progressive disclosure (summary → details)
- Contextual help tooltips
- Consistent navigation patterns
- Clear visual hierarchy

### Support System Integration

#### **During Trial Phase (Nurse-Assisted)**
```
NURSE VISIT SCHEDULING INTERFACE:

Patient Queue for Today:
┌─────────────────────────────────────────────────┐
│ 🔴 Room 302 - No session detected             │
│    → Schedule reminder visit: [Now] [Later]    │
├─────────────────────────────────────────────────┤
│ 🔔 Room 418 - Needs daily reminder            │
│    → Nurse visit scheduled: 2:30 PM           │
├─────────────────────────────────────────────────┤
│ 🤝 Room 525 - Requires assistance             │
│    → Setup help needed: [Available Now]       │
└─────────────────────────────────────────────────┘
```

#### **Post-Trial Phase (Technology-Assisted)**
```
NOTIFICATION SYSTEM DASHBOARD:

Automated Support Status:
┌─────────────────────────────────────────────────┐
│ 📱 Bedside Reminders: 12 sent, 8 responded    │
│ 📋 Todo Lists: 15 updated, 11 completed       │
│ 🔊 Voice Alerts: 6 triggered, 4 successful    │
│ 👨‍👩‍👧‍👦 Family Alerts: 3 sent, 2 acknowledged     │
└─────────────────────────────────────────────────┘

Configure Support Level:
Patient: John Doe (Room 302)
🔔 Reminder Frequency: [Every 2 hours] ▼
👨‍👩‍👧‍👦 Family Contact: [Enabled] ▼
🔊 Voice Assistance: [Disabled] ▼
```

### Integration Points

#### **Hospital Systems**
- **EMR Integration**: Push compliance data to patient records
- **Nursing System**: Integrate reminder visits into nurse workflows
- **Bedside Tablets**: Deploy todo lists and notification systems
- **Communication Systems**: Family/caregiver alert integration
- **Voice Systems**: Room-based voice assistant integration

#### **Clinical Workflow Enhancement**
- **Morning Rounds**: Nurse visit assignments and patient support needs
- **Nursing Shifts**: Handoff of patients requiring assistance
- **Team Meetings**: Progress review with autonomy assessment
- **Discharge Planning**: Post-discharge notification system setup
- **Quality Assurance**: Support effectiveness monitoring

This UX design addresses the fundamental challenge of autonomous measurement by being transparent about data limitations while providing maximum clinical value from available information.