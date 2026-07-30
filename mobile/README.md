# Coffee Distribution Mobile App

React Native mobile app for sellers to manage deliveries on the go.

## Local Development

### Prerequisites

- Node.js 20+
- React Native CLI or Expo CLI
- Xcode (for iOS) or Android Studio (for Android)

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

3. Update `.env` with your Azure AD B2C credentials.

4. Start the Metro bundler:
   ```bash
   npm start
   ```

5. Run on iOS or Android:
   ```bash
   npm run ios    # or
   npm run android
   ```

### Features

- View assigned routes
- Check-in at delivery waypoints
- Register sales with GPS coordinates
- View sales history
- Submit complaints

### Project Structure

```
src/
├── screens/         # Screen components
│   ├── LoginPage.tsx
│   ├── DashboardPage.tsx
│   ├── RoutePage.tsx
│   └── SalesPage.tsx
└── components/      # Reusable components
```
