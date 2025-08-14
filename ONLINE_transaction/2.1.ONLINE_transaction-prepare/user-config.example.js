/**
 * EXEMPLE DE CONFIGURATION UTILISATEUR
 * 
 * Copiez ce fichier vers 'user-config.js' et modifiez selon vos besoins.
 * Cette configuration sera fusionnée avec la configuration par défaut.
 * 
 * Instructions :
 * 1. Copiez ce fichier : cp user-config.example.js user-config.js
 * 2. Modifiez les valeurs selon vos besoins
 * 3. Incluez le fichier dans votre HTML : <script src="user-config.js"></script>
 * 4. Incluez AVANT le script principal : <script src="config.js"></script>
 */

window.UserTransactionConfig = {
    
    // ===== EXEMPLE : SERVEURS PERSONNALISÉS =====
    networks: {
        XRPL: {
            // Utiliser vos propres serveurs XRPL
            servers: {
                main: "wss://s1.ripple.com",
                test: "wss://s.altnet.rippletest.net:51233"
            }
        },
        XLM: {
            // Serveurs Stellar personnalisés
            servers: {
                main: "https://horizon.stellar.org",
                test: "https://horizon-testnet.stellar.org"
            }
        }
    },

    // ===== EXEMPLE : PERSONNALISATION DE L'INTERFACE =====
    ui: {
        // Démarrer avec Stellar par défaut
        defaultNetwork: "XLM",
        
        // Démarrer en TestNet
        defaultServer: "test",
        
        // Désactiver les prix USD
        showUsdPrices: false,
        
        // Rafraîchissement automatique toutes les 30 secondes
        autoRefreshInterval: 30,
        
        // Décimales personnalisées
        decimals: {
            XRP: 4,  // Au lieu de 6
            XLM: 5,  // Au lieu de 7
            other: 2
        }
    },

    // ===== EXEMPLE : THÈMES PERSONNALISÉS =====
    networks: {
        XRPL: {
            theme: {
                primary: "#0066cc",     // Bleu personnalisé
                secondary: "#004499",
                accent: "#3399ff",
                light: "#e6f3ff"
            }
        },
        XLM: {
            theme: {
                primary: "#6600cc",     // Violet personnalisé
                secondary: "#4400aa",
                accent: "#8833ff",
                light: "#f0e6ff"
            }
        }
    },

    // ===== EXEMPLE : CONFIGURATION DE DÉVELOPPEMENT =====
    development: {
        // Activer le mode debug
        debug: true,
        
        // Utiliser des serveurs locaux
        localServers: {
            XRPL: {
                main: "ws://localhost:6006",
                test: "ws://localhost:6007"
            }
        }
    },

    // ===== EXEMPLE : SÉCURITÉ PERSONNALISÉE =====
    security: {
        // Masquer les adresses (affiche XXX...XXX)
        maskSensitiveData: true,
        
        // Timeout plus court
        networkTimeout: 15000
    },

    // ===== EXEMPLE : TEXTES PERSONNALISÉS =====
    texts: {
        messages: {
            welcome: "Interface de transaction crypto personnalisée",
            preparation: "Préparation en cours, veuillez patienter...",
            
            // Conseils personnalisés
            securityTips: [
                "Utilisez un hardware wallet pour plus de sécurité",
                "Vérifiez toujours l'URL de l'interface",
                "Ne partagez jamais vos clés privées",
                "Sauvegardez vos phrases de récupération"
            ]
        }
    },

    // ===== EXEMPLE : TRANSACTIONS PERSONNALISÉES =====
    transactions: {
        defaults: {
            // Limite de trustline plus conservative
            trustlineLimit: "1000000",
            
            // Financement TestNet réduit
            testnetFunding: 50
        },
        
        validation: {
            // Montant minimum plus élevé
            minAmount: 0.1,
            
            // Validation d'adresse plus souple
            strictAddressValidation: false
        }
    },

    // ===== EXEMPLE : ÉVÉNEMENTS PERSONNALISÉS =====
    events: {
        onNetworkChange: function(networkName, serverType) {
            // Log personnalisé
            console.log(`🔄 Réseau changé vers ${networkName} (${serverType})`);
            
            // Vous pouvez ajouter ici :
            // - Envoi de métriques
            // - Notifications utilisateur
            // - Sauvegarde des préférences
        },

        onTransactionPrepared: function(transactionData) {
            console.log('✅ Transaction préparée :', transactionData);
            
            // Exemple : sauvegarder l'historique
            const history = JSON.parse(localStorage.getItem('txHistory') || '[]');
            history.push({
                timestamp: Date.now(),
                network: transactionData.network,
                type: transactionData.type,
                amount: transactionData.amount
            });
            localStorage.setItem('txHistory', JSON.stringify(history.slice(-10))); // Garder 10 dernières
        },

        onError: function(error, context) {
            console.error(`❌ Erreur dans ${context}:`, error);
            
            // Exemple : notification utilisateur
            if (window.Notification && Notification.permission === 'granted') {
                new Notification('Erreur de transaction', {
                    body: `Erreur dans ${context}: ${error.message || error}`,
                    icon: '/favicon.ico'
                });
            }
        }
    },

    // ===== EXEMPLE : EXTENSIONS =====
    extensions: {
        // Ajouter une nouvelle blockchain (exemple)
        additionalNetworks: {
            BTC: {
                name: "BTC",
                displayName: "Bitcoin",
                symbol: "BTC",
                servers: {
                    main: "https://api.blockchain.info",
                    test: "https://api.blockcypher.com/v1/btc/test3"
                },
                theme: {
                    primary: "#f7931a",
                    secondary: "#d4730a",
                    accent: "#ff9500",
                    light: "#fff3e0"
                }
            }
        },

        // Plugins personnalisés
        plugins: {
            analytics: {
                enabled: true,
                provider: "google",
                trackingId: "GA_TRACKING_ID"
            },
            
            notifications: {
                enabled: true,
                provider: "browser",
                requestPermission: true
            }
        }
    }
};

