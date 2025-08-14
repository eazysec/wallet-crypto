# Interface de Préparation de Transaction Blockchain

Une interface web moderne pour préparer des transactions sur les blockchains XRPL et Stellar (XLM).

## 🚀 Fonctionnalités

- **Support multi-blockchain** : XRPL et Stellar (XLM)
- **Interface moderne** : Design responsive avec thèmes visuels distincts
- **Sécurité** : Préparation de transaction offline-ready
- **Gestion complète** :
  - Envoi de fonds natifs et assets
  - Gestion des trustlines
  - Suppression de comptes
  - Gestion des signataires

## 📁 Structure du Projet

```
transaction-interface/
├── index.html          # Interface principale
├── styles.css          # Styles CSS avec thèmes
├── script.js           # Logique JavaScript
└── README.md           # Ce fichier
```

## 🎨 Thèmes Visuels

### XRPL (XRP)
- **Couleurs** : Bleu marine (#1a365d) vers bleu clair (#3182ce)
- **Background** : Dégradé bleu avec watermark "XRP"
- **Accent** : Bleu XRP officiel

### Stellar (XLM)
- **Couleurs** : Violet foncé (#2d1b69) vers violet clair (#6b5fdc)
- **Background** : Dégradé violet avec watermark "XLM"
- **Accent** : Violet Stellar officiel

## 🛠️ Installation

### Option 1 : Utilisation Directe
1. Téléchargez tous les fichiers dans un dossier
2. Ouvrez `index.html` dans votre navigateur
3. Assurez-vous d'avoir une connexion internet (CDN requis)

### Option 2 : Serveur Local
```bash
# Avec Python 3
python -m http.server 8000

# Avec Node.js (http-server)
npx http-server

# Puis ouvrez http://localhost:8000
```

## 📋 Prérequis

- **Navigateur moderne** : Chrome, Firefox, Safari, Edge (dernières versions)
- **Connexion Internet** : Requise pour les CDN et connexions blockchain
- **JavaScript activé** : Obligatoire pour le fonctionnement

## 🔧 Configuration

### Sélection du Réseau
L'interface propose deux sélecteurs en haut à droite :

1. **Blockchain** : 
   - XRPL (XRP Ledger)
   - Stellar (XLM)

2. **Réseau** :
   - MainNet (Production)
   - TestNet (Test)

### URLs des Serveurs
Les URLs sont configurées dans `script.js` :

```javascript
// XRPL
static serverURL = { 
    "main": "wss://xrplcluster.com", 
    "test": "wss://s.altnet.rippletest.net:51233"
};

// Stellar
static serverURL = { 
    "main": "https://horizon.stellar.org", 
    "test": "https://horizon-testnet.stellar.org"
};
```

## 🎯 Utilisation

### 1. Vérification d'Adresse
- Entrez l'adresse publique de votre compte
- Cliquez sur "Vérifier l'adresse"
- L'interface affiche le solde et les assets disponibles

### 2. Envoi de Fonds
- Sélectionnez l'asset à envoyer
- Entrez l'adresse de destination
- Ajoutez un tag/memo si nécessaire
- Spécifiez le montant
- Préparez la transaction

### 3. Gestion des Trustlines
- **Ajouter** : Définissez issuer, currency et limite max
- **Révoquer** : Sélectionnez parmi les trustlines existantes (balance = 0)

### 4. Suppression de Compte
- Entrez l'adresse pour recevoir le reliquat
- Vérifiez qu'aucun asset non-natif n'existe
- Préparez la suppression

### 5. Gestion des Signataires
- Définir/modifier un signataire
- Activer/désactiver la clé maître
- Supprimer un signataire existant

## 📱 Responsive Design

L'interface s'adapte automatiquement :
- **Desktop** : Menus en colonnes, navigation complète
- **Tablet** : Adaptation des tailles et espacements
- **Mobile** : Navigation empilée, boutons adaptés

## 🔒 Sécurité

### Workflow Sécurisé
1. **Étape 1** (ONLINE) : Préparation de la transaction
2. **Étape 2** (OFFLINE) : Signature avec clé privée
3. **Étape 3** (ONLINE) : Envoi de la transaction signée

### Bonnes Pratiques
- Utilisez le TestNet pour vos tests
- Vérifiez toujours les adresses de destination
- Commencez par de petits montants
- Gardez vos clés privées sécurisées

## 🎨 Personnalisation CSS

### Variables CSS Disponibles
```css
:root {
    /* XRPL Colors */
    --xrpl-primary: #1a365d;
    --xrpl-secondary: #2c5282;
    --xrpl-accent: #3182ce;
    
    /* XLM Colors */
    --xlm-primary: #2d1b69;
    --xlm-secondary: #4c3a9a;
    --xlm-accent: #6b5fdc;
    
    /* Common */
    --card-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    --border-radius: 0.75rem;
    --transition: all 0.3s ease;
}
```

### Modification des Thèmes
Pour personnaliser les couleurs, modifiez les variables CSS dans `styles.css`.

## 🛠️ Développement

### Structure du Code JavaScript

```javascript
// Classes blockchain
const CLASSES = {
    "XRPL": class XRPL { ... },
    "XLM": class XLM { ... }
};

// Fonctions principales
const _online_ = {
    viewDetails(),
    prepareSend(),
    prepareTrustSet(),
    prepareDeleteAccount(),
    prepareSigners()
};

// Gestion des thèmes
function setTheme(networkType);
function initializeNetwork(networkType, serverType);
```

### Ajout de Nouvelles Blockchains
1. Créez une nouvelle classe dans `CLASSES`
2. Implémentez les méthodes requises
3. Ajoutez les couleurs dans CSS
4. Mettez à jour les sélecteurs HTML

## 🔗 Dépendances CDN

- **Bootstrap 5.2.0** : Interface utilisateur
- **jQuery 3.6.0** : Manipulation DOM
- **SecureWalletBundle 2.5.4** : Librairies blockchain (XRPL + Stellar)

## 📞 Support

### Liens Utiles
- **XRPL** : [Documentation officielle](https://xrpl.org/)
- **Stellar** : [Documentation officielle](https://developers.stellar.org/)
- **Tutoriels vidéo** : Intégrés dans l'interface

### Problèmes Courants

1. **Erreur de chargement de librairie**
   - Vérifiez votre connexion internet
   - Les CDN peuvent être temporairement indisponibles

2. **Compte non trouvé**
   - Le compte n'existe pas sur la blockchain
   - Utilisez "Ajouter des fonds" en TestNet

3. **Transaction échouée**
   - Vérifiez les frais de réseau
   - Assurez-vous que le compte a suffisamment de fonds

## 🔄 Versions

### v2.0 - Version Actuelle
- Interface séparée en fichiers HTML/CSS/JS
- Thèmes visuels par blockchain
- Menus déroulants repositionnés
- Design moderne et responsive
- Animations et transitions améliorées

## 📄 Licence

Ce projet est distribué sous licence MIT. Voir le fichier LICENSE pour plus de détails.

---

**⚠️ Avertissement** : Cette interface prépare des transactions mais ne stocke jamais vos clés privées. Gardez toujours vos clés sécurisées et utilisez un environnement offline pour la signature.