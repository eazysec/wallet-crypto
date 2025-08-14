# SecuredWallet

## 🔐 Générateur de Wallet Sécurisé Multi-Blockchain

**MySuperSecuredWallet** est une suite d'outils offline-first pour gérer vos wallets cryptocurrency en toute sécurité sur les réseaux **XRPL** et **Stellar (XLM)**.

### ✨ Fonctionnalités

- 🔒 **Génération de wallet 100% offline**
- 🌐 **Support XRPL et Stellar (XLM)**
- 🔑 **Seed phrases compatibles (12/24 mots)**
- 📝 **Signature de transactions offline**
- 🚀 **Envoi sécurisé sur blockchain**
- 🎨 **Interface moderne et épurée**

### 🛡️ Workflow Sécurisé en 4 Étapes

#### 1. **Génération de Wallet** (OFFLINE)
```
📁 OFFLINE_wallet-generation.html
```
- Génération de nouveaux wallets
- Récupération depuis seed-phrase
- Support wallets numériques (Xaman)
- Sauvegarde chiffrée par mot de passe

#### 2. **Préparation de Transaction** (ONLINE)
```
📁 2.1-ONLINE_transaction-prepare.html
```
- Création de transactions (envoi, trustlines, etc.)
- Vérification de comptes blockchain
- Export pour signature offline

#### 3. **Signature de Transaction** (OFFLINE)
```
📁 2.2-OFFLINE_transaction-sign.html
```
- Signature sécurisée hors ligne
- Support seed-phrase ou fichier wallet
- Détection automatique du réseau

#### 4. **Envoi sur Blockchain** (ONLINE)
```
📁 2.3-ONLINE_transaction-send.html
```
- Vérification finale de transaction
- Envoi sur MainNet/TestNet
- Suivi des résultats

### 🚀 Utilisation Rapide

1. **Créez votre wallet** avec `OFFLINE_wallet-generation.html` (PC déconnecté)
2. **Préparez votre transaction** avec `2.1-ONLINE_transaction-prepare.html`
3. **Signez offline** avec `2.2-OFFLINE_transaction-sign.html` (PC déconnecté)
4. **Envoyez** avec `2.3-ONLINE_transaction-send.html`

### 🔧 Technologies

- **Frontend :** HTML5, CSS3, JavaScript (ES6+)
- **Crypto :** SecureWalletBundle@2.5.4
- **UI :** Bootstrap 5.2 + Design System custom
- **Sécurité :** AES-256-CBC, BIP39, offline-first

### 🌐 Réseaux Supportés

| Blockchain | MainNet | TestNet | Explorateur |
|------------|---------|---------|-------------|
| **XRPL** | ✅ | ✅ | [XRPScan](https://xrpscan.com) |
| **Stellar** | ✅ | ✅ | [LumenScan](https://lumenscan.io) |

### ⚡ Fonctionnalités Avancées

- **Multi-signature** : Support des comptes signataires
- **Trustlines** : Gestion complète des assets
- **Account Management** : Suppression, gestion des clés maîtres
- **Auto-détection** : Reconnaissance automatique des réseaux
- **Responsive** : Interface adaptative mobile/desktop

### 🛡️ Sécurité

- **🔒 Offline-first** : Clés privées jamais exposées online
- **🔐 Chiffrement** : AES-256 avec dérivation de clé sécurisée  
- **🎯 Isolation** : Séparation stricte online/offline
- **✅ Vérification** : Contrôles d'intégrité des transactions

### 📋 Prérequis

- Navigateur moderne (Chrome, Firefox, Safari, Edge)
- JavaScript activé
- Pour sécurité maximale : PC offline dédié

### ⚠️ Recommandations de Sécurité

1. **Utilisez un PC offline** pour les étapes 1 et 3
2. **Sauvegardez vos seed-phrases** sur papier
3. **Testez avec de petits montants** d'abord
4. **Vérifiez toujours** les adresses de destination
5. **Gardez vos mots de passe** en sécurité

### Références

- **Version de base :** 2.5.4
- **Compatibilité :** XRPL, Stellar (XLM)
- **Base :** MySuperSecuredWallet-V2.5.4 (Decrypto)

---

> **⚡ Tip :** Commencez toujours par tester sur TestNet avant d'utiliser MainNet avec de vrais fonds !