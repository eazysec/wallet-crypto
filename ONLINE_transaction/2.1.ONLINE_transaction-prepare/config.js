/**
 * Configuration de l'Interface de Transaction Blockchain
 * 
 * Ce fichier permet de personnaliser facilement les paramètres
 * de l'application sans modifier le code principal.
 */

window.TransactionConfig = {
    
    // ===== CONFIGURATION DES RÉSEAUX =====
    networks: {
        XRPL: {
            name: "XRPL",
            displayName: "XRP Ledger",
            symbol: "XRP",
            servers: {
                main: "wss://xrplcluster.com",
                test: "wss://s.altnet.rippletest.net:51233"
            },
            explorer: {
                main: "https://livenet.xrpl.org",
                test: "https://testnet.xrpl.org"
            },
            tutorial: "https://youtu.be/djt5ZKKJrWI",
            theme: {
                primary: "#1a365d",
                secondary: "#2c5282", 
                accent: "#3182ce",
                light: "#bee3f8"
            }
        },
        XLM: {
            name: "XLM",
            displayName: "Stellar Lumens",
            symbol: "XLM",
            servers: {
                main: "https://horizon.stellar.org",
                test: "https://horizon-testnet.stellar.org"
            },
            explorer: {
                main: "https://stellarexpert.io",
                test: "https://stellarexpert.io/testnet"
            },
            tutorial: "https://youtu.be/CJpHtLly6n4",
            theme: {
                primary: "#2d1b69",
                secondary: "#4c3a9a",
                accent: "#6b5fdc", 
                light: "#e2d8ff"
            }
        }
    },

    // ===== CONFIGURATION DE L'INTERFACE =====
    ui: {
        // Blockchain par défaut au démarrage
        defaultNetwork: "XRPL",
        
        // Réseau par défaut (main/test)
        defaultServer: "main",
        
        // Affichage des prix en USD
        showUsdPrices: true,
        
        // API pour les prix (Bitget par défaut)
        priceApi: "https://api.bitget.com/api/v2/spot/market/tickers?symbol={SYMBOL}USDT",
        
        // Durée d'affichage des notifications (ms)
        notificationDuration: 3000,
        
        // Animation des transitions
        animations: {
            enabled: true,
            duration: 300
        },
        
        // Auto-refresh des balances (secondes, 0 = désactivé)
        autoRefreshInterval: 0,
        
        // Nombre de décimales à afficher pour les montants
        decimals: {
            XRP: 6,
            XLM: 7,
            other: 4
        }
    },

    // ===== CONFIGURATION DES TRANSACTIONS =====
    transactions: {
        // Délai supplémentaire pour LastLedgerSequence (XRPL)
        xrplLedgerBuffer: 180,
        
        // Timeout pour les transactions Stellar (secondes)
        stellarTimeout: 240,
        
        // Montants par défaut
        defaults: {
            trustlineLimit: "100000000000",
            testnetFunding: 90
        },
        
        // Validation
        validation: {
            // Montant minimum pour les transferts
            minAmount: 0.000001,
            
            // Longueur maximale pour les memos/tags
            maxMemoLength: 28,
            
            // Validation stricte des adresses
            strictAddressValidation: true
        }
    },

    // ===== CONFIGURATION DE LA SÉCURITÉ =====
    security: {
        // Afficher les avertissements de sécurité
        showSecurityWarnings: true,
        
        // Vérification de l'intégrité des librairies CDN
        checkLibraryIntegrity: true,
        
        // Timeout pour les connexions réseau (ms)
        networkTimeout: 30000,
        
        // Masquer partiellement les adresses sensibles
        maskSensitiveData: false
    },

    // ===== CONFIGURATION DU DÉVELOPPEMENT =====
    development: {
        // Mode debug (affiche plus de logs)
        debug: false,
        
        // Serveurs de développement locaux
        localServers: {
            XRPL: {
                main: "ws://localhost:6006",
                test: "ws://localhost:6007"
            }
        },
        
        // Désactiver les vérifications en mode dev
        skipValidation: false
    },

    // ===== CONFIGURATION DES TEXTES =====
    texts: {
        // Langue de l'interface
        language: "fr",
        
        // Textes personnalisables
        messages: {
            welcome: "Bienvenue dans l'interface de transaction blockchain",
            preparation: "Préparation de la transaction en cours...",
            success: "Transaction préparée avec succès !",
            error: "Une erreur est survenue",
            warning: "Attention, vérifiez bien vos informations",
            
            // Conseils de sécurité
            securityTips: [
                "Testez toujours avec de petits montants d'abord",
                "Vérifiez deux fois les adresses de destination", 
                "Gardez vos clés privées en sécurité",
                "Utilisez le TestNet pour vos tests"
            ]
        }
    },

    // ===== FONCTIONS UTILITAIRES =====
    utils: {
        /**
         * Obtient la configuration d'un réseau
         */
        getNetworkConfig: function(networkName) {
            return this.networks[networkName] || null;
        },

        /**
         * Obtient l'URL d'un serveur
         */
        getServerUrl: function(networkName, serverType) {
            const network = this.getNetworkConfig(networkName);
            return network ? network.servers[serverType] : null;
        },

        /**
         * Obtient les couleurs de thème
         */
        getThemeColors: function(networkName) {
            const network = this.getNetworkConfig(networkName);
            return network ? network.theme : null;
        },

        /**
         * Format d'un montant selon la devise
         */
        formatAmount: function(amount, currency) {
            const decimals = this.ui.decimals[currency] || this.ui.decimals.other;
            return Number(amount).toFixed(decimals).replace(/\.?0+$/, '');
        },

        /**
         * Génère un nom de fichier pour le téléchargement
         */
        generateFilename: function(prefix, networkName, serverType) {
            const timestamp = new Date().getTime() % 1000;
            return `#${timestamp}_${prefix}-${networkName}-${serverType}.tosign.json`;
        },

        /**
         * Vérifie si le mode debug est activé
         */
        isDebugMode: function() {
            return this.development.debug || 
                   window.location.search.includes('debug=true') ||
                   window.location.hostname === 'localhost';
        },

        /**
         * Log conditionnel en mode debug
         */
        debugLog: function(message, data = null) {
            if (this.isDebugMode()) {
                console.log(`[DEBUG] ${message}`, data || '');
            }
        }
    },

    // ===== ÉVÉNEMENTS PERSONNALISÉS =====
    events: {
        // Callbacks appelés lors d'événements spécifiques
        onNetworkChange: function(networkName, serverType) {
            this.utils.debugLog(`Network changed to ${networkName} (${serverType})`);
        },

        onTransactionPrepared: function(transactionData) {
            this.utils.debugLog('Transaction prepared', transactionData);
        },

        onError: function(error, context) {
            this.utils.debugLog(`Error in ${context}`, error);
            
            // Envoyer des métriques d'erreur si configuré
            if (this.analytics && this.analytics.enabled) {
                // Code d'analytics ici
            }
        }
    },

    // ===== EXTENSIONS POSSIBLES =====
    extensions: {
        // Support pour des blockchains supplémentaires
        additionalNetworks: {
            // Exemple pour ajouter Ethereum :
            // ETH: {
            //     name: "ETH",
            //     displayName: "Ethereum",
            //     symbol: "ETH",
            //     // ... configuration
            // }
        },

        // Plugins tiers
        plugins: {
            // analytics: { enabled: false, provider: "none" },
            // notifications: { enabled: false, provider: "browser" }
        }
    }
};

// ===== INITIALISATION DE LA CONFIGURATION =====
(function initConfig() {
    // Fusion avec la configuration utilisateur si elle existe
    if (window.UserTransactionConfig) {
        function deepMerge(target, source) {
            for (const key in source) {
                if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    if (!target[key]) target[key] = {};
                    deepMerge(target[key], source[key]);
                } else {
                    target[key] = source[key];
                }
            }
        }
        
        deepMerge(window.TransactionConfig, window.UserTransactionConfig);
    }

    // Application des styles de thème dynamiques
    const style = document.createElement('style');
    style.textContent = `
        :root {
            --default-transition: ${window.TransactionConfig.ui.animations.duration}ms;
        }
    `;
    document.head.appendChild(style);

    // Log de démarrage
    window.TransactionConfig.utils.debugLog('Configuration loaded', window.TransactionConfig);
})();