# My Portfolio

This is a portfolio web application built with Next.js, TypeScript, Tailwind CSS, and Prisma. It allows for dynamic management of projects and professional experiences through a password-protected admin panel.

## Features

- **Single-page portfolio:** A clean and modern single-page layout.
- **Dynamic Content:** Projects and experiences are fetched from a database.
- **Admin Panel:** A protected admin page at `/admin` to manage content.
- **Authentication:** Simple password-based authentication for the admin panel.

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- npm

### Installation

1.  Clone the repository:
    ```bash
    git clone <repository-url>
    cd myportfolio
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Set up the database:
    ```bash
    npx prisma migrate dev
    ```
4.  Set up your admin password:
    - Open the `.env` file and set a new password hash for the `PASSWORD_HASH` variable.
    - You can generate a new hash by running the following command:
      ```bash
      node scripts/hash-password.mjs YOUR_NEW_PASSWORD
      ```
    - Replace `YOUR_NEW_PASSWORD` with your desired password.
    - You should also change the `JWT_SECRET` to a long, random string.

5.  Run the development server:
    ```bash
    npm run dev
    ```

The application will be available at [http://localhost:3000](http://localhost:3000). The admin panel is at [http://localhost:3000/admin](http://localhost:3000/admin).

## Managing Content

1.  Navigate to `/admin` and log in with the password you set.
2.  You will see forms to add, edit, and delete projects and experiences.
3.  Fill out the forms and submit to add new content to your portfolio.

## Extending the Project

The project is structured to be easily extensible. You can add new sections to the main page or new models to the database by following these steps:

1.  Define a new model in `prisma/schema.prisma`.
2.  Run `npx prisma migrate dev` to update the database.
3.  Create new API routes in `src/app/api` to manage the new data.
4.  Create new components in `src/components` to display the new data.
5.  Add the new components to the main page or create new pages.