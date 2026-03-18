# FiL - Project TODO

## Phase 1: Project Initialization
- [x] Initialize project scaffold with web-db-user template
- [x] Create database schema for users, narratives, matches, and subscriptions
- [x] Set up Stripe integration

## Phase 2: Database & Backend
- [x] Design and implement users table with profile fields
- [x] Create narratives table for ideal partner descriptions
- [x] Create matches table to store compatibility scores
- [x] Create subscriptions table for premium access tracking
- [x] Create profile_photos table for image storage metadata
- [x] Create notifications table for email tracking
- [x] Create match_views table to track profile views
- [x] Implement database migrations and apply schema
- [x] Add database query helpers in server/db.ts
- [x] Create tRPC routers for narratives, subscriptions, and matching

## Phase 3: Authentication & User Management
- [x] Build user registration and login flow (Manus OAuth already integrated)
- [x] Create user profile management page (Dashboard)
- [x] Implement profile completion onboarding
- [x] Add user role management (free vs premium)
- [x] Build user profile viewing page

## Phase 4: Narrative Input & Refinement
- [x] Create narrative input form with rich text editor
- [x] Implement LLM-powered narrative refinement suggestions
- [x] Build narrative editing and preview interface
- [x] Add character count and quality feedback
- [ ] Create narrative history/versioning

## Phase 5: AI Matching Engine
- [x] Implement narrative similarity calculation using LLM embeddings
- [x] Build match ranking algorithm
- [x] Create matches API endpoint
- [ ] Implement caching for performance
- [x] Build match results display page
- [ ] Add match detail/compatibility score view

## Phase 6: Stripe Integration
- [x] Set up Stripe payment processing
- [x] Create subscription plans (monthly/annual)
- [ ] Implement checkout flow
- [x] Build subscription management page
- [ ] Add webhook handling for subscription events
- [ ] Implement billing history display

## Phase 7: Profile Photos & Cloud Storage
- [ ] Create photo upload interface
- [ ] Implement S3 integration for file storage
- [ ] Add image optimization and resizing
- [ ] Build photo gallery display
- [ ] Implement CDN URL generation
- [ ] Add photo deletion and management

## Phase 8: Email Notifications
- [ ] Set up email service integration
- [ ] Create notification templates
- [ ] Implement new match notification emails
- [ ] Implement profile view notification emails
- [ ] Build notification preferences page
- [ ] Add email unsubscribe handling

## Phase 9: Freemium Access Control
- [ ] Implement free tier limits (3 matches visible)
- [ ] Add premium feature gating
- [ ] Build upgrade prompts and CTAs
- [ ] Create feature comparison page
- [ ] Implement access control checks in API

## Phase 10: Testing & Polish
- [ ] Write unit tests for matching algorithm
- [ ] Test authentication flows
- [ ] Test payment processing
- [ ] Mobile responsiveness testing
- [ ] Desktop responsiveness testing
- [ ] Performance optimization
- [ ] Security audit
- [ ] Bug fixes and polish

## Phase 11: Deployment & Delivery
- [ ] Create final checkpoint
- [ ] Deliver application to user
- [ ] Provide deployment instructions
- [ ] Document API and features


## Photo Upload Feature (New)
- [x] Create photo upload backend API routes
- [x] Build photo upload UI component with drag-and-drop
- [x] Implement S3 integration and image optimization
- [x] Add photo management (reorder, delete, set main avatar)
- [ ] Display photos on profile and match cards
- [ ] Test photo upload and display

## Beta Testing Infrastructure (New)
- [ ] Create beta testing guide for mobile apps
- [ ] Set up TestFlight configuration for iOS
- [ ] Set up Google Play Beta configuration for Android
- [ ] Create beta tester invitation system
- [ ] Create feedback collection form
- [ ] Set up crash reporting and analytics

## Email Notifications (New)
- [ ] Create email notification templates
- [ ] Implement email service integration
- [ ] Add notification triggers for new matches
- [ ] Add notification triggers for profile views
- [ ] Create notification preferences UI
- [ ] Add unsubscribe functionality
- [ ] Test email delivery

## Direct Messaging (New)
- [ ] Create messages database table
- [ ] Implement message API endpoints
- [ ] Build messaging UI component
- [ ] Add real-time message updates (WebSocket)
- [ ] Create message notifications
- [ ] Add message read/unread status
- [ ] Implement message search
- [ ] Add block user functionality
