# GuardNet : Plateforme de Supervision et d'Analyse d'Anomalies Réseau

## Résumé Exécutif

GuardNet est une plateforme de supervision réseau et de détection d'anomalies intégrant des techniques d'apprentissage automatique. Ce système permet la supervision en temps réel des équipements d'un réseau local, l'analyse des données de monitoring via des modèles d'apprentissage statistique et la génération automatisée d'alertes selon des critères comportementaux. Cette application a été développée dans le cadre d'un projet académique.

---

## Table des Matières

1. [Architecture Générale](#architecture-générale)
2. [Prérequis Système](#prérequis-système)
3. [Installation et Configuration](#installation-et-configuration)
4. [Compilation et Exécution](#compilation-et-exécution)
5. [Structure du Code Source](#structure-du-code-source)
6. [Descriptions Techniques des Modules](#descriptions-techniques-des-modules)
7. [Guide de Dépannage](#guide-de-dépannage)

---

## Architecture Générale

GuardNet suit une architecture trois tiers :

- **Couche Présentation** : Frontend Angular 21 avec interface responsive (Tailwind CSS)
- **Couche Métier** : API REST FastAPI (Python 3.10+) avec modèles de données relationnels
- **Couche Persistance** : Base de données PostgreSQL 14+

### Stack Technologique

| Composant | Technologie | Version |
|-----------|-------------|---------|
| Frontend | Angular | 21.2.0 |
| Backend | FastAPI | 0.135.3 |
| Runtime Backend | Python | 3.10+ |
| Runtime Frontend | Node.js | 20+ |
| Base de Données | PostgreSQL | 14+ |
| ORM | SQLAlchemy | 2.0.49 |
| Validation | Pydantic | 2.12.5 |

---

## Prérequis Système

### Logiciels Obligatoires

1. **Python 3.10 ou ultérieur**
   - Télécharger depuis : https://www.python.org/downloads/
   - Vérifier : `python --version`

2. **Node.js 20.x et npm 10.9.2+**
   - Télécharger depuis : https://nodejs.org/
   - Vérifier : `node --version` et `npm --version`

3. **PostgreSQL 14 ou ultérieur**
   - Télécharger depuis : https://www.postgresql.org/download/
   - Vérifier : `psql --version`
   - Alternative : Utiliser Docker (voir section Docker)

4. **Git 2.30+**
   - Télécharger depuis : https://git-scm.com/downloads/
   - Vérifier : `git --version`

### Dépendances Optionnelles

- **Docker** : Pour conteneuriser PostgreSQL
- **Postman** : Pour tester les endpoints API

---

## Installation et Configuration

### Étape 1 : Cloner le Dépôt

```bash
git clone https://github.com/NourAlaounia14/GurdnetPfa.git
cd GurdnetPfa
```

### Étape 2 : Configurer la Base de Données

#### Option A : Installation PostgreSQL Locale

```bash
# Créer la base de données
createdb guardnet_db

# Vérifier la connexion
psql -d guardnet_db -c "SELECT version();"
```

#### Option B : Utiliser Docker

```bash
# Créer et démarrer un conteneur PostgreSQL
docker run --name guardnet-postgres \
  -e POSTGRES_DB=guardnet_db \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  -d postgres:14

# Vérifier
docker ps
```

### Étape 3 : Installer et Configurer le Backend

```bash
cd backend

# Créer l'environnement virtuel Python
python -m venv venv

# Activer l'environnement virtuel
# Windows :
venv\Scripts\activate
# Linux/macOS :
source venv/bin/activate

# Installer les dépendances
pip install -r requirements.txt
```

### Étape 4 : Configurer les Variables d'Environnement Backend

Créer un fichier `.env` à la racine du dossier `backend/` :

```env
# Base de Données
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/guardnet_db

# Sécurité - JWT
SECRET_KEY=your_secret_key_change_in_production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Serveur
API_HOST=0.0.0.0
API_PORT=8000
DEBUG=False

# Configuration Email (optionnel)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SENDER_EMAIL=your_email@example.com
SENDER_PASSWORD=your_app_password
```

### Étape 5 : Initialiser la Base de Données

```bash
# À partir du dossier backend/ avec l'environnement virtuel activé
python -m alembic upgrade head
```

### Étape 6 : Installer et Configurer le Frontend

```bash
cd frontend/guardnet

# Installer les dépendances npm
npm install

# Vérifier l'installation
npm list
```

---

## Compilation et Exécution

### Exécution en Mode Développement

#### Backend

```bash
cd backend

# Activer l'environnement virtuel
# Windows : venv\Scripts\activate
# Linux/macOS : source venv/bin/activate

# Lancer le serveur de développement FastAPI
python main.py

# Ou avec uvicorn pour plus de contrôle
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Accès** :
- API : `http://localhost:8000`
- Documentation Swagger : `http://localhost:8000/docs`
- Documentation ReDoc : `http://localhost:8000/redoc`

#### Frontend

Dans un nouveau terminal :

```bash
cd frontend/guardnet

# Lancer le serveur de développement Angular
npm start
# Ou : ng serve
```

**Accès** : `http://localhost:4200`

### Exécution en Mode Production

#### Build Frontend

```bash
cd frontend/guardnet

# Générer les fichiers optimisés pour la production
npm run build
# Ou : ng build --configuration production

# Les fichiers générés sont dans : dist/guardnet/
```

#### Build Backend

```bash
cd backend

# Installer gunicorn
pip install gunicorn

# Lancer avec gunicorn (exemple 4 workers)
gunicorn -w 4 -b 0.0.0.0:8000 --timeout 120 main:app
```

---

## Structure du Code Source

```
GurdnetPfa/
├── backend/                          # Module serveur (Python/FastAPI)
│   ├── main.py                      # Point d'entrée de l'application
│   ├── database.py                  # Configuration ORM SQLAlchemy
│   ├── requirements.txt              # Dépendances Python (pip)
│   ├── test_db.py                   # Tests de connexion BD
│   │
│   ├── core/
│   │   └── security.py              # Fonctions d'authentification JWT
│   │
│   ├── dependencies/
│   │   └── auth.py                  # Dépendances FastAPI (auth)
│   │
│   ├── models/
│   │   ├── __init__.py
│   │   └── models.py                # Modèles SQLAlchemy (entités BD)
│   │
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── scan.py                  # Schémas Pydantic (requêtes/réponses scan)
│   │   └── user.py                  # Schémas Pydantic (user)
│   │
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── auth.py                  # Endpoints authentification
│   │   ├── scan.py                  # Endpoints scan réseau
│   │   ├── alerts.py                # Endpoints alertes
│   │   ├── anomaly.py               # Endpoints anomalies
│   │   ├── monitoring.py            # Endpoints monitoring
│   │   ├── settings.py              # Endpoints configuration
│   │   └── users.py                 # Endpoints utilisateurs
│   │
│   ├── services/
│   │   ├── __init__.py
│   │   ├── scanner.py               # Logique scanner (nmap)
│   │   ├── alerts_service.py        # Logique génération alertes
│   │   ├── monitoring_service.py    # Logique monitoring (psutil, snmp)
│   │   ├── auth_service.py          # Logique authentification
│   │   ├── demo_seed.py             # Script de peuplement BD
│   │   └── scan_db.json             # Cache scans réseau
│   │
│   ├── ia/
│   │   ├── __init__.py
│   │   ├── train.py                 # Entraînement modèle Isolation Forest
│   │   └── predict.py               # Inférence modèle (détection anomalies)
│   │
│   └── tmp/                         # Fichiers temporaires (logs, caches)
│
├── frontend/guardnet/               # Module client (Angular 21)
│   ├── package.json                # Dépendances npm
│   ├── angular.json                # Configuration Angular CLI
│   ├── tailwind.config.js           # Configuration Tailwind CSS
│   ├── tsconfig.json               # Configuration TypeScript
│   │
│   └── src/
│       ├── index.html              # Point d'entrée HTML
│       ├── main.ts                 # Bootstrap application
│       ├── main.server.ts          # SSR bootstrap
│       ├── server.ts               # Serveur Express (SSR optionnel)
│       ├── styles.css              # Styles globaux
│       │
│       └── app/
│           ├── app.ts              # Root component
│           ├── app.html            # Root template
│           ├── app.routes.ts       # Définition des routes
│           ├── app.config.ts       # Configuration Angular
│           │
│           ├── pages/              # Composants de pages
│           │   ├── login/          # Page authentification
│           │   ├── dashboard/      # Page tableau de bord
│           │   ├── scan/           # Page scan réseau
│           │   ├── alertes/        # Page alertes
│           │   ├── anomalies/      # Page anomalies détectées
│           │   ├── network/        # Page visualisation réseau
│           │   └── profil/         # Page profil utilisateur
│           │
│           ├── components/         # Composants réutilisables
│           │   ├── sidebar/        # Barre de navigation
│           │   └── network-map/    # Visualisation réseau interactive
│           │
│           └── services/           # Services Angular
│               ├── auth.ts         # Service authentification
│               ├── monitoring.ts   # Service monitoring/alertes
│               └── seed.data.ts    # Données de démonstration
│
├── README.md                        # Ce fichier
└── RAPPORT_FONCTIONNALITES.md       # Documentation fonctionnelle détaillée
```

---

## Descriptions Techniques des Modules

### Module IA : Détection d'Anomalies

**Localisation** : `backend/ia/`

Le module IA utilise un modèle **Isolation Forest** pour détecter les anomalies comportementales du réseau.

#### Entraînement (`train.py`)
- Collecte les données historiques de monitoring
- Normalise les features : latence, CPU, RAM, nombre de ports, nombre de nouveaux appareils
- Entraîne le modèle Isolation Forest
- Sauvegarde le modèle sérialisé

#### Inférence (`predict.py`)
- Charge le modèle entraîné
- Effectue les prédictions sur les données récentes
- Génère automatiquement des alertes pour les anomalies détectées
- Horodatage : heure de la journée incluse comme feature

### Module Scanner Réseau

**Localisation** : `backend/services/scanner.py`

Effectue des scans réseau utilisant **nmap** :
- Scan rapide (SYN) : détection des machines actives
- Scan complet (full port + OS detection)
- Extraction des informations : adresses IP, hostnames, OS, ports ouverts
- Comparaison avec scans antérieurs pour détecter les changements
- Export des résultats en CSV

### Module Monitoring

**Localisation** : `backend/services/monitoring_service.py`

Collecte les métriques des équipements :
- **Locales** : CPU (%), RAM (%), processus
- **Distantes** : SNMP (si configuré), ping (latence)
- **Historique** : Conservation des données pour l'analyse temporelle
- **Alertes** : Génération automatique basée sur seuils

---

## Guide de Dépannage

### Problème : Impossible de se connecter à PostgreSQL

**Causes possibles** :
- PostgreSQL n'est pas en cours d'exécution
- URL de connexion incorrecte dans `.env`
- Authentification non configurée

**Solutions** :
```bash
# Vérifier que PostgreSQL fonctionne
psql -U postgres -c "SELECT version();"

# Ou avec Docker
docker ps  # Vérifier que le conteneur s'exécute

# Tester la connexion
psql -h localhost -U postgres -d guardnet_db
```

### Problème : Port déjà en utilisation

**Cause** : Une autre application utilise le port 8000 ou 4200

**Solution** :
```bash
# Backend sur port 8001
uvicorn main:app --port 8001

# Frontend sur port 4201
ng serve --port 4201
```

### Problème : Module Python non trouvé

**Cause** : L'environnement virtuel n'est pas activé ou les dépendances ne sont pas installées

**Solution** :
```bash
# Activer l'environnement virtuel
source venv/bin/activate  # Linux/macOS
# Ou : venv\Scripts\activate  # Windows

# Réinstaller les dépendances
pip install --upgrade -r requirements.txt
```

### Problème : Erreurs d'importation Node.js

**Cause** : Dépendances npm non installées ou corrompues

**Solution** :
```bash
cd frontend/guardnet

# Nettoyer les caches
npm cache clean --force
rm -rf node_modules package-lock.json

# Réinstaller
npm install
```

### Problème : Modèle IA non trouvé

**Cause** : Le modèle Isolation Forest n'a pas été entraîné

**Solution** :
```bash
cd backend
python ia/train.py
```

---

## Références et Documentation

- [FastAPI Official Docs](https://fastapi.tiangolo.com/)
- [Angular Official Docs](https://angular.io/docs)
- [SQLAlchemy ORM](https://docs.sqlalchemy.org/)
- [Pydantic Validation](https://docs.pydantic.dev/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

---

## Auteurs et Contexte Académique

**Projet** : GuardNet  
**Contexte** : Projet académique PFA (Projet de Fin d'Année)  
**Date** : Mai 2026  
**Repository** : https://github.com/NourAlaounia14/GurdnetPfa  
**Branche Active** : `feature/abir-j7-j10`

---

## Licence

Ce projet est développé à titre académique. Tous les droits sont réservés.
