DESIGN SYSTEM IMPLEMENTATION - PREMIUM EDUCATIONAL SAAS

Implement the following color system throughout the entire project with a modern, premium aesthetic:

PRIMARY COLORS:
--ink-black: #111827 (Main dark background, primary text)
--medium-slate-blue: #8B5CF6 (Primary brand color, main CTAs, interactive elements)
--slime-lime: #A3E635 (Accent color for highlights, success states, premium CTAs)
--dust-grey: #D4D4D8 (Secondary text, borders, dividers, disabled states)
--platinum: #F4F4F5 (Light backgrounds, cards, surfaces)

IMPLEMENTATION REQUIREMENTS:

1. COLOR USAGE HIERARCHY:
   - Background: Use ink-black (#111827) as the primary dark theme background
   - Surface/Cards: Use platinum (#F4F4F5) for light mode cards, or lighten ink-black to #1F2937 for dark mode cards
   - Primary actions: Medium slate blue (#8B5CF6) for all primary buttons, links, active states
   - Premium highlights: Slime lime (#A3E635) SPARINGLY for:
     * High-priority CTAs ("Start Learning", "Upgrade", "Get Started")
     * Success notifications and achievements
     * Progress indicators at milestones
     * Premium feature badges
   - Text: Ink-black on light backgrounds, platinum on dark backgrounds
   - Secondary text: Dust grey (#D4D4D8) at 70-80% opacity

2. COMPONENT-SPECIFIC IMPLEMENTATION:

   BUTTONS:
   - Primary: Medium slate blue background, white text, hover: darken 10%
   - Premium/CTA: Slime lime background, ink-black text, hover: glow effect
   - Secondary: Transparent with dust grey border, hover: dust grey background
   - Ghost: No background, medium slate blue text

   INPUTS & FORMS:
   - Border: Dust grey
   - Focus state: Medium slate blue border with subtle glow
   - Background: Platinum (light) or #1F2937 (dark)
   - Error state: #EF4444 (add this as --error-red)

   NAVIGATION:
   - Active state: Medium slate blue
   - Hover: Dust grey background
   - Icons: Dust grey, active: Medium slate blue

   CARDS & SURFACES:
   - Background: Platinum (light) or #1F2937 (dark)
   - Border: Dust grey at 20% opacity
   - Hover: Subtle medium slate blue glow/border

   BADGES & TAGS:
   - Info: Medium slate blue background at 10%, medium slate blue text
   - Success: Slime lime background at 10%, darken slime lime for text (#84CC16)
   - Neutral: Dust grey background at 20%, ink-black text

   PROGRESS INDICATORS:
   - Track: Dust grey at 30% opacity
   - Fill: Gradient from medium slate blue to slime lime
   - Milestones: Slime lime dots

3. MODERN PREMIUM EFFECTS:

   GRADIENTS:
   - Hero sections: linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)
   - Premium features: linear-gradient(135deg, #8B5CF6 0%, #A3E635 100%)
   - Subtle backgrounds: linear-gradient(180deg, #111827 0%, #1F2937 100%)

   SHADOWS (for depth):
   - Subtle: 0 1px 3px rgba(17, 24, 39, 0.1)
   - Medium: 0 4px 6px rgba(17, 24, 39, 0.1)
   - Large: 0 10px 25px rgba(139, 92, 246, 0.15)
   - Glow (premium): 0 0 20px rgba(163, 230, 53, 0.3)

   ANIMATIONS:
   - Transitions: all 200ms ease-in-out
   - Hover scale: transform: scale(1.02)
   - Button press: transform: scale(0.98)
   - Premium pulse: Add subtle slime lime pulse animation to premium CTAs

4. ACCESSIBILITY:
   - Ensure WCAG AA compliance (4.5:1 contrast ratio minimum)
   - Text on medium slate blue: Use white (#FFFFFF)
   - Text on slime lime: Use ink-black (#111827)
   - Text on platinum: Use ink-black (#111827)
   - Text on ink-black: Use platinum (#F4F4F5)
   - Add focus visible rings: 2px solid medium slate blue with 2px offset

5. DARK MODE STRATEGY (if applicable):
   - Background: Ink-black (#111827)
   - Surface: #1F2937 (slightly lighter than ink-black)
   - Text: Platinum (#F4F4F5)
   - Keep purple and lime the same (they work in both modes)

6. SPECIAL TOUCHES FOR PREMIUM FEEL:
   - Add subtle noise texture overlay on ink-black backgrounds (opacity: 2%)
   - Use frosted glass effect (backdrop-filter: blur(10px)) on modals/overlays
   - Animate slime lime elements with subtle glow on hover
   - Use smooth page transitions
   - Add micro-interactions (button ripples, smooth scrolls)

BRAND PERSONALITY:
Modern, bold, innovative, premium, energetic, future-forward. This is not a traditional learning platform - it's a revolution in personalized education. The design should feel alive, intelligent, and cutting-edge.

OUTPUT:
- Implement across ALL components, pages, and interfaces
- Create CSS variables/Tailwind config with these exact colors
- Ensure consistency in spacing, shadows, and hover states
- Test in both light and dark themes
- Prioritize the purple as primary, use lime strategically for maximum impact