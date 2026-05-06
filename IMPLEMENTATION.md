# GuardNet - Implémentation Frontend + Backend

## 📋 Tâches Complétées

### 1. **Backend - Endpoints API**

#### ✅ GET `/monitoring/network` (Carte Réseau)
- **Localisation**: `backend/routers/monitoring.py`
- **Fonctionnalité**: Retourne la liste des devices avec positions SVG, icônes, statut, et compteur d'alertes
- **Réponse**:
  ```json
  {
    "nodes": [
      {
        "id": 1,
        "ip": "192.168.1.10",
        "hostname": "router-01",
        "device_type": "router",
        "status": "online",
        "icon": "📡",
        "x": 400,
        "y": 300,
        "alert_count": 2,
        "first_seen": "2025-01-15T10:30:00",
        "last_seen": "2025-01-15T15:45:00"
      }
    ],
    "total_devices": 1
  }
  ```

#### ✅ GET `/alerts` (Alertes avec Filtres)
- **Localisation**: `backend/routers/alerts.py`
- **Filtres Disponibles**: `type`, `severity`, `resolved`, `device_id`, `skip`, `limit`
- **Endpoint Bonus**: `/alerts/stats` pour les statistiques
- **Endpoint Bonus**: `PATCH /alerts/{alert_id}/resolve` pour résoudre une alerte

#### ✅ GET `/anomaly/history` (Historique des Anomalies)
- **Localisation**: `backend/routers/anomaly.py`
- **Paramètres**: `skip`, `limit`
- **Endpoint Bonus**: `POST /anomaly/detect` pour déclencher une analyse

---

### 2. **Frontend - Service Angular**

#### ✅ `MonitoringService` Étendu
- **Localisation**: `frontend/guardnet/src/app/services/monitoring.ts`
- **Nouvelles Méthodes**:
  - `getNetworkMap()` - Récupère la carte réseau
  - `getAlerts(filters)` - Récupère les alertes avec filtres
  - `getAlertStats()` - Récupère les statistiques des alertes
  - `resolveAlert(alertId)` - Résout une alerte
  - `getAnomalyHistory(skip, limit)` - Récupère l'historique des anomalies
  - `detectAnomaly()` - Déclenche une détection d'anomalie

---

### 3. **Frontend - Composants**

#### ✅ **Carte Réseau** (`NetworkMapComponent`)
- **Localisation**: `frontend/guardnet/src/app/components/network-map/`
- **Fonctionnalités**:
  - Visualisation SVG des nœuds du réseau en cercle
  - Icônes dynamiques selon le type d'appareil (router, server, switch, pc, etc.)
  - Codes couleur par statut (vert = en ligne, rouge = hors ligne, gris = inconnu)
  - Badge d'alertes actives (rouge) sur chaque nœud
  - Panneau latéral au clic sur un nœud avec détails complets
  - Tooltip au survol avec informations rapides
  - Rafraîchissement automatique chaque 30 secondes
  - Connexions visuelles (lignes) entre les nœuds et le centre

#### ✅ **Page Alertes** (`Alertes Component`)
- **Localisation**: `frontend/guardnet/src/app/pages/alertes/`
- **Fonctionnalités**:
  - Tableau complet avec colonnes: Type, Sévérité, Message, Date, Statut, Action
  - Filtres pour: Type d'alerte, Sévérité, Statut (résolue/non résolue)
  - Bouton "Résoudre" (✓) pour chaque alerte non résolue
  - Codes couleur de sévérité (critique, élevée, moyenne, faible)
  - Icônes pour chaque type d'alerte
  - Pagination automatique (10 alertes par page)
  - Compteurs dans l'en-tête (actives, total)
  - Rafraîchissement automatique chaque 30 secondes
  - État "vide" avec message quand aucune alerte

#### ✅ **Page Anomalies** (`Anomalies Component`)
- **Localisation**: `frontend/guardnet/src/app/pages/anomalies/`
- **Fonctionnalités**:
  - Bouton "Analyser maintenant" (🔍) pour déclencher l'IA
  - Graphique BarChart des scores historiques en Canvas
  - Ligne de seuil d'anomalie (en pointillés orange)
  - Affichage du résultat de la dernière analyse
  - Statistiques: Anomalies détectées, Score moyen, Points d'historique
  - Tableau complet avec colonnes: Temps, Score, Statut, CPU%, RAM%, Latence
  - Cartes d'anomalies récentes avec détails des features
  - Légende du graphique
  - États de chargement et d'erreur

