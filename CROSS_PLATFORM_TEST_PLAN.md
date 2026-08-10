# Validation multi-plateforme

La matrice GitHub Actions compile l’interface et le moteur natif, exécute les tests, puis lance un scan réel sur macOS, Windows et Ubuntu. Une release publique reste conditionnée aux contrôles manuels ci-dessous sur chaque OS cible.

## Contrôles automatisés

- regroupement de processus distinguant les projets homonymes par chemin complet;
- règles de protection par port, processus, exécutable et dossier de travail;
- compilation des commandes natives d’ouverture, terminal et arrêt;
- scan système réel via `scan_summary`;
- compilation Tauri complète sans création d’installateur.

## Recette manuelle par OS

1. Lancer un serveur local connu et vérifier le port, le PID, l’adresse, le dossier et la commande.
2. Ouvrir son dossier depuis l’inspecteur et vérifier le gestionnaire de fichiers natif.
3. Ouvrir un terminal et vérifier son répertoire de départ.
4. Ajouter la protection du projet, vérifier que l’arrêt est bloqué, puis retirer la règle.
5. Arrêter un processus de test non protégé et vérifier que son port disparaît au scan suivant.
6. Vérifier que les ports 22 et 53, le PID 1 et les services système restent non arrêtables.
7. Tester les modes sombre, clair et système, ainsi que la navigation complète au clavier.

## État actuel

- macOS Apple Silicon : build, tests, scan réel, signature ad hoc et DMG vérifiés localement.
- Windows : validation automatisée prête; exécution attendue après publication du dépôt.
- Linux Ubuntu 22.04 : validation automatisée prête; exécution attendue après publication du dépôt.
