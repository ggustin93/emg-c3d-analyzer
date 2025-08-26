# TODO: Sync Supabase Cloud Environment to Local Development Workflow

**Date**: 2025-08-26

**Goal**: Transition from a cloud-first MVP workflow to a professional, local-first development workflow. This process will pull the existing cloud database schema down to the local machine, enabling version-controlled schema management.

---

### **Step 1: Prerequisites**

1.  **Install Supabase CLI**: Ensure the latest version of the Supabase CLI is installed on your machine.
    ```bash
    npm install supabase --save-dev
    ```
2.  **Start Docker**: The Supabase CLI uses Docker to run a complete Supabase stack locally. Make sure your Docker Desktop application is running before you begin.
3.  **(Safety First) Backup Your Cloud Database**: Before making any changes, it is highly recommended to create a manual backup of your production database.
    *   Navigate to your Supabase Project Dashboard.
    *   Go to `Database` -> `Backups`.
    *   Click `Backup now` to create a one-time backup.

---

### **Step 2: Initialize the Local Supabase Project**

This command sets up the necessary local configuration files. It does **not** connect to the cloud or affect your remote database.

1.  Open your terminal and navigate to the root directory of your project.
2.  Run the following command:
    ```bash
    supabase init
    ```
3.  **Expected Outcome**: A new `supabase/` directory will be created in your project root. This directory contains `config.toml` and a `migrations/` folder. Commit this new directory to Git.

---

### **Step 3: Link Your Local Project to the Cloud Instance**

This step securely connects your local CLI to your remote Supabase project.

1.  **Find Your Project Ref ID**:
    *   Go to your Supabase Project Dashboard.
    *   Navigate to `Project Settings` -> `General`.
    *   Copy the `Reference ID`.
2.  Run the link command, replacing `<your-project-ref>` with the ID you copied:
    ```bash
    supabase link --project-ref <your-project-ref>
    ```
3.  The CLI will prompt you for your project's database password to establish the connection.

---

### **Step 4: Pull the Remote Schema into a Local Migration**

This is the key step to synchronize your local environment with your existing cloud setup.

1.  Run the `remote commit` command:
    ```bash
    supabase db remote commit
    ```
2.  **Expected Outcome**: The CLI will inspect your live cloud database's schema (tables, columns, RLS policies, functions, etc.) and generate a new SQL file inside your `supabase/migrations/` directory. This file represents the initial state of your database schema.
3.  Review the generated migration file to ensure it accurately reflects your cloud schema. Commit this file to Git.

---

### **The New Development Workflow (Going Forward)**

After completing these steps, you are set up for a safe, version-controlled workflow. All future database schema changes should follow this new process:

1.  **Start the local dev server**:
    ```bash
    supabase start
    ```
2.  **Develop locally**: Make any desired schema changes (e.g., creating tables, adding columns) on your local database instance.
3.  **Generate a new migration from local changes**: Once you are satisfied with your local changes, create a new migration file.
    ```bash
    supabase migration new <a_descriptive_name_for_your_change>
    ```
4.  **Deploy changes to the cloud**: To apply the new migration to your live Supabase database, run:
    ```bash
    supabase db push
    ```

**Important**: Avoid making schema changes directly in the Supabase Dashboard from now on. All schema modifications should be managed through this local-first, migration-based workflow.