---

### 4. **Intégration aux Routes**

#### ✅ Routes Mises à Jour
- **Localisation**: `frontend/guardnet/src/app/app.routes.ts`
- **Nouvelle Route**: `/network` → `NetworkComponent` (page carte réseau)
- **Routes Existantes Utilisées**: 
  - `/alertes` → `Alertes`
  - `/anomalies` → `Anomalies`

#### ✅ Sidebar Navigation
- **Localisation**: `frontend/guardnet/src/app/components/sidebar/sidebar.html`
- **Nouveau Lien**: "🌐 Carte Réseau" pointant vers `/network`

---

## 🎨 Design & Styling

### Palette Couleurs
- **En ligne/OK**: `#10b981` (Vert)
- **Critique/Erreur**: `#ef4444` (Rouge)
- **Avertissement**: `#f59e0b` (Orange)
- **Normal/Info**: `#3b82f6` (Bleu)
- **Arrière-plan**: `#f9fafb` (Gris très clair)
- **Texte**: `#1f2937` (Gris foncé)

### Responsive Design
- Tous les composants sont responsive avec flexbox/grid
- Tables scrollables horizontalement
- Cartes/grilles en `grid: repeat(auto-fill, minmax(250px, 1fr))`

---

## 📊 Schéma de Base de Données Existant

Les modèles suivants sont utilisés:
- `Device` - Appareils du réseau
- `Alert` - Alertes système
- `AnomalyLog` - Historique des détections d'anomalies
- `MetricHistory` - Historique des métriques (CPU, RAM, latence)

---

## 🚀 Comment Utiliser

### Backend
```bash
cd backend
source venv_new/Scripts/activate
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend/guardnet
npm start
```

### Accès
- Login: `http://localhost:4200/login`
- Dashboard: `http://localhost:4200/dashboard`
- Carte Réseau: `http://localhost:4200/network`
- Alertes: `http://localhost:4200/alertes`
- Anomalies: `http://localhost:4200/anomalies`

---

## 🔄 Flux de Données

### Carte Réseau
1. Component charge au ngOnInit
2. MonitoringService.getNetworkMap() appelle GET /monitoring/network
3. Données reçues → positions SVG calculées
4. Refresh automatique chaque 30s
5. Au clic sur un nœud → panneau latéral s'ouvre

### Alertes
1. Component charge au ngOnInit
2. MonitoringService.getAlerts() récupère la liste
3. Filtres appliqués côté client (type, sévérité, statut)
4. Pagination: 10 alertes par page
5. Bouton "Résoudre" appelle PATCH /alerts/{id}/resolve
6. Refresh automatique chaque 30s

### Anomalies
1. Component charge au ngOnInit
2. MonitoringService.getAnomalyHistory() récupère l'historique
3. Graphique Canvas dessiné avec scores
4. Bouton "Analyser" déclenche POST /anomaly/detect
5. Après analyse → historique recharge automatiquement
6. Affichage du résultat avec score et confiance

---

## ✨ Améliorations Possibles

1. **Réaltime**: WebSocket pour updates en temps réel (vs polling 30s)
2. **Export**: CSV/PDF pour alertes et anomalies
3. **Notifications**: Push notifications pour alertes critiques
4. **Dashboard**: Intégrer mini-cartes sur le dashboard principal
5. **Analyse Avancée**: Graphiques Recharts/Chart.js pour meilleure visualisation
6. **Authentification**: Vérifier permissions par rôle (admin, analyst, viewer)

---

## 📝 Notes Importantes

- Les alertes affichent les données de `/alerts` directement (pas de filtre DB côté serveur dans cette version)
- Les positions SVG de la carte réseau sont calculées automatiquement en cercle
- Les scores d'anomalie sont affichés en pourcentage (0-100%)
- Tous les composants supportent les états de chargement et erreur
- Les services utilisent les tokens d'authentification Bearer dans les headers

---

**Implémentation complétée le**: 4 Mai 2025
**Status**: ✅ PRÊT POUR TEST
