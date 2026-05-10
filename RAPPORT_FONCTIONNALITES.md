# Synthese fonctionnelle GuardNet

GuardNet est une plateforme d'administration et de supervision d'un reseau local. L'application est concue pour un seul acteur principal : l'administrateur. Apres authentification, l'administrateur peut surveiller les machines du reseau, lancer des scans, consulter les alertes, visualiser la carte reseau, analyser les anomalies par IA et generer un rapport.

## Acteur principal

L'acteur unique est l'administrateur. Il accede aux pages protegees apres connexion et dispose de toutes les fonctionnalites : dashboard, scan, alertes, carte reseau, anomalies IA, profil et generation de rapport.

## Monitoring reseau

Le monitoring ne se limite pas au serveur. Il supervise les machines detectees dans le reseau local. Pour chaque machine, la plateforme conserve les informations d'inventaire et les metriques disponibles : adresse IP, hostname, type d'equipement, statut, derniere detection, latence, CPU et RAM. Le dashboard affiche un resume global avec le nombre total de machines, les machines actives, les machines indisponibles, le CPU moyen, la RAM moyenne et la latence moyenne.

## Scan reseau

La page Scan permet de lancer une analyse rapide ou complete sur une plage IP. Les resultats detectent les machines, leur type, leur OS et leurs ports ouverts. Les nouveaux appareils sont marques comme nouveaux. Les changements de ports sont detectes par comparaison avec les scans precedents. Les resultats peuvent etre exportes en CSV.

## Alertes

Les alertes sont generees automatiquement selon les evenements reseau : nouvel appareil, changement de port, appareil indisponible, scan de ports, latence elevee, panne reseau ou anomalie detectee par IA. La page Alertes permet de filtrer les alertes par type, severite, statut et IP machine. Une alerte peut etre resolue par l'administrateur.

## Carte reseau

La carte reseau represente les machines sous forme de noeuds. Chaque noeud contient l'IP, le hostname, le type, le statut, les alertes actives et les dernieres metriques disponibles. Depuis le panneau d'une machine, l'administrateur peut ouvrir les alertes de cette IP ou lancer un scan cible.

## Detection IA des anomalies

Le module IA utilise un modele Isolation Forest. Les features envoyees au modele combinent les donnees de monitoring et les donnees du dernier scan : latence, CPU, RAM, nombre de ports ouverts, nombre de nouveaux devices, nombre d'alertes recentes et heure de la journee. Si une anomalie est detectee, la plateforme cree automatiquement une alerte ANOMALY_DETECTED et enregistre la prediction dans l'historique des anomalies.

## Reporting

Le dashboard contient un bouton de generation de rapport. Le rapport resume l'etat du reseau : machines actives, alertes non resolues, anomalies detectees, score IA, CPU moyen, RAM moyenne et latence moyenne. Le backend expose aussi un endpoint `/monitoring/report` pour obtenir une synthese exploitable cote API.

## Workflow entre les pages

Le dashboard est le point d'entree principal. Les cards critiques redirigent vers les pages Alertes, Anomalies, Scan ou Carte reseau. La page Scan met a jour l'inventaire, les alertes et les donnees utilisees par l'IA. La page Alertes permet de revenir vers la carte reseau par IP, et les alertes de type anomalie redirigent vers la page IA. La carte reseau permet de filtrer les alertes d'une machine ou de relancer un scan sur son IP.
