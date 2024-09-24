# Backend Setup for Poker Planning App

The backend of the **Poker Planning App** is built using **Django**, which handles session management, participant tracking, and storage of votes.

## Prerequisites

To set up the backend, ensure the following are installed on your machine:

- Python 3.x
- Django (latest version)
- PostgreSQL (or any preferred database)

## Installation Steps

1. **Navigate to the Backend Directory:**
   After cloning the repository, navigate to the backend folder.
   ```bash
   cd backend

2. **Create a Virtual Environment:** It's recommended to use a virtual environment to manage dependencies.
   ```bash
    python3 -m venv venv
    source venv/bin/activate  # On Windows, use venv\Scripts\activate

3. **Install Django and Other Dependencies:** Install Django and other required dependencies using pip.
   ```bash
    pip install -r requirements.txt

4. **Configure the Database:** The project is set up to use PostgreSQL by default. To configure your database, update the DATABASES setting in backend/settings.py.
   ```bash
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': 'poker_planning',
            'USER': 'your_db_user',
            'PASSWORD': 'your_db_password',
            'HOST': 'localhost',
            'PORT': '5432',
        }
    }

5. **Run Migrations:** Apply the necessary migrations to set up your database tables.

   ```bash
    python manage.py migrate

6. **Create a Superuser:** To access the Django admin panel, create a superuser.

   ```bash
    python manage.py createsuperuser

7. **Run the Development Server:** Start the backend development server.

   ```bash
    python manage.py runserver 8080

Your backend will be available at http://localhost:8080.

## Models
The backend uses the following Django models to manage sessions and participants:

* **Session:** Represents a planning poker session, identified by a unique session ID.
* **Participant:** Represents a participant in a session. Each participant has a username and their vote is tracked in the session.
* **Vote: Stores** the voting information of each participant in a session, including the effort estimation (1, 3, 5, 8, 13).

To modify the models, check backend/models.py and make necessary changes. After modifying the models, run:
    ```bash
    python manage.py makemigrations
    python manage.py migrate

## API Endpoints
The backend provides several API endpoints for interacting with the frontend:

* **Create Session:** Allows users to create a new session.
* **Join Session:** Allows users to join an existing session using the session ID.
* **Cast Vote:** Lets participants cast a vote during a session.
* **Flip Cards:** Reveals the votes of all participants once everyone has voted.

These endpoints are defined in backend/views.py and can be accessed via standard HTTP requests.

## Deployment
To deploy the backend, follow these steps:

- Set up a production database (e.g., PostgreSQL).
- Update the ALLOWED_HOSTS and DATABASES settings in settings.py.
- Use a production server such as Gunicorn or uWSGI with Nginx.
- Apply migrations and collect static files:

   ```bash
    python manage.py migrate
    python manage.py collectstatic

Start the production server:
    ```bash
    gunicorn backend.wsgi:application --bind 0.0.0.0:8000