// ===== FONCTIONS UTILITAIRES PERSONNALISÉES =====

// Exemple : Fonction pour sauvegarder les préférences utilisateur
window.UserTransactionConfig.saveUserPreferences = function(prefs) {
    localStorage.setItem('userPrefs', JSON.stringify(prefs));
};

// Exemple : Fonction pour charger les préférences utilisateur
window.UserTransactionConfig.loadUserPreferences = function() {
    const saved = localStorage.getItem('userPrefs');
    return saved ? JSON.parse(saved) : {};
};

// ===== AUTO-CONFIGURATION =====
(function autoConfig() {
    // Charger les préférences sauvegardées
    const userPrefs = window.UserTransactionConfig.loadUserPreferences();
    
    if (userPrefs.defaultNetwork) {
        window.UserTransactionConfig.ui.defaultNetwork = userPrefs.defaultNetwork;
    }
    
    if (userPrefs.defaultServer) {
        window.UserTransactionConfig.ui.defaultServer = userPrefs.defaultServer;
    }

    // Détecter l'environnement
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        // Mode développement local
        window.UserTransactionConfig.development.debug = true;
        window.UserTransactionConfig.ui.defaultServer = 'test';
        console.log('🛠️ Mode développement détecté');
    }

    // Détecter les paramètres URL
    const urlParams = new URLSearchParams(window.location.search);
    
    if (urlParams.get('network')) {
        window.UserTransactionConfig.ui.defaultNetwork = urlParams.get('network').toUpperCase();
    }
    
    if (urlParams.get('server')) {
        window.UserTransactionConfig.ui.defaultServer = urlParams.get('server');
    }
    
    if (urlParams.get('debug') === 'true') {
        window.UserTransactionConfig.development.debug = true;
    }

    console.log('⚙️ Configuration utilisateur chargée');
})();

/**
 * EXEMPLES D'UTILISATION AVANCÉE
 */

// Exemple 1 : Notification de nouvelles transactions
/*
window.UserTransactionConfig.events.onTransactionPrepared = function(transactionData) {
    // Envoyer à un webhook
    fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transactionData)
    });
};
*/

// Exemple 2 : Intégration avec un système de métriques
/*
window.UserTransactionConfig.events.onNetworkChange = function(network, server) {
    if (typeof analytics !== 'undefined') {
        analytics.track('Network Changed', {
            network: network,
            server: server,
            timestamp: new Date().toISOString()
        });
    }
};
*/

// Exemple 3 : Validation personnalisée
/*
window.UserTransactionConfig.customValidation = {
    validateAddress: function(address, network) {
        // Logique de validation personnalisée
        if (network === 'XRPL' && address.startsWith('X')) {
            return { valid: false, error: 'Les adresses X ne sont pas autorisées' };
        }
        return { valid: true };
    }
};
*/

// Exemple 4 : Thème dynamique basé sur l'heure
/*
(function dynamicTheme() {
    const hour = new Date().getHours();
    const isDarkHours = hour < 6 || hour > 20;
    
    if (isDarkHours) {
        // Thème sombre
        window.UserTransactionConfig.networks.XRPL.theme = {
            primary: "#2d3748",
            secondary: "#4a5568", 
            accent: "#63b3ed",
            light: "#1a202c"
        };
    }
})();
*/