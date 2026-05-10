# GuardNet - Plateforme d'Administration et de Supervision Réseau

GuardNet est une plateforme complète d'administration et de supervision d'un réseau local. Elle permet aux administrateurs de surveiller les machines du réseau, lancer des scans, consulter les alertes, visualiser la carte réseau, analyser les anomalies par IA et générer des rapports.

## 📋 Table des matières

- [Prérequis](#prérequis)
- [Installation](#installation)
- [Configuration](#configuration)
- [Compilation et Démarrage](#compilation-et-démarrage)
- [Structure du Projet](#structure-du-projet)
- [Fonctionnalités Principales](#fonctionnalités-principales)

## 🔧 Prérequis

Avant de commencer, assurez-vous d'avoir les éléments suivants installés sur votre machine :

- **Python 3.10+** - [Télécharger](https://www.python.org/downloads/)
- **Node.js 20+** - [Télécharger](https://nodejs.org/)
- **npm 10.9.2+** - Livré avec Node.js
- **PostgreSQL 14+** - [Télécharger](https://www.postgresql.org/download/) (ou utiliser Docker)
- **Git** - [Télécharger](https://git-scm.com/downloads)

### Vérifier les installations

```bash
python --version
node --version
npm --version
psql --version
```

## 📦 Installation

### 1. Cloner le Répertoire

```bash
git clone https://github.com/NourAlaounia14/GurdnetPfa.git
cd GurdnetPfa
```

### 2. Configuration de la Base de Données PostgreSQL

#### Option A : Installation Locale
```bash
# Créer une base de données PostgreSQL
createdb guardnet_db

# Se connecter à la base (optionnel pour vérifier)
psql -d guardnet_db
```

#### Option B : Utiliser Docker
```bash
docker run --name guardnet-postgres -e POSTGRES_DB=guardnet_db -e POSTGRES_PASSWORD=your_password -p 5432:5432 -d postgres:14
```

### 3. Installation du Backend

```bash
cd backend

# Créer un environnement virtuel Python
python -m venv venv

# Activer l'environnement virtuel
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Installer les dépendances
pip install -r requirements.txt
```

### 4. Installation du Frontend

```bash
cd frontend/guardnet

# Installer les dépendances npm
npm install
```

## ⚙️ Configuration

### Variables d'Environnement Backend

Créer un fichier `.env` à la racine du dossier `backend/` :

```env
# Base de Données
DATABASE_URL=postgresql://user:password@localhost:5432/guardnet_db

# Sécurité
SECRET_KEY=your_secret_key_here
ALGORITHM=HS256

# API
API_PORT=8000
API_HOST=0.0.0.0

# Authentification
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Email (optionnel)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SENDER_EMAIL=your_email@gmail.com
SENDER_PASSWORD=your_app_password
```

### Variables d'Environnement Frontend

Créer un fichier `environment.ts` dans `frontend/guardnet/src/` si nécessaire :

```typescript
export const environment = {
  apiUrl: 'http://localhost:8000',
  production: false
};
```

## 🚀 Compilation et Démarrage

### Démarrer le Backend

```bash
cd backend

# Activer l'environnement virtuel (si pas déjà activé)
# Windows: venv\Scripts\activate
# macOS/Linux: source venv/bin/activate

# Initialiser la base de données (première fois)
python -m alembic upgrade head

# Démarrer le serveur FastAPI
python main.py

# Ou utiliser uvicorn directement
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Le backend sera accessible à : `http://localhost:8000`
Documentation API Swagger : `http://localhost:8000/docs`

### Démarrer le Frontend

Dans une nouvelle fenêtre de terminal :

```bash
cd frontend/guardnet

# Mode développement
npm start
# Ou
ng serve

# L'application sera accessible à : http://localhost:4200
```

### Build pour Production

#### Frontend
```bash
cd frontend/guardnet

# Build de production
npm run build
# Ou
ng build --configuration production

# Les fichiers générés seront dans dist/guardnet/
```

#### Backend
```bash
cd backend

# Créer une build de production
python -m pip install gunicorn

# Démarrer avec gunicorn
gunicorn -w 4 -b 0.0.0.0:8000 main:app
```

## 📂 Structure du Projet

```
GurdnetPfa/
├── backend/                          # API Backend (Python/FastAPI)
│   ├── main.py                      # Point d'entrée de l'application
│   ├── requirements.txt              # Dépendances Python
│   ├── database.py                  # Configuration de la BD
│   ├── core/                        # Configuration centrale
│   ├── models/                      # Modèles SQLAlchemy
│   ├── schemas/                     # Schémas Pydantic
│   ├── routers/                     # Routes API
│   ├── services/                    # Logique métier
│   ├── ia/                          # Module IA (Isolation Forest)
│   └── dependencies/                # Dépendances FastAPI
│
├── frontend/guardnet/               # Frontend Angular
│   ├── src/
│   │   ├── index.html              # Fichier HTML principal
│   │   ├── main.ts                 # Point d'entrée TypeScript
│   │   ├── app/
│   │   │   ├── app.routes.ts       # Routes
│   │   │   ├── pages/              # Pages de l'application
│   │   │   ├── components/         # Composants réutilisables
│   │   │   └── services/           # Services (appels API, auth)
│   │   └── styles.css              # Styles globaux
│   ├── package.json                # Dépendances npm
│   ├── angular.json                # Configuration Angular
│   └── tailwind.config.js           # Configuration Tailwind CSS
│
└── RAPPORT_FONCTIONNALITES.md       # Documentation des fonctionnalités
```

## ✨ Fonctionnalités Principales

### 🔐 Authentification
- Connexion sécurisée avec JWT
- Gestion des profils administrateur

### 📊 Dashboard
- Vue d'ensemble du réseau
- Statistiques en temps réel (nombre de machines, CPU moyen, RAM moyenne, latence)
- Machines actives et indisponibles

### 🔍 Scan Réseau
- Scan rapide ou complet
- Détection des machines et ports ouverts
- Export en CSV
- Historique des scans

### 🚨 Alertes
- Génération automatique d'alertes
- Filtrage par type, sévérité, statut et IP
- Résolution manuelle des alertes
- Types : nouvel appareil, changement de port, indisponibilité, latence élevée, etc.

### 🗺️ Carte Réseau
- Visualisation des machines sous forme de noeuds
- Informations détaillées par machine
- Raccourcis vers alertes et scans

### 🤖 Détection IA des Anomalies
- Modèle Isolation Forest
- Analyse combinée : latence, CPU, RAM, ports ouverts
- Génération automatique d'alertes d'anomalies
- Historique des prédictions

### 📋 Monitoring
- Suivi en temps réel des machines
- Inventaire et métriques (CPU, RAM, latence)
- Détection automatique de changements

## 🔐 Commandes Utiles

```bash
# Tests Backend
python -m pytest

# Tests Frontend
npm run test

# Linting Backend
flake8 backend/

# Linting Frontend
npm run lint

# Formater le code
black backend/
prettier --write frontend/guardnet/src/

# Voir les logs
# Backend: Vérifier la sortie de la console uvicorn
# Frontend: Ouvrir les DevTools du navigateur (F12)
```

## 🐛 Dépannage

### Erreur de connexion à PostgreSQL
```
Vérifier que PostgreSQL est en cours d'exécution
Vérifier les credentials dans le fichier .env
Vérifier l'existence de la base de données guardnet_db
```

### Port déjà en utilisation
```bash
# Changer le port
# Backend: uvicorn main:app --port 8001
# Frontend: ng serve --port 4201
```

### Problèmes d'importation Python
```bash
# Réinstaller les dépendances
pip install --upgrade -r requirements.txt
```

### Problèmes npm
```bash
# Nettoyer le cache npm
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

## 📞 Support et Contribution

Pour toute question ou problème, veuillez consulter la documentation ou ouvrir une issue sur le dépôt GitHub.

## 📄 Licence

Ce projet est développé à titre académique. Tous les droits sont réservés.

---

**Version du Projet** : 1.0.0  
**Dernière mise à jour** : Mai 2026
