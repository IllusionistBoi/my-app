# Poker Planning App

This project is a **Poker Planning App** designed to facilitate agile estimation using Planning Poker. The app was created using **Create React App** for the frontend, with animations powered by **Rive**, and **Django** for the backend to manage sessions and participants.

## Features

- **Create and Join Sessions**: Users can create or join sessions with a unique session ID.
- **Real-time Voting**: Participants vote on task effort using Planning Poker buttons (1, 3, 5, 8, 13).
- **Flip Cards**: Reveal the chosen votes of all participants after voting.
- **Dynamic UI with Animations**: The app includes interactive animations (Teddy) for enhanced user engagement.
- **Backend with Django**: Sessions and participants are managed through a Django backend.

## Getting Started

To get started with the project, follow these steps.

### Prerequisites

- Node.js and npm installed on your machine
- Python and Django set up for the backend
- Rive file (`login-teddy.riv`) placed in the `public` directory

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-repo/poker-planning-app.git

2. Navigate to the project directory:
   ```bash
   cd poker-planning-app

3. Install dependencies:
    ```bash
    npm start

This will start the app in development mode. Open http://localhost:3000 to view the app in the browser.

### Backend Setup

For the backend, navigate to the backend folder and follow the instructions in backend/README.md to set up Django, create the necessary models, and run the server.


### Available Scripts
You can run the following scripts from the project directory:

- **npm start**: Runs the app in development mode.
- **npm test**: Launches the test runner.
- **npm run build**: Builds the app for production.
- **npm run eject**: Ejects the app configuration for custom setups (irreversible action).

## Customization

### Animations
This app integrates Rive animations for interactive user experiences. To customize the animations:

- Ensure the Rive file (login-teddy.riv) is placed in the public directory.
- Modify the animation states such as isChecking, isHandsUp, trigSuccess, and trigFail for different actions like form submission, validation, and error handling.

## Voting Feature
The voting interface includes 5 buttons representing numbers (1, 3, 5, 8, 13) used for estimating effort in an agile project. A Flip Card feature reveals votes after all participants have voted.

## UI Customization
The participant list, session ID display, and voting buttons are fully customizable using CSS. For an elegant, modern look, custom icons can be added next to participants’ names.
