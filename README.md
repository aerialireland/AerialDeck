# AerialDeck

A password-protected web dashboard for viewing your Dronedeck flight plans and flight logs.

## Features

- Password-protected access
- Flight Plans as the main view
- Flight Logs nested within each Flight Plan
- Stats overview (total plans, logs, flight time)
- Clean, responsive design

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**

   Copy the example file and edit it:
   ```bash
   cp .env.example .env
   ```

   Then edit `.env` with your values:
   ```
   DRONEDECK_API_TOKEN=your_api_token_here
   DASHBOARD_PASSWORD=your_secure_password
   SESSION_SECRET=a_random_string_for_sessions
   PORT=3000
   ```

3. **Start the server:**
   ```bash
   npm start
   ```

4. **Open in browser:**

   Go to `http://localhost:3000`

## Getting Your API Token

1. Log into [app.dronedeck.io](https://app.dronedeck.io)
2. Click your profile icon → "Api tokens"
3. Create a new token with `flight_plans:read` and `flight_logs:read` permissions
4. Copy the token immediately (it won't be shown again)

## Deployment

This can be deployed to any Node.js hosting platform:

- **Railway**: Connect your repo and set environment variables
- **Render**: Create a Web Service and configure env vars
- **Heroku**: Deploy with `heroku create` and set config vars
- **VPS**: Use PM2 to run: `pm2 start server.js`

Remember to set all environment variables on your hosting platform.
