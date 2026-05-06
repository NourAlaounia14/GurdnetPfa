# Guide de Test - GuardNet Features

## 🧪 Tests Manuel

### 1. **Test - Carte Réseau**

#### Prérequis:
- Backend running: `http://127.0.0.1:8000`
- Frontend running: `http://127.0.0.1:4200`
- Devices dans la base de données

#### Étapes:
1. Login avec un compte valide
2. Cliquer sur "🌐 Carte Réseau" dans le sidebar
3. **Vérifications**:
   - ✓ Nœuds affichés en cercle avec icônes
   - ✓ Couleurs: vert (online/up), rouge (offline/down), gris (unknown)
   - ✓ Badge rouge avec nombre sur les nœuds ayant des alertes
   - ✓ Cliquer sur un nœud → panneau latéral s'ouvre à droite
   - ✓ Panneau affiche: hostname, IP, type, statut, alertes, dates
   - ✓ Boutons "Voir les alertes" et "Diagnostiquer" visibles
   - ✓ Refresh automatique chaque 30 secondes (observer les positions)
   - ✓ Fermer avec bouton ✕

#### Test CURL (Backend):
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://127.0.0.1:8000/monitoring/network
```

---

### 2. **Test - Page Alertes**

#### Prérequis:
- Alertes dans la base de données

#### Étapes:
1. Cliquer sur "🔔 Alertes" dans le sidebar
2. **Vérifications**:
   - ✓ Tableau avec colonnes: Type, Sévérité, Message, Date, Statut, Action
   - ✓ Filtres disponibles: Type, Sévérité, Statut
   - ✓ Icônes pour chaque type d'alerte (🆕, 🔧, ❌, ⏱️, ⚠️, ✅)
   - ✓ Codes couleur de sévérité (rouge=critique, orange=élevé, etc.)
   - ✓ Compteur en haut: "Actives: X", "Total: Y"
   - ✓ Bouton "Résoudre" (✓) fonctionne → l'alerte devient grisée et "Résolue"
   - ✓ Pagination: "← Précédent | Page X/Y | Suivant →"
   - ✓ Refresh automatique chaque 30 secondes
   - ✓ Filtres fonctionnent: filtrer par Type → tableau se met à jour
   - ✓ Bouton "Réinitialiser" efface tous les filtres

#### Test CURL (Backend):
```bash
# Sans filtres
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://127.0.0.1:8000/alerts

# Avec filtres
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://127.0.0.1:8000/alerts?severity=critical&resolved=false"

# Stats
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://127.0.0.1:8000/alerts/stats
```

---

### 3. **Test - Page Anomalies**

#### Prérequis:
- Historique d'anomalies dans AnomalyLog

#### Étapes:
1. Cliquer sur "⚠️ Anomalies" dans le sidebar
2. **Vérifications**:
   - ✓ En-tête violet avec gradient
   - ✓ Statistiques: "Anomalies détectées: X", "Score moyen: Y%", "Historique: Z points"
   - ✓ Bouton "🔍 Analyser maintenant" visible
   - ✓ Cliquer sur bouton → "Analyse en cours..." puis résultat affiché
   - ✓ Résultat affiche: icon (⚠️ ou ✅), score, confiance
   - ✓ Graphique BarChart dessiné avec:
     - Barres bleues (score normal) et rouges (anomalies)
     - Ligne pointillée orange (seuil 60%)
     - Légende avec 3 couleurs
   - ✓ Tableau "Anomalies récentes" affiché
   - ✓ Tableau complet avec colonnes: Temps, Score, Statut, CPU%, RAM%, Latence
   - ✓ Lignes anomalies surlignées en rose clair

#### Test CURL (Backend):
```bash
# Historique
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://127.0.0.1:8000/anomaly/history?skip=0&limit=30"

# Déclencher analyse
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  http://127.0.0.1:8000/anomaly/detect
```

---

## 🐛 Dépannage

### Problème: Page blanche / Erreur 404 après navigation
**Solution**: Vérifier que les routes sont bien importées dans `app.routes.ts`

### Problème: Alerte "Cannot find module 'network-map'"
**Solution**: Vérifier que `NetworkComponent` est importé dans `NetworkComponent` et que le chemin du composant est correct

### Problème: Les alertes ne se résolvent pas
**Solution**: Vérifier:
1. Token d'authentification est valide
2. Endpoint `/alerts/{id}/resolve` reçoit un PATCH (pas PUT/POST)
3. Backend retourne une réponse 200

### Problème: Graphique Canvas vide
**Solution**: 
1. Vérifier que `anomalyHistory` a des données
2. Vérifier que `ngAfterViewInit` est appelé
3. Ouvrir console (F12) pour voir les erreurs

### Problème: Positionnement nodes SVG incorrect
**Solution**: Les positions sont calculées automatiquement en cercle. Les données doivent être présentes dans la réponse `/monitoring/network`

---

## 📱 Responsive Design

- **Desktop (> 1024px)**: Layout normal, colonnes flexibles
- **Tablet (768-1024px)**: Colonnes réduites, tables scrollables
- **Mobile (< 768px)**: Stack vertical, pleins largeur

### Test Responsive:
```javascript
// Dans console du navigateur
window.innerWidth  // vérifier la largeur
// Ouvrir DevTools → Responsive Design Mode (Ctrl+Shift+M)
```

---

## 🔐 Sécurité

- Tous les endpoints requièrent `Authorization: Bearer TOKEN`
- Les tokens sont stockés dans le service `Auth`
- Les filtres sont appliqués côté client (vérifier côté serveur en production)
- Les données sensibles (IPs, hostnames) sont loggées - attention en production

---

## 📊 Scénarios d'Usage

### Scénario 1: Monitorer les dispositifs
1. Ouvrir "Carte Réseau"
2. Observer les nœuds
3. Cliquer sur un nœud pour voir détails
4. Suivre les alertes liées

### Scénario 2: Gérer les alertes
1. Ouvrir "Alertes"
2. Filtrer par sévérité = "critical"
3. Résoudre les alertes une par une (bouton ✓)
4. Observer que le compteur "Actives" diminue

### Scénario 3: Analyser les anomalies
1. Ouvrir "Anomalies"
2. Cliquer "Analyser maintenant"
3. Observer le graphique et résultats
4. Consulter le tableau complet pour trends

---

## 🚀 Performance

- Refresh chaque 30s (pas de temps réel avec polling)
- Pagination: 10 items par page (alertes)
- Historique: 30 derniers logs (anomalies)
- GraphQL: Non utilisé (REST API)
- Cache: Aucun (chaque request fraîche)

### Optimisations Futures:
- WebSocket pour temps réel
- Service Worker pour cache
- Virtual scrolling pour grandes listes
- Lazy loading des images

---

**Guide créé le**: 4 Mai 2025
**Version**: 1.0
