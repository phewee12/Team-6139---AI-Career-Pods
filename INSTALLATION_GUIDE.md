# Installation Guide v1.0.0

**Version:** 1.0.0
**Last Updated:** April 28, 2026
**Project:** Qwyse - AI Career Pods Platform

## Table of Contents

1. [Pre-requisites](#1-pre-requisites)
2. [Dependent Libraries](#2-dependent-libraries)
3. [Download Instructions](#3-download-instructions)
4. [Build Instructions](#4-build-instructions)
5. [Installation of Actual Application](#5-installation-of-actual-application)
6. [Run Instructions](#6-run-instructions)
7. [Troubleshooting](#7-troubleshooting)

## 1. Pre-requisites

### 1.1 Hardware Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 cores (e.g., Intel i3 or AMD Ryzen 3) | 4+ cores (Intel i7/i9, AMD Ryzen 7) |
| RAM | 4 GB | 8 GB or more |
| Storage | 10 GB free disk space | 20 GB SSD |
| Network | Broadband internet connection (10+ Mbps) | 100+ Mbps |
| Operating System | Windows 10/11, macOS 11+, or Linux (Ubuntu 20.04+) | Latest OS version |

### 1.2 Software Requirements

| Software | Version | Purpose | Download Link | Installation Instructions |
|----------|---------|---------|---------------|---------------------------|
| Node.js | 20.x LTS or higher | JavaScript runtime for backend and frontend | [nodejs.org](https://nodejs.org) | Run installer, verify with `node --version` |
| npm | 9.x or higher | Package manager (included with Node.js) | (included) | Verify with `npm --version` |
| Git | 2.x or higher | Version control for cloning repository | [git-scm.com](https://git-scm.com) | Run installer, verify with `git --version` |
| PostgreSQL | 14, 15, or 16 | Primary database | [postgresql.org](https://www.postgresql.org/download/) | See Section 1.3.2 |
| Modern Browser | Latest version | Frontend access | Chrome/Firefox/Safari/Edge | Install from official website |

### 1.3 Required External Accounts & Services

#### 1.3.1 Supabase (Required - Database & Storage)

| Item | Details |
|------|---------|
| **Purpose** | Provides PostgreSQL database and file storage for resume PDFs |
| **Sign-up Link** | https://supabase.com |
| **Free Tier Limits** | 500 MB database, 1 GB file storage, unlimited API requests |
| **Setup Time** | ~5 minutes |
| **Cost** | Free tier available; paid plans start at $25/month |

**Supabase Setup Steps:**
1. Go to https://supabase.com
2. Click "Start your project"
3. Sign in with GitHub or email
4. Click "New project"
5. Fill in:
   - Name: `qwyse-db`
   - Database Password: Create a strong password (save this!)
   - Region: Choose closest to your users
   - Pricing Plan: Free tier
6. Click "Create new project" (wait 2-3 minutes)

#### 1.3.2 Google AI Studio (Required - AI Features)

| Item | Details |
|------|---------|
| **Purpose** | Provides Gemini API for AI resume feedback and bi-weekly summaries |
| **Sign-up Link** | https://makersuite.google.com/app/apikey |
| **Free Tier Limits** | 60 requests per minute (free) |
| **Setup Time** | ~2 minutes |
| **Cost** | Free tier available; paid via Google Cloud |

**Gemini API Setup Steps:**
1. Go to https://makersuite.google.com/app/apikey
2. Sign in with Google account
3. Click "Create API key"
4. Select or create a Google Cloud project
5. Copy the API key (save for later)

#### 1.3.3 Google Cloud Platform (Optional - OAuth)

| Item | Details |
|------|---------|
| **Purpose** | Enables Google Sign-In for users |
| **Sign-up Link** | https://console.cloud.google.com |
| **Free Tier Limits** | Included in free tier |
| **Setup Time** | ~10 minutes |
| **Cost** | Free (within Google Cloud free tier) |

**Google OAuth Setup Steps:**
1. Go to https://console.cloud.google.com
2. Create new project or select existing
3. Enable APIs: "Google+ API" and "People API"
4. Go to Credentials → Create Credentials → OAuth Client ID
5. Application type: "Web application"
6. Name: "Qwyse Development"
7. Authorized redirect URIs: `http://localhost:4000/api/auth/google/callback`
8. Click "Create"
9. Copy Client ID and Client Secret (save for later)

### 1.4 Network Requirements

| Requirement | Development | Production |
|-------------|-------------|------------|
| Port 4000 (Backend) | Available and open | Open inbound |
| Port 5173 (Frontend Dev) | Available and open | Not needed |
| Port 80/443 (Production) | Not needed | Open inbound |
| Outbound internet | Required (API calls) | Required |
| Firewall exceptions | Allow ports 4000, 5173 | Allow ports 4000 (or 80/443 with proxy) |

### 1.5 Verification Script

Run this to verify your system meets requirements:

```bash
# Check Node.js version
node --version
# Expected: v20.x.x or higher

# Check npm version
npm --version
# Expected: 9.x.x or higher

# Check Git version
git --version
# Expected: 2.x.x or higher

# Check memory (Linux/Mac)
free -h
# Expected: At least 4GB total

# Check disk space (Linux/Mac)
df -h
# Expected: At least 10GB free
```

## 2. Dependent Libraries

### 2.1 Automatic Installation (Reconmmended)

All dependencies are automatically installed via npm. From the project root:

```bash
npm install
```

### 2.2 Manual Installation (If Automatic Fails)

If 2.1 fails, install dependencies manually:

#### 2.2.1 Backend Dependencies

```bash
cd backend

# Core Web Framework
npme install express@4.21.2
npm install cookie-parser@1.4.7
npm install cors@2.8.5
npm install dotenv@16.4.7

# Database & Authentication
npm install @prisma/client@6.19.1
npm install @supabase/supabase-js@2.101.1
npm install bcrypt@6.0.0
npm install jsonwebtoken@9.0.2
npm install passport@0.7.0
npm install passport-google-oauth20@2.0.0

# AI & Validation
npm install @google/generative-ai@0.24.1
npm install zod@3.24.2

# Development dependencies
npm install --save-dev cross-env@7.0.3
npm install --save-dev nodemon@3.1.9
npm install --save-dev prisma@6.19.1
npm install --save-dev supertest@7.1.4
npm install --save-dev vitest@4.1.0
```

#### 2.2.2 Frontend Dependencies

```bash
cd frontend

# Core framework
npm install react@19.2.4
npm install react-dom@19.2.4
npm install react-router-dom@7.9.5

# Development dependencies
npm install --save-dev @vitejs/plugin-react@6.0.0
npm install --save-dev vite@8.0.0
npm install --save-dev eslint@9.39.4
npm install --save-dev babel-plugin-react-compiler@1.0.0
```
#### 2.2.3 Global Tools

```bash
# PM2 for production process management
npm install -g pm2@latest

# Prisma ORM tools (usually local, but global optional)
npm install -g prisma@6.19.1
```

### 2.3

For Linux

```bash
sudo apt update
sudo apt install build-essential
sudo apt install postgresql-client
```

For MacOS

```bash
# Install Xcode Command Line Tools
xcode-select --install

# Install PostgreSQL client (if not using Supabase)
brew install postgresql
```

For Windows

```bash
# Install Windows Build Tools (as Administrator)
npm install --global windows-build-tools

# Or install Visual Studio Build Tools from:
# https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022
```


### 2.4 Dependency Verification

After installation, verify dependencies:

```bash
# Check backend dependencies
cd backend
npm list --depth=0

# Check frontend dependencies
cd frontend
npm list --depth=0

# Verify Prisma installation
npx prisma --version
```

## 3. Download Instructions

### 3.1 Option 1: Git Clone (Recommended for Developers)

```bash
# Clone the repository
git clone https://github.com/phewee12/Team-6139---AI-Career-Pods.git

# Navigate into the project
cd Team-6139---AI-Career-Pods

# Verify the clone was successful
ls -la
# Should show: backend/ frontend/ package.json README.md
```

### 3.2 Option 2: Download ZIP (Recommended for End Users)

1. Open your web browser

2. Navigate to: https://github.com/phewee12/Team-6139---AI-Career-Pods

3. Click the green "Code" button (top right of file list)

4. Select "Download ZIP" from the dropdown menu

5. Save the ZIP file to your computer (e.g., Downloads folder)

6. Extract the ZIP file:

Windows: Right-click → "Extract All"

macOS: Double-click the ZIP file

Linux: unzip Team-6139---AI-Career-Pods-main.zip

7. Navigate into the extracted folder:

```bash
cd Team-6139---AI-Career-Pods-main
```

### 3.3 Option 3: Package Manager (Development Only)

```bash
# Using GitHub CLI (if installed)
gh repo clone phewee12/Team-6139---AI-Career-Pods

# Using Git with SSH (if you have SSH keys configured)
git clone git@github.com:phewee12/Team-6139---AI-Career-Pods.git
```

### 3.4 Download Verification

After download, verify you have all required files:

```bash
# Check project structure
ls -R | grep -E "package.json|.env.example|prisma"

# Expected output:
# backend/package.json
# backend/.env.example
# backend/prisma/schema.prisma
# frontend/package.json
# frontend/.env.example
# package.json
```

### 3.5 File Structure After Download

Team-6139---AI-Career-Pods/
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── middleware/
│   │   ├── lib/
│   │   ├── utils/
│   │   ├── validation/
│   │   └── jobs/
│   ├── prisma/
│   │   └── schema.prisma
│   ├── migrations/
│   ├── tests/
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── api/
│   │   ├── hooks/
│   │   ├── constants/
│   │   └── lib/
│   ├── public/
│   ├── package.json
│   └── .env.example
├── package.json
└── README.md

## 4. Build Instructions

### 4.1 Overview

Since you have the source code (not a pre-built binary), you must build the application before running it. Building consists of:

1. Installing dependencies

2. Configuring environment variables

3. Setting up the database

4. Compiling the frontend (for production)

### 4.2 Step 1: Install Dependencies 

```bash 
# From the project root directory
npm install

# This may take 2-5 minutes depending on internet speed
# Expected output: "added X packages in Xs"
```

### 4.3 Step 2: Configuew Environment Variables

#### 4.3.1 Backend Configuration

Copy the example file and edit it:

```bash
cd backend
cp .env.example .env
nano .env  # or use vim, code, or any text editor
```
Required changes to backend/.env:

```bash
# REQUIRED - DO NOT SKIP

# Database (from Supabase - see Section 1.3.1)
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@aws-0-us-east-1.pooler.supabase.com:5432/postgres
# ↑ Replace YOUR_PASSWORD with your Supabase database password

# JWT Secret (generate with command in Section 4.3.3)
JWT_SECRET=replace-with-64-byte-random-string

# Supabase (from your Supabase project)
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
# ↑ Find these in Supabase Dashboard → Settings → API

# Gemini AI (from Section 1.3.2)
GEMINI_API_KEY=your-gemini-api-key

# OPTIONAL - Can skip for basic functionality

# Google OAuth (skip if not using Google login)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# DEVELOPMENT ONLY - Leave as-is for now

PORT=4000
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:5173
SERVER_ORIGIN=http://localhost:4000
JWT_EXPIRES_IN=7d
AUTH_COOKIE_NAME=careerpods_token
SUPABASE_STORAGE_BUCKET=resume-uploads
```
#### 4.3.2 Frontend Configuration

```bash
cd frontend
cp .env.example .env
nano .env
```

Frontend .env file (no changes needed for development):
```bash 
VITE_API_BASE_URL=http://localhost:4000/api
VITE_SERVER_URL=http://localhost:4000
```

#### 4.3.3 Generate JWT Secret

Run this command to generate a secure random secret:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Copy the entire string output and paste it as the value for JWT_SECRET in backend/.env.

### 4.4 Step 3: Database Setup

#### 4.4.1 Verify Supabase is Ready

```bash
# Test connection to Supabase
npx prisma db execute --stdin --schema=backend/prisma/schema.prisma <<< "SELECT 1"
# Expected output: "Command executed successfully"
```

#### 4.4.2 Run Database Migrations

```bash 
cd backend

# Apply all migrations to create tables
npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate

cd ..
```

#### 4.4.3 Seed Default Data (Optional)

The database is automatically seeded with 3 default pods:

```bash 
cd backend
npx prisma db seed
cd ..
```

Default Pods Created:
1. Internship Accelerator
2. Grad School Strategy
3. Career Switch Lab

### 4.5 Step 4: Setup Supabase Storage

1. Open Supabase Dashboard: https://app.supabase.com

2. Select your project

3. Click Storage in left sidebar

4. Click "Create a new bucket"

5. Configure:

Name: resume-uploads

Public bucket: OFF (toggle to private)

Allowed MIME types: application/pdf

File size limit: 10 MB

6. Click "Save"

### 4.6 Steps 5: Build Frontend (Production Only)

Skip this step for development. For production deployment:

```bash 
# Build optimized production bundle
npm run build --workspace frontend

# Verify build output
ls frontend/dist/
# Expected: index.html, assets/
```
Build output size:

Main bundle: ~500 KB (gzipped)

Total assets: ~2 MB

### 4.7 Build Verification

Run these checks to confirm build succeeded:

```bash
# Check backend dependencies
cd backend
npm list --depth=0 | grep -E "@prisma/client|express"
# Should show both packages

# Check Prisma client generation
ls node_modules/@prisma/client
# Should show: index.js, runtime/, etc.

# Check frontend build (if production build)
cd frontend
ls dist/
# Should show: index.html, assets/

cd ../..
```

## 5. Installation of Actual Application

### 5.1 Development Installation

No installation needed - the application runs directly from source code.

Directory requirements:
Backend code must remain in backend/ folder

Frontend code must remain in frontend/ folder

Node.js must be installed (see Section 1.2)

Environment files must be in place (see Section 4.3)

### 5.2 Production Installation

#### 5.2.1 Backend Installation

Step 1: Install PM2 Process Manager
```bash
npm install -g pm2
```

Step 2: Create Backend Service Directory
```bash
# Create application directory
sudo mkdir -p /opt/qwyse
sudo cp -r backend /opt/qwyse/
sudo cp -r frontend/dist /opt/qwyse/public
```

Step 3: Configure Production Environment
```bash
cd /opt/qwyse/backend

# Create production .env file
cat > .env << 'EOF'
PORT=4000
NODE_ENV=production
CLIENT_ORIGIN=https://yourdomain.com
SERVER_ORIGIN=https://api.yourdomain.com

DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@pooler.supabase.com:5432/postgres
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
AUTH_COOKIE_NAME=careerpods_token

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-key
SUPABASE_STORAGE_BUCKET=resume-uploads

GEMINI_API_KEY=your-gemini-key
EOF

# Set proper permissions
chmod 600 .env
```

Step 4: Start Backend with PM2
```bash
pm2 start src/server.js --name qwyse-backend
pm2 save
pm2 startup
# Copy and run the command that appears
```

#### 5.2.1 Frontend Installation (Nginx)

Step 1: Install Nginx
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nginx -y

# CentOS/RHEL
sudo yum install nginx -y

# macOS
brew install nginx
```

Step 2: Configure Nginx
```bash
sudo nano /etc/nginx/sites-available/qwyse
```

Step 3: Enable the Site
```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/qwyse /etc/nginx/sites-enabled/

# Remove default site (if exists)
sudo rm -f /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t
# Expected: "syntax is ok" and "test is successful"

# Restart Nginx
sudo systemctl restart nginx
```

Step 4: Configure Firewall
```bash
# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload
```

### 5.3 Directory Structure After Installation
/opt/qwyse/
├── backend/
│   ├── src/
│   ├── prisma/
│   ├── node_modules/
│   ├── .env
│   └── package.json
├── public/
│   ├── index.html
│   └── assets/
└── logs/                    (created by PM2)
    └── qwyse-backend.log

### 5.4 Installation Verification

```bash
# Check backend is running
pm2 status
# Should show "qwyse-backend" with status "online"

# Check Nginx is running
sudo systemctl status nginx
# Should show "active (running)"

# Test API endpoint
curl http://localhost:4000/api/health
# Expected: {"status":"ok"}

# Test frontend (via Nginx)
curl http://localhost/health
# Expected: {"status":"ok"}
```

## 6. Run Instructions

### 6.1 Development mode

#### 6.1.1 Starting Application

```bash
# From project root - runs both backend and frontend
npm run dev
```

OR run separately in two terminals:

Terminal 1 - Backend:
```bash
cd backend
npm run dev
# Output: "Backend listening on port 4000"
```

Terminal 2 - Frontend:
```bash
cd frontend
npm run dev
# Output: "VITE v6.0.0 ready in XXX ms"
```

#### 6.1.2 Access URLs

| Component | URL | Purpose |
|-------------|-------------|------------|
| Frontend Application | http://localhost:5173 | User interface |
| Backend API | http://localhost:4000 | API endpoints |
| Health Check | http://localhost:4000/api/health | Status check |
| Prisma Studio | http://localhost:5555 | Database viewer (optional, run npx prisma studio) |

#### 6.1.3 Stopping the Application

```bash
# If running with npm run dev (both)
Press Ctrl + C

# If running separately
# Terminal 1: Ctrl + C
# Terminal 2: Ctrl + C

# Force kill if needed (Linux/Mac)
lsof -ti:4000 | xargs kill -9
lsof -ti:5173 | xargs kill -9
```

### 6.2 Production Mode

#### 6.2.1 Starting the Application

```bash
# Start backend
pm2 start qwyse-backend

# Check status
pm2 status

# View logs
pm2 logs qwyse-backend
```

#### 6.2.2 Access URLs

| Component | URL | Purpose |
|-------------|-------------|------------|
| Frontend | http://yourdomain.com | User interface |
| Backend API | http://yourdomain.com | API endpoints |
| Health Check | http://yourdomain.com/health | Status check |

#### 6.2.3 Managing Production Services

```bash
# Stop backend
pm2 stop qwyse-backend

# Restart backend
pm2 restart qwyse-backend

# Reload with zero downtime
pm2 reload qwyse-backend

# Delete from PM2
pm2 delete qwyse-backend

# Monitor resources
pm2 monit

# View detailed logs
pm2 logs qwyse-backend --lines 100

# Save PM2 configuration
pm2 save

# Nginx management
sudo systemctl start nginx
sudo systemctl stop nginx
sudo systemctl restart nginx
sudo systemctl reload nginx
```

### 6.3 First-Time User Setup (After Running)

Once the application is running, complete these steps as an end user:

Step 1: Register an Account
1. Open browser to http://localhost:5173 (or your domain)

2. Click the "Register" tab

3. Fill in:

Full name: Your name (e.g., "John Smith")

Email: Your email address (e.g., "john@example.com")

Password: Minimum 8 characters

4. Click "Create account"

Step 2: Complete Your Profile
1. After registration, you'll be redirected to profile setup

2. Select:

Field of study (e.g., "Computer Science")

Career stage (Freshman/Sophomore/Junior/Senior/Graduate/Career Switcher)

Target timeline (3/6/12/18+ months)

3. (Optional) Upload a profile picture

4. Click "Complete setup"

Step 3: Join Your First Pod
1. Click "Groups" in the left sidebar

2. Browse available pods:

Internship Accelerator - For internship seekers

Grad School Strategy - For graduate admissions

Career Switch Lab - For career changers

3. Click "Join Group" on any pod

4. Read the 5 pod guidelines

5. Check the acknowledgment checkbox

6. Write an introduction message (e.g., "Hi everyone! Excited to join")

7. Click "Complete Onboarding"

Step 4: Create Your First Post
1. In your joined pod, click "Open Group Features"

2. Click the "Feed" tab

3. Write a post (e.g., "Excited to start this journey!")

4. Click "Create Post"

5. Verify your post appears in the feed

Step 5: Test Resume Review (Optional)
1. In the group, click "Resume Review" tab

2. Click "Create Resume Review Request"

3. Fill in:

Title: e.g., "SWE Internship Resume"

Target role: (optional)

Context: (optional)

4. Upload a PDF resume (max 10MB)

5. Click "Create Resume Review"

6. Ask a teammate to submit feedback, or create a second account to test

### 6.4 Running Verification Checklist

Backend API responds: curl http://localhost:4000/api/health → {"status":"ok"}

Frontend loads: Open http://localhost:5173 → See login page

Registration works: Create test account successfully

Login works: Log in with test account

Profile saves: Complete profile, see dashboard

Pods load: Groups page shows 3 default pods

Join works: Join a pod successfully

Posts work: Create and delete a post

Resume upload works: Upload test PDF

## 7. Troubleshooting

### 7.1 Common Installation Errors

| Error Message | Likely Cause | Solution |
|-------------|-------------|------------|
| Error: P1001: Can't reach database server | DATABASE_URL incorrect or Supabase not ready | Verify DATABASE_URL uses port 5432 (pooler). Check Supabase project is active. Wait 2-3 minutes after project creation. |

| Error: Cannot find module '...' | Missing dependencies| Run npm install from project root. If persists, delete node_modules folders and reinstall. |

| Error: listen EADDRINUSE: address already in use :::4000 | Port 4000 already in use | Kill process: lsof -ti:4000 | xargs kill -9 (Mac/Linux) or change PORT in .env |

| Error: write EPIPE | Database connection lost | Kill process: lsof -ti:4000 | Restart database: In Supabase, go to Database → Restart. Run migrations again. |

| Error: PrismaClientInitializationError | Prisma client not generated | Run npx prisma generate in backend directory |

| Error: Migration directory not found | Migrations missing | Run npx prisma migrate dev to create migrations |

| Error: Cannot read property 'storage' of undefined | Supabase not configured | Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env |

| Error: 403 Forbidden - storage/object-not-found | Storage bucket doesn't exist | Create resume-uploads bucket in Supabase Storage (see Section 4.5) |

### 7.2 Database Troublshooting

Test Database Connection
```bash
cd backend
npx prisma db execute --stdin <<< "SELECT 1"
```

Reset Database (Deletes ALL data)
```bash
cd backend
npx prisma migrate reset --force
npx prisma migrate deploy
npx prisma generate
```

View Database Schema
```bash
cd backend
npx prisma studio
# Opens http://localhost:5555
```

Fix Migration Conflicts
```bash 
cd backend
npx prisma migrate resolve --rolled-back "migration_name"
npx prisma migrate deploy
```

### 7.3 Authentication Troubleshooting

Issue: "Invalid email or password" but credentials are correct
Solutions:

1. Check if user exists: npx prisma studio → User table

2. Verify password was hashed correctly

3. Try resetting password via registration (new account)

Issue: Cookie not being set in browser
Solutions:

1. Ensure using http://localhost not file://

2. Check browser cookie settings (not blocked)

3. Verify CLIENT_ORIGIN matches frontend URL

4. Clear browser cookies and cache

Issue: Google OAuth returns "invalid_client"
Solutions:

1. Verify GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env

2. Check redirect URI matches exactly: http://localhost:4000/api/auth/google/callback

3. Ensure Google+ API and People API are enabled

### 7.4 File Upload Troubleshooting

Issue: Resume upload fails with "File is empty"
Solutions:

1. Verify PDF is not corrupted

2. Check file size (must be <10MB)

3. Ensure file is not password-protected

Issue: "Signed URL expired" for PDF viewing
Solutions:

1. Refresh the page to generate new URL

2. Increase expiration in podRoutes.js (line with expiresInSeconds)

### 7.5 AI Feature Troubleshooting

Issue: "Failed to generate AI suggestions"
Solutions:

1. Check GEMINI_API_KEY in .env

2. Verify API key has Gemini API access

3. Check Google Cloud billing is enabled (even for free tier)

4. Test API key:
```bash
curl -X POST -H "Content-Type: application/json" -d '{"contents":[{"parts":[{"text":"Hello"}]}]}' "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=YOUR_KEY"
```
Issue: AI summary generation timeout
Solutions:

1. Reduce amount of content in the period

2. Split pod activity across multiple periods

3. Increase timeout in biweeklySummaryService.js

### 7.6 Performance Issues

Slow Page Loads
```bash
# Check backend response time
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:4000/api/health

# Create curl-format.txt:
# time_namelookup:  %{time_namelookup}s\n
# time_connect:     %{time_connect}s\n
# time_total:       %{time_total}s\n
```

Solutions:

1. Increase Node.js memory: node --max-old-space-size=2048 src/server.js

2. Enable production mode: NODE_ENV=production

3. Use PM2 cluster mode: pm2 start src/server.js -i max

High Memory Usage
```bash 
# Check PM2 memory usage
pm2 monit

# Restart with memory limit
pm2 restart qwyse-backend --max-memory-restart 500M
```

### 7.7 Logging and Debugging

Backend Logs
```bash
# Development - console output
cd backend && npm run dev

# Production - PM2 logs
pm2 logs qwyse-backend
pm2 logs qwyse-backend --lines 100
pm2 logs qwyse-backend --err

# Write logs to file
pm2 logs qwyse-backend > /var/log/qwyse-backend.log
```

Frontend Debugging
1. Open browser DevTools (F12)

2. Console tab: Check for JavaScript errors

3. Network tab: Verify API requests:

Status codes should be 200, 201, 401, 403, 404

500 errors indicate backend issues

4. Application tab:

Cookies: Look for careerpods_token

Storage: Check sessionStorage for cached data

5. Sources tab: Set breakpoints in React components

Database Queries
```bash
# Enable query logging
cd backend
npx prisma studio --port 5555

# Or add to .env:
PRISMA_DEBUG=true
```

### 7.8 Getting Help

Self-Help Resources

| Requirement | Production |
|-------------|-------------|
| Project README | cat README.md |
| API Documentation | http://localhost:4000/api/health |
| Database Schema | backend/prisma/schema.prisma |
| Supabase Docs | https://supabase.com/docs |
| Prisma Docs | https://www.prisma.io/docs |
| Gemini API Docs | https://ai.google.dev/docs |

### 7.9 Quick Recovery Commands

```bash
# Complete reinstall (keeps environment files)
rm -rf node_modules backend/node_modules frontend/node_modules
npm install

# Reset everything (DELETES ALL DATA)
cd backend
npx prisma migrate reset --force
npx prisma migrate deploy
npx prisma generate
cd ..

# Restart all services
pm2 restart qwyse-backend
sudo systemctl restart nginx

# Full application restart (development)
# Stop with Ctrl+C, then:
npm run dev
```






